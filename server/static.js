import { createServer as httpServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, normalize, join, extname, sep } from 'node:path'

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
      let filePath = join(root, normalize(urlPath))
      // Reject anything that resolves outside root (separator boundary, not bare prefix).
      if (filePath !== root && !filePath.startsWith(root + sep)) { res.writeHead(403).end('forbidden'); return }
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
