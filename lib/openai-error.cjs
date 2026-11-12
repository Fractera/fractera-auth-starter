// ONE READER OF OPENAI'S ERRORS (step 726-0). Every call of the node to api.openai.com reads a refusal HERE, and nowhere else.
//
// Why: on 2026-11-11 the voice field showed only a red mark — OpenAI answered 429 `credit_balance_exhausted` («no credits
// remaining»), and the translate door, which knew only the older `insufficient_quota`, called it a rate limit and told the person to
// wait. Twenty files called OpenAI directly, each reading the error its own way or not at all. The owner, verbatim: «Так значит надо
// было вывести правильную ошибку разве ты не можешь получить все виды ошибок и показать нужную?»
//
// 🔒 THE LIST IS OPENAI'S, READ AT THE PRIMARY SOURCE, NEVER FROM MEMORY — the error-codes guide,
// https://developers.openai.com/api/docs/guides/error-codes (read 2026-11-12). It says: billing errors are told apart by
// `error.code`, while `error.type` may still be `insufficient_quota`; «retrying billing, spend, or quota errors won't restore API
// access». Codes the guide does NOT name (a model id that is gone, a context too long) are read by the HTTP status alone, as the
// SDK's own error classes do (404 NotFound, 403 PermissionDenied, 400 BadRequest, 422 Unprocessable) — never by a remembered code.
//
// 🔒 A REASON IS ONE THING THE PERSON CAN DO. Two refusals that ask for the same action share a reason; two that ask for different
// actions never do. The words for the person live in the dictionary `lib/i18n/openai-error.i18n.json` (texts only through
// translations); `hint` here is English for the node's log and the ledger.
//
// 🔒 CommonJS ON PURPOSE: the agent kit (`.cjs`, copied into every element group and living without the core) carries a byte-identical
// copy `core/server/openai-error.cjs`; the guard `check:openai-calls` compares the two and refuses a direct call that bypasses the
// reader. Edit HERE, then `cp` into the kit master and `npm run agent-kit:update` for the copies.

const BILLING = 'https://platform.openai.com/settings/organization/billing'
const LIMITS = 'https://platform.openai.com/settings/organization/limits'
const KEYS = 'https://platform.openai.com/settings/organization/api-keys'
const IP_ALLOWLIST = 'https://platform.openai.com/settings/organization/security/ip-allowlist'
const PROJECT = 'https://platform.openai.com/settings/'
const RATE_GUIDE = 'https://developers.openai.com/api/docs/guides/rate-limits'
const COUNTRIES = 'https://developers.openai.com/api/docs/supported-countries'
const STATUS = 'https://status.openai.com/'

/** reason → { link, retry, hint }. `retry` — whether waiting and trying again can help at all. */
const REASONS = {
  'no-key': { link: KEYS, retry: false, hint: 'the node has no OpenAI key' },
  'bad-key': { link: KEYS, retry: false, hint: 'OpenAI did not accept the key (wrong, revoked, or of another organization or project)' },
  'ip-blocked': { link: IP_ALLOWLIST, retry: false, hint: "this computer's IP is not on the organization's or project's IP allowlist" },
  region: { link: COUNTRIES, retry: false, hint: 'OpenAI does not serve the country, region or territory this computer calls from' },
  'no-funds': { link: BILLING, retry: false, hint: 'the OpenAI account has no prepaid credits left' },
  'spend-limit': { link: LIMITS, retry: false, hint: 'the spend limit set for the organization or the project is reached' },
  'usage-limit': { link: LIMITS, retry: false, hint: "the organization reached OpenAI's assigned usage limit" },
  'rate-limit': { link: RATE_GUIDE, retry: true, hint: 'too many requests too fast — OpenAI asks to slow down' },
  overloaded: { link: STATUS, retry: true, hint: 'the model is temporarily overloaded at OpenAI' },
  server: { link: STATUS, retry: true, hint: 'OpenAI had an error on its own servers' },
  'not-found': { link: null, retry: false, hint: 'OpenAI does not know the model or the resource asked for' },
  forbidden: { link: KEYS, retry: false, hint: 'the key has no permission for this model or endpoint' },
  'bad-request': { link: null, retry: false, hint: "OpenAI refused the request itself (OpenAI's message says what)" },
  unreachable: { link: STATUS, retry: true, hint: 'the node could not reach OpenAI (network, proxy or firewall)' },
  timeout: { link: STATUS, retry: true, hint: 'OpenAI did not answer in time' },
  upstream: { link: STATUS, retry: true, hint: 'OpenAI answered with an error the guide does not name' },
}

/** Hide what must never reach a log, a page or the ledger: the organization id and any key fragment. */
function hideSecrets(text) {
  return String(text ?? '')
    .replace(/org-[A-Za-z0-9]+/g, 'org-…')
    .replace(/proj_[A-Za-z0-9]+/g, 'proj_…')
    .replace(/sk-[A-Za-z0-9_*-]+/g, 'sk-…')
    .slice(0, 300)
}

/**
 * Read one refusal: the HTTP status and OpenAI's body (`{ error: { code, type, message } }`, already parsed, or null).
 * Returns { reason, status, code, type, message, link, retry, hint } — the message with secrets hidden.
 */
function readOpenAiError(status, body) {
  const e = (body && typeof body === 'object' && body.error && typeof body.error === 'object') ? body.error : {}
  const code = typeof e.code === 'string' ? e.code : ''
  const type = typeof e.type === 'string' ? e.type : ''
  const message = hideSecrets(e.message)
  let reason
  if (code === 'credit_balance_exhausted' || code === 'insufficient_quota' || (type === 'insufficient_quota' && !/_limit_exceeded$/.test(code))) reason = 'no-funds'
  else if (code === 'organization_spend_limit_exceeded' || code === 'project_spend_limit_exceeded') reason = 'spend-limit'
  else if (code === 'organization_usage_limit_exceeded') reason = 'usage-limit'
  else if (code === 'server_is_overloaded' || status === 503) reason = 'overloaded'
  else if (status === 401) reason = /\bIP\b/.test(message) ? 'ip-blocked' : 'bad-key'
  else if (status === 403) reason = /countr|region|territor/i.test(message) ? 'region' : 'forbidden'
  else if (status === 429) reason = 'rate-limit'
  else if (status === 404) reason = 'not-found'
  else if (status === 400 || status === 413 || status === 422) reason = 'bad-request'
  else if (status >= 500) reason = 'server'
  else reason = 'upstream'
  const r = REASONS[reason]
  // The spend limit of a PROJECT lives in the project's settings, not the organization's limits page (the guide's own link).
  const link = code === 'project_spend_limit_exceeded' ? PROJECT : r.link
  return { reason, status, code, type, message, link, retry: r.retry, hint: r.hint }
}

/** Read a failed fetch Response (consumes its body). */
async function readOpenAiResponse(res) {
  let body = null
  try { body = await res.json() } catch { body = null }
  return readOpenAiError(res.status, body)
}

/** Read a thrown exception of fetch: a timeout or the network. */
function readOpenAiException(err) {
  const name = String(err && err.name)
  const reason = name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'unreachable'
  const r = REASONS[reason]
  return { reason, status: 0, code: '', type: '', message: hideSecrets(err && err.message), link: r.link, retry: r.retry, hint: r.hint }
}

/**
 * Read an error thrown by the AI SDK (`generateText` and friends) — read by shape, so this file needs no import of `ai`:
 * `AI_RetryError` carries the last attempt in `lastError`; `AI_APICallError` carries `statusCode` and `responseBody` (a string)
 * (node_modules/ai/docs/07-reference/05-ai-sdk-errors, measured 2026-11-12). Anything else is a timeout or the network.
 */
function readOpenAiSdkError(err) {
  const e = err && typeof err === 'object' && err.lastError ? err.lastError : err
  if (e && typeof e === 'object' && typeof e.statusCode === 'number') {
    let body = null
    try { body = typeof e.responseBody === 'string' ? JSON.parse(e.responseBody) : null } catch { body = null }
    return readOpenAiError(e.statusCode, body)
  }
  return readOpenAiException(e)
}

/** One line into the node's log: where, the reason, OpenAI's own code and message (secrets hidden). Never the key, never the prompt. */
function logOpenAiError(where, info) {
  console.error(`[openai] ${where}: ${info.reason} (HTTP ${info.status}${info.code ? ` ${info.code}` : ''}${info.type && info.type !== info.code ? `/${info.type}` : ''}) ${info.message}`)
}

/** The reason named when there is no key at all — the same shape as a refusal, so a caller has one path. */
function noKey() {
  const r = REASONS['no-key']
  return { reason: 'no-key', status: 0, code: '', type: '', message: '', link: r.link, retry: false, hint: r.hint }
}

module.exports = { REASONS, readOpenAiError, readOpenAiResponse, readOpenAiException, readOpenAiSdkError, logOpenAiError, noKey, hideSecrets }
