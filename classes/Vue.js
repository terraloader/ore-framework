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
 * The .vue file may use <script setup> (preferred) or a traditional <script>
 * block. Ore assignments are merged on top so they are always available in
 * the template.
 */

import fs   from 'fs'
import path from 'path'
import { pathToFileURL, fileURLToPath } from 'url'

const __dirname     = path.dirname(fileURLToPath(import.meta.url))
const _componentsRoot = path.join(__dirname, '..', 'components')

import { parse, compileTemplate, compileScript } from '@vue/compiler-sfc'
import { createSSRApp }           from 'vue'
import { renderToString }         from '@vue/server-renderer'

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

    const renderFn   = await this.#compileTemplate(descriptor, sfcPath)
    const assignments = this.getAll()

    // Build the component: merge Ore assignments with anything the SFC's own
    // setup() returns (SFC wins on key conflicts so it can override if needed)
    const sfcSetup  = await this.#extractSetup(descriptor, sfcPath)
    const component = {
      ssrRender: renderFn,
      async setup(props, ctx) {
        const oreData  = { ...assignments }
        const sfcData  = sfcSetup ? (await sfcSetup(props, ctx)) ?? {} : {}
        return { ...oreData, ...sfcData }
      }
    }

    const app  = createSSRApp(component)
    const body = await renderToString(app)

    // Derive the component identifier (e.g. "test" or "index") from the path
    const rel         = path.relative(_componentsRoot, sfcPath)
    const componentId = rel.replace(/[/\\]index\.vue$/, '').replace(/\\/g, '/')

    return this.#document(body, descriptor, assignments, componentId)
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Compile the <template> block to a render function using @vue/compiler-sfc.
   * The compiled code is written to a temp .mjs file and dynamically imported
   * so the ES module imports resolve natively — no regex rewriting needed.
   */
  async #compileTemplate(descriptor, sfcPath) {
    if (!descriptor.template) {
      throw new Error(`SFC has no <template> block: ${sfcPath}`)
    }

    const { code, errors } = compileTemplate({
      source:   descriptor.template.content,
      filename: sfcPath,
      id:       path.basename(sfcPath, '.vue'),
      ssr:      true,
    })

    if (errors.length) {
      throw new Error(`Template compile errors:\n${errors.map(e => e.message).join('\n')}`)
    }

    const tmpFile = sfcPath.replace('.vue', `.ssr.${Date.now()}.mjs`)
    fs.writeFileSync(tmpFile, code)
    try {
      const mod = await import(pathToFileURL(tmpFile).href)
      return mod.ssrRender
    } finally {
      fs.unlinkSync(tmpFile)
    }
  }

  /**
   * Extract a setup() function from the SFC's <script> or <script setup> block.
   * For <script setup>, compileScript() is used to produce an equivalent module.
   * The compiled code is written to a temp .mjs file and dynamically imported.
   */
  async #extractSetup(descriptor, sfcPath) {
    let scriptContent = null

    if (descriptor.scriptSetup) {
      const id = path.basename(sfcPath, '.vue')
      const compiled = compileScript(descriptor, { id })
      scriptContent = compiled.content
    } else if (descriptor.script) {
      scriptContent = descriptor.script.content
    }

    if (!scriptContent) return null

    const tmpFile = sfcPath.replace('.vue', `.script.${Date.now()}.mjs`)
    fs.writeFileSync(tmpFile, scriptContent)
    try {
      const mod     = await import(pathToFileURL(tmpFile).href)
      const options = mod.default
      return typeof options?.setup === 'function' ? options.setup : null
    } catch {
      return null
    } finally {
      try { fs.unlinkSync(tmpFile) } catch { /* already cleaned up */ }
    }
  }

  /**
   * Compile a .vue SFC's template for the browser (client-side render function).
   * Returns an ES module string exporting `render`, ready to serve as JavaScript.
   *
   * @param  {string} sfcPath  Absolute path to the .vue file
   * @returns {Promise<string>} JS module source
   */
  async compileForClient(sfcPath) {
    if (!fs.existsSync(sfcPath)) {
      throw new Error(`Vue SFC not found: ${sfcPath}`)
    }

    const source = fs.readFileSync(sfcPath, 'utf-8')
    const { descriptor, errors } = parse(source)

    if (errors.length) {
      throw new Error(`SFC parse errors in ${sfcPath}:\n${errors.map(e => e.message).join('\n')}`)
    }

    if (!descriptor.template) {
      throw new Error(`SFC has no <template> block: ${sfcPath}`)
    }

    const { code, errors: tmplErrors } = compileTemplate({
      source:   descriptor.template.content,
      filename: sfcPath,
      id:       path.basename(sfcPath, '.vue'),
      ssr:      false,  // client-side render function
    })

    if (tmplErrors.length) {
      throw new Error(`Template compile errors:\n${tmplErrors.map(e => e.message).join('\n')}`)
    }

    return code
  }

  /** Wrap SSR body in a full HTML document. */
  #document(body, descriptor, assignments, componentId) {
    const styles = descriptor.styles.map(s => `<style>${s.content}</style>`).join('\n')
    const state  = JSON.stringify(assignments)

    const hydration = `<script type="importmap">
{"imports":{"vue":"https://esm.sh/vue@3.4"}}
</script>
<script type="module">
import { createSSRApp } from 'vue'
import { render } from '/ore/component.js?c=${encodeURIComponent(componentId)}'
const app = createSSRApp({ render, setup() { return window.__ORE_STATE__ || {} } })
app.mount('#app')
</script>`

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="/css/main.css">
  ${styles}
  <script>window.__ORE_STATE__ = ${state};</script>
  ${hydration}
</head>
<body>
  <div id="app">${body}</div>
</body>
</html>`
  }
}

export default Vue
