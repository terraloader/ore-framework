/**
 * Vue (server-side)
 *
 * Handles two responsibilities:
 *   1. Collecting data assignments from component logic files
 *        Ore.vue.assign('key', value)   ← chainable
 *   2. Server-side rendering (SSR) of a Vue 3 SFC with those assignments
 *        injected as reactive setup() return values and as a JSON state
 *        blob (window.__ORE_STATE__) for client-side hydration.
 *
 * The .vue file's <script> block may export additional setup logic; Ore
 * assignments are merged on top so they are always available in the template.
 */

const fs   = require('fs')
const path = require('path')

const { parse, compileTemplate } = require('@vue/compiler-sfc')
const { createSSRApp }           = require('vue')
const { renderToString }         = require('@vue/server-renderer')
const vue                        = require('vue')

class Vue {
  constructor() {
    this._assignments = {}
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Assign a value that will be available inside the Vue template.
   * @param  {string} key
   * @param  {*}      value
   * @returns {Vue}   chainable
   */
  assign(key, value) {
    this._assignments[key] = value
    return this
  }

  /** Return a shallow copy of all current assignments. */
  getAll() {
    return { ...this._assignments }
  }

  /** Read a single assignment (useful inside component JS files). */
  get(key) {
    return this._assignments[key]
  }

  /** Clear all assignments — called automatically by Router before each request. */
  reset() {
    this._assignments = {}
    return this
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  /**
   * SSR-render a .vue SFC file with all current assignments available as
   * top-level template variables.
   *
   * @param  {string} sfcPath  Absolute path to the .vue file
   * @returns {Promise<string>} Full HTML document
   */
  async render(sfcPath) {
    if (!fs.existsSync(sfcPath)) {
      throw new Error(`Vue SFC not found: ${sfcPath}`)
    }

    const source              = fs.readFileSync(sfcPath, 'utf-8')
    const { descriptor, errors } = parse(source)

    if (errors.length) {
      throw new Error(`SFC parse errors in ${sfcPath}:\n${errors.map(e => e.message).join('\n')}`)
    }

    const renderFn   = this.#compileTemplate(descriptor, sfcPath)
    const assignments = this.getAll()

    // Build the component: merge Ore assignments with anything the SFC's own
    // setup() returns (SFC wins on key conflicts so it can override if needed)
    const sfcSetup  = this.#extractSetup(descriptor)
    const component = {
      render: renderFn,
      async setup(props, ctx) {
        const oreData  = { ...assignments }
        const sfcData  = sfcSetup ? (await sfcSetup(props, ctx)) ?? {} : {}
        return { ...oreData, ...sfcData }
      }
    }

    const app  = createSSRApp(component)
    const body = await renderToString(app)

    return this.#document(body, descriptor, assignments)
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Compile the <template> block to a render function using @vue/compiler-sfc.
   * The compiled code uses ES-module named imports from 'vue'; we strip those
   * and inject the live bindings manually so the code runs in CommonJS.
   */
  #compileTemplate(descriptor, sfcPath) {
    if (!descriptor.template) {
      throw new Error(`SFC has no <template> block: ${sfcPath}`)
    }

    const { code, errors } = compileTemplate({
      source:   descriptor.template.content,
      filename: sfcPath,
      id:       path.basename(sfcPath, '.vue'),
      ssr:      true,   // produces ssrRender
    })

    if (errors.length) {
      throw new Error(`Template compile errors:\n${errors.map(e => e.message).join('\n')}`)
    }

    // Strip: import { … } from "vue"
    // Keep everything else, then expose ssrRender (falls back to render)
    const cjs = code
      .replace(/\bimport\s+\{[^}]+\}\s+from\s+"vue"\s*;?\n?/g, '')
      .replace(/\bexport\s+function\s+(ssrRender|render)/, 'function $1')

    // Spread all Vue runtime exports into scope so the compiled code resolves
    // helpers like _toDisplayString, _createVNode, etc.
    const vueKeys   = Object.keys(vue)
    const vueValues = vueKeys.map(k => vue[k])

    // eslint-disable-next-line no-new-func
    const factory = new Function(
      ...vueKeys,
      `${cjs}\nreturn typeof ssrRender !== 'undefined' ? ssrRender : render`
    )

    return factory(...vueValues)
  }

  /**
   * Evaluate the <script> block and extract a setup() function if present.
   * Only handles simple default-export objects; for full script-setup support
   * use compileScript from @vue/compiler-sfc in a future iteration.
   */
  #extractSetup(descriptor) {
    const scriptContent = descriptor.script?.content
    if (!scriptContent) return null

    try {
      // Convert `export default { setup() {…} }` to CommonJS
      const cjs = scriptContent
        .replace(/export\s+default\s+/, 'module.exports = ')

      const mod = { exports: {} }
      // eslint-disable-next-line no-new-func
      new Function('module', 'exports', 'require', cjs)(mod, mod.exports, require)

      const options = mod.exports.default ?? mod.exports
      return typeof options?.setup === 'function' ? options.setup : null
    } catch {
      return null
    }
  }

  /** Wrap SSR body in a full HTML document. */
  #document(body, descriptor, assignments) {
    const styles = descriptor.styles.map(s => `<style>${s.content}</style>`).join('\n')
    const state  = JSON.stringify(assignments)

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="/css/main.css">
  ${styles}
  <script>window.__ORE_STATE__ = ${state};</script>
</head>
<body>
  <div id="app">${body}</div>
</body>
</html>`
  }
}

module.exports = Vue
