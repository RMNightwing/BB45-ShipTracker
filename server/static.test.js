import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from './static.js'

const server = createServer('public')
await new Promise(res => server.listen(0, res))
const port = server.address().port
const base = `http://127.0.0.1:${port}`
after(() => server.close())

test('serves index.html as text/html', async () => {
  const r = await fetch(`${base}/`)
  assert.equal(r.status, 200)
  assert.match(r.headers.get('content-type'), /text\/html/)
})

test('serves js with javascript MIME', async () => {
  const r = await fetch(`${base}/js/config.js`)
  assert.equal(r.status, 200)
  assert.match(r.headers.get('content-type'), /javascript/)
})

test('blocks path traversal', async () => {
  const r = await fetch(`${base}/../package.json`)
  assert.ok(r.status === 403 || r.status === 404)
})

test('404 for missing files', async () => {
  const r = await fetch(`${base}/nope.js`)
  assert.equal(r.status, 404)
})
