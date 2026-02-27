/**
 * Router
 *
 * Maps an incoming HTTP URL to a component directory under /components/.
 *
 *   GET /test  →  components/test/index.js  (logic, Ore.vue.assign calls)
 *               →  components/test/index.vue (template, SSR-rendered)
 *
 * The component JS module must export an async function that receives
 * (req, res) and uses Ore.vue.assign() to populate template data.
 *
 *   export default async function (req, res) {
 *     Ore.vue.assign('title', 'Hello')
 *   }
 */

import fs   from 'fs'
import path from 'path'
import url  from 'url'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

class Router {
  constructor() {
    this.componentsRoot = path.join(__dirname, '..', 'components')
  }

  async route(req, res) {
    const parsed  = url.parse(req.url)
    let   urlPath = parsed.pathname

    // Normalise: strip trailing slash, treat bare "/" as "/index"
    if (urlPath === '/') urlPath = '/index'
    urlPath = urlPath.replace(/\/$/, '')

    const componentDir = path.join(this.componentsRoot, urlPath)
    const componentJs  = path.join(componentDir, 'index.js')
    const componentVue = path.join(componentDir, 'index.vue')

    if (!fs.existsSync(componentJs)) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(this.#errorPage(404, 'Component not found', `No component for route: ${urlPath}`))
      return
    }

    // Fresh assignments per request
    Ore.vue.reset()

    try {
      // Dynamic import with cache-busting query string so the component
      // logic always re-runs fresh (ESM caches by URL including query)
      const moduleUrl = pathToFileURL(componentJs).href + '?t=' + Date.now()
      const { default: handler } = await import(moduleUrl)

      if (typeof handler === 'function') {
        await handler(req, res)
      } else if (handler && typeof handler.handle === 'function') {
        await handler.handle(req, res)
      }

      const html = await Ore.vue.render(componentVue)

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(html)
    } catch (err) {
      console.error(`[Router] Error on ${urlPath}:`, err)
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(this.#errorPage(500, 'Internal Server Error', err.message))
    }
  }

  #errorPage(code, title, detail) {
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>${code} ${title}</title>
<style>body{font-family:sans-serif;padding:2rem;color:#333}pre{background:#f5f5f5;padding:1rem;border-radius:4px}</style>
</head><body>
<h1>${code} — ${title}</h1><pre>${detail}</pre>
</body></html>`
  }
}

export default Router
