// THE ELEMENT'S ENVIRONMENT IS LIVE (node step 869; the owner, 2026-11-28, Telegram 1861: «сделай так чтобы все переменные окружение
// запускались без нового развёртывания тогда когда это возможно»).
//
// ✗ Measured 2026-11-28 on fractera.ai: the node's screen wrote STRIPE_WEBHOOK_SECRET into the element's `.env.local`, the webhook went on
// answering 503 no_webhook_secret, a restart did not help — only a deploy did. The live server runs from `.next-a|b/standalone`, and Next
// loads the copy of `.env.local` that the build put there; the element's own file (ELEMENT_DIR) was never read again.
//
// 🔒 THE FILE OF THE ELEMENT IS THE TRUTH. `refreshEnv()` reads ELEMENT_DIR/.env.local and brings process.env to it: changed values are
// set, a variable removed from the file is removed. It is cheap (one stat; the file is parsed only when its time or size changed), so a
// key that matters reads through `liveEnv(name)`. `startLiveEnv()` (instrumentation.ts) applies the file once at start and watches the
// element's folder — an event of the file system, no timer, no polling — so every `process.env.X` read at CALL time is live too.
// 🛑 NOT LIVE, by the nature of Next: NEXT_PUBLIC_* are baked into the build (a deploy is needed and the key screens say so), and a value
// copied into a module-scope constant at load (the prebuild guard scripts/check-live-env.mjs refuses such a read). PORT, HOSTNAME and
// NODE_ENV belong to the node's process manager and are never touched. Values are never printed — only names.
import { readFileSync, statSync, watch } from 'node:fs'
import { join, resolve } from 'node:path'

/** Names the file never overrides: the node's process manager owns them, or the build baked them. */
export const FIXED = /^(NODE_ENV|PORT|HOSTNAME|ELEMENT_DIR|NEXT_PUBLIC_.*|NEXT_.*|__NEXT.*)$/

export function envFile() {
  return join(resolve(process.env.ELEMENT_DIR?.trim() || process.cwd()), '.env.local')
}

/** KEY=VALUE lines of a dotenv file; `export ` prefix, comments, blank lines and quotes handled like Next's loader for plain values. */
export function parseEnv(text) {
  const out = new Map()
  for (const raw of String(text).split(/\r?\n/)) {
    const m = raw.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    const q = v[0]
    if ((q === '"' || q === "'") && v.length > 1 && v.endsWith(q)) v = v.slice(1, -1)
    else v = v.replace(/\s+#.*$/, '')
    if (q === '"') v = v.replace(/\\n/g, '\n')
    out.set(m[1], v)
  }
  return out
}

const state = { stamp: '', owned: new Set() }

/**
 * Bring `env` to the element's file. Returns the names that changed (never values). A missing file changes nothing: an element
 * without one lives on the environment it was started with.
 */
export function refreshEnv({ file = envFile(), env = process.env, memo = state } = {}) {
  let st
  try { st = statSync(file) } catch { return { changed: [] } }
  const stamp = `${st.mtimeMs}:${st.size}`
  if (stamp === memo.stamp) return { changed: [] }
  let text
  try { text = readFileSync(file, 'utf8') } catch { return { changed: [] } }
  memo.stamp = stamp
  const vars = parseEnv(text)
  const changed = []
  for (const [k, v] of vars) {
    if (FIXED.test(k)) continue
    memo.owned.add(k)
    if (env[k] !== v) { env[k] = v; changed.push(k) }
  }
  for (const k of [...memo.owned]) {
    if (vars.has(k)) continue
    memo.owned.delete(k)
    if (k in env) { delete env[k]; changed.push(k) }
  }
  return { changed }
}

/** One variable, read fresh: the file is checked first (one stat). */
export function liveEnv(name) {
  refreshEnv()
  return process.env[name]
}

let watching = null

/** Apply the file now and follow it: a folder watch (the screens replace the file by a rename), events gathered for 150 ms. */
export function startLiveEnv() {
  const first = refreshEnv()
  if (first.changed.length) console.log(`[env] the element's .env.local applied: ${first.changed.join(', ')}`)
  if (watching) return
  const file = envFile()
  const dir = resolve(file, '..')
  let pending = null
  try {
    watching = watch(dir, { persistent: false }, (_event, name) => {
      if (name && !String(name).startsWith('.env')) return
      if (pending) return
      pending = setTimeout(() => {
        pending = null
        const r = refreshEnv({ file })
        if (r.changed.length) console.log(`[env] live without a deploy: ${r.changed.join(', ')}`)
      }, 150)
      pending.unref?.()
    })
    watching.on('error', () => { watching = null })
  } catch (e) {
    console.warn(`[env] cannot watch ${dir}: ${e?.message ?? e} — keys read through liveEnv() stay live, other variables wait for a restart`)
  }
}
