/**
 * Ore — HTTP server entry point.
 *
 * Start:  node www/index.js
 * Dev:    node --watch www/index.js
 *
 * Requests are handled in two stages:
 *   1. Static files  (/css/*, /images/*)  → served directly from www/
 *   2. Everything else                    → routed through Ore.router
 */

// Initialise the global Ore singleton (sets global.Ore)
import '../classes/Ore.js'

import http from 'http'
import fs   from 'fs'
import path from 'path'
import mime from 'mime-types'
import { fileURLToPath } from 'url'

const __dirname  = path.dirname(fileURLToPath(import.meta.url))
const PORT       = Number(process.env.PORT) || 3000
const STATIC_DIR = __dirname

// URL prefixes that are served as plain static files
const STATIC_PREFIXES = ['/css/', '/images/']

// ── Server ─────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0]

  // ── Static file handling ─────────────────────────────────────────────────
  if (STATIC_PREFIXES.some(p => urlPath.startsWith(p))) {
    const filePath = path.join(STATIC_DIR, urlPath)

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const mimeType = mime.lookup(filePath) || 'application/octet-stream'
      res.writeHead(200, { 'Content-Type': mimeType })
      fs.createReadStream(filePath).pipe(res)
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not Found')
    }
    return
  }

  // ── Component routing ─────────────────────────────────────────────────────
  await Ore.router.route(req, res)
})

server.listen(PORT, () => {
  console.log(`[Ore] Server running → http://localhost:${PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', shutdown)
process.on('SIGINT',  shutdown)

async function shutdown() {
  console.log('[Ore] Shutting down …')
  server.close()
  if (Ore._db) await Ore.db.disconnect()
  process.exit(0)
}
