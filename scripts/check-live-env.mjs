// GUARD: a variable of the environment is read at CALL time (node step 869, lib/live-env.mjs). The element's .env.local is applied to the
// live process when a screen changes it — but a value copied into a module-scope constant at load stays the old one until a deploy.
// Refused: a top-level `const|let|var … = … process.env.NAME …` that is not inside an arrow function. Allowed at module scope: NEXT_PUBLIC_*
// (baked by the build anyway), NODE_ENV, NEXT_RUNTIME, NEXT_PHASE, and paths fixed by the element's folder (*_PATH, *_DIR, *_FILE).
// Fix: wrap it — `const secret = () => process.env.NAME ?? ""` — and call it where it is used.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const DIRS = ['app', 'lib', 'components', 'config', 'providers', 'services', '_tools']
const FILES = ['proxy.ts', 'instrumentation.ts']
const SKIP = new Set(['node_modules', '.git'])
const ALLOWED = /^(NEXT_PUBLIC_.*|NODE_ENV|NEXT_RUNTIME|NEXT_PHASE|.*_(PATH|DIR|FILE))$/
const TOP = /^(?:export\s+)?(?:const|let|var)\s[^=]*=(.*)$/

function* walk(dir) {
  let names
  try { names = readdirSync(dir) } catch { return }
  for (const n of names) {
    if (SKIP.has(n) || n.startsWith('.next')) continue
    const p = join(dir, n)
    if (statSync(p).isDirectory()) yield* walk(p)
    else if (/\.(ts|tsx|mjs|js|cjs)$/.test(n) && !/\.test\.|\.d\.ts$/.test(n)) yield p
  }
}

const bad = []
const files = [...DIRS.flatMap((d) => [...walk(join(ROOT, d))]), ...FILES.map((f) => join(ROOT, f))]
for (const file of files) {
  let text
  try { text = readFileSync(file, 'utf8') } catch { continue }
  text.split(/\r?\n/).forEach((line, i) => {
    const m = line.match(TOP)
    if (!m) return
    const rhs = m[1]
    const at = rhs.indexOf('process.env')
    if (at < 0) return
    const arrow = rhs.indexOf('=>')
    if (arrow >= 0 && arrow < at) return
    for (const r of rhs.matchAll(/process\.env(?:\.([A-Z0-9_]+)|\[["'`]([A-Z0-9_]+)["'`]\])/g)) {
      const name = r[1] ?? r[2]
      if (!ALLOWED.test(name)) bad.push(`${relative(ROOT, file)}:${i + 1}  ${name}`)
    }
  })
}

if (bad.length) {
  console.error('===CHECK_LIVE_ENV_FAILED=== a module-scope constant keeps a variable from its load — a key saved on a screen would not be seen until a deploy:')
  for (const b of bad) console.error(`  ${b}`)
  console.error('Fix: read it inside the function that uses it, or wrap it: const value = () => process.env.NAME ?? "" (lib/live-env.mjs, node step 869).')
  process.exit(1)
}
console.log(`===CHECK_LIVE_ENV_OK=== ${files.length} files: every variable is read at call time`)
