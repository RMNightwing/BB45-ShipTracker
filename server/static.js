import { createServer as httpServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, normalize, join, extname } from 'node:path'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
}

export function createServer(rootDir) {
  const root = resolve(rootDir)
  return httpServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname)
      const rel = normalize(urlPath).replace(/^(\.\.[/\\])+/, '')
      let filePath = join(root, rel)
      if (!filePath.startsWith(root)) { res.writeHead(403).end('forbidden'); return }
      if (urlPath.endsWith('/')) filePath = join(filePath, 'index.html')
      const body = await readFile(filePath)
      res.writeHead(200, { 'content-type': MIME[extname(filePath)] || 'application/octet-stream' })
      res.end(body)
    } catch {
      res.writeHead(404).end('not found')
    }
  })
}

// Run directly: `node server/static.js`
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT) || 5173
  createServer('public').listen(port, () => {
    console.log(`BB45 dev server: http://localhost:${port}`)
  })
}
