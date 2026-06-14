import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Guard against module-relative import paths that 404 in the browser (e.g. a file
// in js/ importing './vendor/...' which resolves to js/vendor/... instead of
// ../vendor/...). Every relative specifier in every public/js module must point
// at a file that actually exists, resolved from that module's own directory.
const here = dirname(fileURLToPath(import.meta.url))

test('every relative import in public/js resolves to an existing file', () => {
  const files = readdirSync(here).filter(f => f.endsWith('.js') && !f.endsWith('.test.js'))
  const bad = []
  for (const f of files) {
    const src = readFileSync(resolve(here, f), 'utf8')
    // Match static `import ... from '<spec>'` and side-effect `import '<spec>'`.
    const re = /\bfrom\s+'([^']+)'|\bimport\s+'([^']+)'/g
    let m
    while ((m = re.exec(src))) {
      const spec = m[1] || m[2]
      if (!spec.startsWith('.')) continue            // bare specifiers (e.g. 'three') resolve via importmap
      const target = resolve(here, dirname(f), spec)
      if (!existsSync(target)) bad.push(`${f} → ${spec}`)
    }
  }
  assert.deepEqual(bad, [], `unresolved relative imports:\n${bad.join('\n')}`)
})
