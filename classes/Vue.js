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
 *
 * Sub-component support:
 *   Any PascalCase tag in a template (e.g. <SampleCounter />) is resolved to
 *   the matching components/<kebab-case>/index.vue file automatically — both
 *   for SSR and for client hydration.  No manual registration is required.
 */

import fs             from 'fs'
import path           from 'path'
import { createHash, randomBytes } from 'crypto'
import { pathToFileURL, fileURLToPath } from 'url'

const __dirname       = path.dirname(fileURLToPath(import.meta.url))
const _componentsRoot = path.join(__dirname, '..', 'components')

/** Read the ore.vue mode from package.json ("dev" | "prod", defaults to "dev"). */
function _readVueMode() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'))
    return pkg?.ore?.vue === 'prod' ? 'prod' : 'dev'
  } catch {
    return 'dev'
  }
}

/** CDN URL for the browser-side Vue import. */
function _vueCdnUrl() {
  const mode = _readVueMode()
  return mode === 'prod'
    ? 'https://esm.sh/vue@3.4'
    : 'https://esm.sh/vue@3.4?dev'
}

/** Stable 8-char hash of an absolute file path — used as the Vue scope ID. */
const scopeId = sfcPath => createHash('sha256').update(sfcPath).digest('hex').slice(0, 8)

/**
 * Convert a PascalCase component name to the kebab-case folder name used
 * under components/.  Example: "SampleCounter" → "sample-counter".
 */
function compNameToFolderId(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

/**
 * Scan a raw template source string for PascalCase component tag names and
 * resolve each one to a components/<kebab>/index.vue path.
 * Only entries whose file actually exists are returned.
 *
 * @param  {string} templateSource  Raw <template> content
 * @returns {{ name: string, id: string, sfcPath: string }[]}
 */
function scanSubComponents(templateSource) {
  const re    = /<([A-Z][a-zA-Z0-9]*)/g
  const names = new Set()
  let m
  while ((m = re.exec(templateSource)) !== null) {
    names.add(m[1])
  }
  return [...names]
    .map(name => ({
      name,
      id:      compNameToFolderId(name),
      sfcPath: path.join(_componentsRoot, compNameToFolderId(name), 'index.vue'),
    }))
    .filter(({ sfcPath }) => fs.existsSync(sfcPath))
}

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

    // Discover sub-components referenced in this template
    const subComps = scanSubComponents(descriptor.template?.content ?? '')

    const renderFn   = await this.#compileTemplate(descriptor, sfcPath)
    const assignments = this.getAll()

    // Build the component: merge Ore assignments with anything the SFC's own
    // setup() returns (SFC wins on key conflicts so it can override if needed)
    const { setup: sfcSetup } = await this.#extractScriptOptions(descriptor, sfcPath)
    const component = {
      ssrRender: renderFn,
      async setup(props, ctx) {
        const oreData  = { ...assignments }
        const sfcData  = sfcSetup ? (await sfcSetup(props, ctx)) ?? {} : {}
        return { ...oreData, ...sfcData }
      }
    }

    const app = createSSRApp(component)

    // Register each resolved sub-component on the SSR app
    for (const sub of subComps) {
      const subComp = await this.#buildSubComponent(sub.sfcPath)
      app.component(sub.name, subComp)
    }

    const body = await renderToString(app)

    // Derive the component identifier (e.g. "test" or "index") from the path
    const rel         = path.relative(_componentsRoot, sfcPath)
    const componentId = rel.replace(/[/\\]index\.vue$/, '').replace(/\\/g, '/')

    // Unique per-render instance ID — shared between the SSR output and the
    // client hydration script so each instance mounts on the correct DOM node
    // and reads the correct state slice from window.__ORE_STATE__.
    const instanceId = randomBytes(6).toString('hex')

    return this.#document(body, descriptor, assignments, componentId, instanceId, subComps)
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
      id:       scopeId(sfcPath),
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
   * Extract setup() and props from the SFC's <script> or <script setup> block.
   * For <script setup>, compileScript() is used to produce an equivalent module.
   * The compiled code is written to a temp .mjs file and dynamically imported.
   *
   * @returns {Promise<{ setup: Function|null, props: object|null }>}
   */
  async #extractScriptOptions(descriptor, sfcPath) {
    let scriptContent = null

    if (descriptor.scriptSetup) {
      const compiled = compileScript(descriptor, { id: scopeId(sfcPath) })
      scriptContent = compiled.content
    } else if (descriptor.script) {
      scriptContent = descriptor.script.content
    }

    if (!scriptContent) return { setup: null, props: null }

    const tmpFile = sfcPath.replace('.vue', `.script.${Date.now()}.mjs`)
    fs.writeFileSync(tmpFile, scriptContent)
    try {
      const mod     = await import(pathToFileURL(tmpFile).href)
      const options = mod.default
      return {
        setup: typeof options?.setup === 'function' ? options.setup : null,
        props: options?.props ?? null,
      }
    } catch {
      return { setup: null, props: null }
    } finally {
      try { fs.unlinkSync(tmpFile) } catch { /* already cleaned up */ }
    }
  }

  /**
   * Build a full SSR-ready component object for a sub-component SFC.
   * Returns { ssrRender, setup?, props? } suitable for app.component().
   *
   * @param  {string} sfcPath  Absolute path to the sub-component's .vue file
   * @returns {Promise<object>}
   */
  async #buildSubComponent(sfcPath) {
    const source = fs.readFileSync(sfcPath, 'utf-8')
    const { descriptor } = parse(source)

    const ssrRender            = await this.#compileTemplate(descriptor, sfcPath)
    const { setup, props }     = await this.#extractScriptOptions(descriptor, sfcPath)

    return {
      ssrRender,
      ...(setup ? { setup } : {}),
      ...(props ? { props } : {}),
    }
  }

  /**
   * Compile a .vue SFC's template + script for the browser.
   * Returns an ES module string that exports:
   *   - named `render`  — for use as the top-level page component
   *   - default export  — full component { render, setup?, props? } for
   *                       sub-component registration via app.component()
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

    // Compile <script setup> / <script> if present
    let scriptContent = null
    if (descriptor.scriptSetup || descriptor.script) {
      const compiled = compileScript(descriptor, { id: scopeId(sfcPath) })
      scriptContent  = compiled.content
    }

    // Compile the template to a client-side render function
    const { code: templateCode, errors: tmplErrors } = compileTemplate({
      source:   descriptor.template.content,
      filename: sfcPath,
      id:       scopeId(sfcPath),
      ssr:      false,
    })

    if (tmplErrors.length) {
      throw new Error(`Template compile errors:\n${tmplErrors.map(e => e.message).join('\n')}`)
    }

    // If there is no script, just ship the render function
    if (!scriptContent || !scriptContent.includes('export default')) {
      return `${templateCode}\nexport default { render }`
    }

    // Transform the compiled script so its default export becomes a variable,
    // then merge the render function in before re-exporting everything.
    // `export default` can only appear once in a compiled SFC script block,
    // so a simple string replace is reliable here.
    const scriptWithoutExport = scriptContent.replace(/export default\s+/, 'const __sfc__ = ')

    return `${scriptWithoutExport}\n${templateCode}\nexport default Object.assign(__sfc__, { render })`
  }

  /** Wrap SSR body in a full HTML document. */
  #document(body, descriptor, assignments, componentId, instanceId, subComps = []) {
    const styles = descriptor.styles.map(s => `<style>${s.content}</style>`).join('\n')
    const state  = JSON.stringify(assignments)

    // Build sub-component import + registration lines for the hydration script
    const subImports = subComps
      .map(s => `import ${s.name} from '/ore/component.js?c=${encodeURIComponent(s.id)}'`)
      .join('\n')
    const subRegistrations = subComps
      .map(s => `app.component('${s.name}', ${s.name})`)
      .join('\n')

    const hydration = `<script type="importmap">
{"imports":{"vue":"${_vueCdnUrl()}"}}
</script>
<script type="module">
import { createSSRApp, reactive } from 'vue'
import { render } from '/ore/component.js?c=${encodeURIComponent(componentId)}'
${subImports}
const state = reactive((window.__ORE_STATE__ || {})['${instanceId}'] || {})
const app = createSSRApp({ render, setup() { return state } })
${subRegistrations}
app.mount('#ore-${instanceId}')
</script>`

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="/css/main.css">
  ${styles}
  <script>window.__ORE_STATE__ = window.__ORE_STATE__ || {}; window.__ORE_STATE__['${instanceId}'] = ${state};</script>
  ${hydration}
</head>
<body>
  <div id="ore-${instanceId}">${body}</div>
</body>
</html>`
  }
}

export default Vue
