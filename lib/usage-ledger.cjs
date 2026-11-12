// THE LEDGER OF OUTSIDE CALLS (step 726-1). Every call the node pays for writes ONE line, at the moment of the call, with no model:
// who called, which provider and endpoint, which model, the answer's status, the tokens it cost, and — on a refusal — the provider's
// own reason, code and message. `npm run money` reads it.
//
// Why: the owner, 2026-11-11, verbatim: «тебя обвинили в избыточном поведении а твой ответ заключается в следующем я понятия не имею
// какие элементы или для каких целей используют апи. Блин согласись это прям офигенно узкое место?» — and on the method: «может быть
// какая-то таблица обращений?». A journal written at the call costs nothing; a poll of every provider costs a call each time.
//
// 🔒 WHAT A LINE NEVER HOLDS: a key, a prompt, an answer, a person's words or data (`use-personal-data`). A line is built from a closed
// list of fields (`FIELDS`); anything else given to `record` is dropped, so a careless caller cannot leak a prompt into the file.
// 🔒 WHERE: `data/node/usage/<YYYY-MM-DD>.jsonl` of the process that calls — outside git (`data/*`), one file a day (UTC). An ELEMENT's
// process writes `<SERVICE_DATA_DIR>/usage/<day>.jsonl` instead (step 735 B1b): it runs as a Next standalone server that moves into its
// build folder, so its lines landed there, died with every rebuild, and no reader of the core ever saw them. The installer gives every
// element `data/services/<id>` (absolute, outside its build); the core's own process has no SERVICE_DATA_DIR and keeps `data/node/usage/`.
// The core reads them all: `ledgers(root)` — its own and every `data/services/<id>/usage/`.
// 🔒 WHAT IS COUNTED: calls that cost money (OpenAI today). Free calls (Telegram, GitHub, Cloudflare) are not — they would bury the
// paid lines; a new paid provider joins by calling `record` with its own name.
// 🔒 A LEDGER NEVER BREAKS THE CALL: every write is try/catch — a full disk loses a line, never the person's answer.
//
// CommonJS for the same reason as `lib/openai-error.cjs`: the agent kit carries a byte-identical copy `core/server/usage-ledger.cjs`
// (the guard `check:openai-calls` compares them). Edit HERE, then `cp` into the kit master and update the copies.

const { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } = require('node:fs')
const path = require('node:path')

const FIELDS = ['who', 'provider', 'endpoint', 'model', 'status', 'ok', 'reason', 'code', 'message', 'tokensIn', 'tokensOut', 'ms']

const own = () => (process.env.SERVICE_DATA_DIR || '').trim()
/** The ledger folder: `root`'s `data/node/usage`; with no root — an element's `<SERVICE_DATA_DIR>/usage`, else the process folder's. */
const dir = (root) => (root ? path.join(root, 'data', 'node', 'usage') : own() ? path.join(own(), 'usage') : path.join(process.cwd(), 'data', 'node', 'usage'))
const dayOf = (d) => d.toISOString().slice(0, 10)

function clean(line) {
  const out = {}
  for (const k of FIELDS) {
    const v = line[k]
    if (v === undefined || v === null || v === '') continue
    if (typeof v === 'number') { if (Number.isFinite(v)) out[k] = Math.round(v) }
    else if (typeof v === 'boolean') out[k] = v
    else out[k] = String(v).slice(0, k === 'message' ? 300 : 80)
  }
  return out
}

/**
 * Append one line; never throws. `root` — the folder whose `data/` holds the ledger (default: the process's folder).
 * @param {Record<string, unknown>} line
 * @param {string} [root]
 */
function record(line, root) {
  try {
    const now = new Date()
    const d = dir(root)
    mkdirSync(d, { recursive: true })
    appendFileSync(path.join(d, `${dayOf(now)}.jsonl`), `${JSON.stringify({ at: now.toISOString(), ...clean(line) })}\n`)
  } catch { /* a lost line, never a lost answer */ }
}

/** Tokens from any shape the node meets: OpenAI chat (`prompt_tokens`), transcription and Responses (`input_tokens`), the AI SDK. */
function tokensOf(usage) {
  const u = usage && typeof usage === 'object' ? usage : {}
  const tokensIn = u.prompt_tokens ?? u.input_tokens ?? u.inputTokens
  const tokensOut = u.completion_tokens ?? u.output_tokens ?? u.outputTokens
  return { tokensIn: typeof tokensIn === 'number' ? tokensIn : undefined, tokensOut: typeof tokensOut === 'number' ? tokensOut : undefined }
}

/**
 * @typedef {{ who: string, provider?: string, endpoint: string, model?: string, started?: number }} Call
 */

/**
 * A call that succeeded. `usage` — the provider's usage object, if it gave one. `started` — Date.now() before the call.
 * @param {Call & { status?: number, usage?: unknown }} call
 * @param {string} [root]
 */
function recordOk({ who, provider = 'openai', endpoint, model, status = 200, usage, started }, root) {
  record({ who, provider, endpoint, model, status, ok: true, ...tokensOf(usage), ms: started ? Date.now() - started : undefined }, root)
}

/**
 * A call the provider refused or that never reached it — `info` from the reader (`readOpenAiResponse`, `readOpenAiException`).
 * @param {Call & { info?: { status?: number, reason?: string, code?: string, message?: string } }} call
 * @param {string} [root]
 */
function recordRefusal({ who, provider = 'openai', endpoint, model, info, started }, root) {
  record({
    who, provider, endpoint, model, ok: false,
    status: info && info.status, reason: info && info.reason, code: info && info.code, message: info && info.message,
    ms: started ? Date.now() - started : undefined,
  }, root)
}

/** The lines of one day (`YYYY-MM-DD`, default today UTC) in a ledger FOLDER; a broken line is skipped. */
function readDayAt(day, ledgerDir) {
  const f = path.join(ledgerDir, `${day || dayOf(new Date())}.jsonl`)
  if (!existsSync(f)) return []
  return readFileSync(f, 'utf8').split('\n').filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)] } catch { return [] } })
}

/** The days a ledger FOLDER holds, newest first. */
function daysAt(ledgerDir) {
  try { return readdirSync(ledgerDir).filter((n) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(n)).map((n) => n.slice(0, 10)).sort().reverse() } catch { return [] }
}

/** The lines of one day of `root`'s ledger (the rule of `dir`). */
const readDay = (day, root) => readDayAt(day, dir(root))
/** The days `root`'s ledger holds, newest first. */
const days = (root) => daysAt(dir(root))

/** Every ledger of the node at `root` (the core's folder): the core's own (`id` null) and each element's `data/services/<id>/usage/`. */
function ledgers(root) {
  const base = root || process.cwd()
  const out = [{ id: null, dir: path.join(base, 'data', 'node', 'usage') }]
  try {
    for (const id of readdirSync(path.join(base, 'data', 'services')).sort()) {
      const d = path.join(base, 'data', 'services', id, 'usage')
      if (existsSync(d)) out.push({ id, dir: d })
    }
  } catch { /* no element has data yet */ }
  return out
}

module.exports = { record, recordOk, recordRefusal, readDay, days, readDayAt, daysAt, ledgers, tokensOf, FIELDS }
