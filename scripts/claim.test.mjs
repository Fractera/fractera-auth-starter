// THE ARCHITECT'S CLAIM (node steps 739-1, 796-1): `node scripts/claim.test.mjs`. The claim module itself (`lib/auth/claim.ts`, Node strips its
// types) against a real better-sqlite3 database in a temporary folder.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'

const dir = mkdtempSync(join(tmpdir(), 'claim-'))
process.env.CLAIM_DIR = dir
const c = await import('../lib/auth/claim.ts')
const db = new Database(join(dir, 'auth.db'))
db.exec("CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, app TEXT DEFAULT 'node')")
let passed = 0
const t = (name, fn) => { fn(); passed += 1; console.log(`  ✓ ${name}`) }

t('negative: no claim (a computer) — nothing is pending, the first account is made as before', () => {
  assert.equal(c.claimPending(db), false)
  assert.equal(c.claimMatches('ANYTHING'), false)
})
const code = c.issueClaim()
t('a claim: a 12-character code shown as XXXX-XXXX-XXXX; only its hash is kept', () => {
  assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
  const kept = readFileSync(join(dir, 'claim.json'), 'utf8')
  assert.ok(!kept.includes(code.replace(/-/g, '')) && /"hash":"[0-9a-f]{64}"/.test(kept))
  assert.equal(c.claimPending(db), true)
})
t('negative: a missing or wrong code is refused; the right one in any case and with spaces matches', () => {
  assert.equal(c.claimMatches(''), false)
  assert.equal(c.claimMatches('AAAA-BBBB-CCCC'), false)
  assert.equal(c.claimMatches(` ${code.toLowerCase().replace(/-/g, ' ')} `), true)
})
t('a new code replaces the old one', () => {
  const second = c.issueClaim()
  assert.equal(c.claimMatches(code), false)
  assert.equal(c.claimMatches(second), true)
})
t('the first account ends the claim: nothing pending, the file gone; a factory app\'s accounts never count', () => {
  db.prepare("INSERT INTO users (id, email, app) VALUES ('f1', 'x@app', 'shop')").run()
  assert.equal(c.claimPending(db), true)
  db.prepare("INSERT INTO users (id, email, app) VALUES ('n1', 'a@b.c', 'node')").run()
  assert.equal(c.claimPending(db), false)
  c.endClaim()
  assert.ok(!readdirSync(dir).includes('claim.json'))
})
t('register.ts and the adapter call the claim before the first account (both doors)', () => {
  const reg = readFileSync(new URL('../lib/auth/register.ts', import.meta.url), 'utf8')
  const ad = readFileSync(new URL('../lib/auth/sqlite-adapter.ts', import.meta.url), 'utf8')
  assert.ok(/firstAccountGate\(db, isFirst, normalizedEmail, code\)/.test(reg) && /if \(!gate\.ok\) return/.test(reg) && /if \(claimed\) endClaim\(\)/.test(reg))
  assert.ok(/if \(isFirst && claimPending\(db\)\) throw/.test(ad))
})

console.log('796-1 the architect is claimed by e-mail')
db.exec('DELETE FROM users')
c.endClaim()
// What register.ts does with the gate, against the same database: the first node account is the architect, the rest are users.
const register = (email, code = '') => {
  const isFirst = !db.prepare("SELECT id FROM users WHERE app = 'node' LIMIT 1").get()
  const g = c.firstAccountGate(db, isFirst, email.trim().toLowerCase(), code)
  if (!g.ok) return { success: false, error: g.error }
  const roles = isFirst ? ['architect'] : ['user']
  db.prepare("INSERT INTO users (id, email, app) VALUES (?, ?, 'node')").run(`u${Math.random()}`, email.trim().toLowerCase())
  if (g.claimed) c.endClaim()
  return { success: true, roles }
}
t('no claim (a computer): the first account is the architect, the second an ordinary user', () => {
  assert.deepEqual(c.claimStatus(db), { pending: false, kind: null, claimed: false })
  assert.deepEqual(register('first@pc.local'), { success: true, roles: ['architect'] })
  assert.deepEqual(register('second@pc.local'), { success: true, roles: ['user'] })
  assert.deepEqual(c.claimStatus(db), { pending: false, kind: null, claimed: true })
})
db.exec('DELETE FROM users')
t('an e-mail claim keeps only the SHA-256 of the trimmed lower-cased e-mail; bad values are refused', () => {
  assert.equal(c.issueEmailClaim('not-an-email'), false)
  assert.equal(c.issueEmailClaim(''), false)
  assert.equal(c.issueEmailClaim('  Boss@Example.COM '), true)
  const kept = readFileSync(join(dir, 'claim.json'), 'utf8')
  assert.ok(!/boss|example/i.test(kept))
  assert.equal(JSON.parse(kept).hash, createHash('sha256').update('boss@example.com').digest('hex'))
  assert.equal(JSON.parse(kept).kind, 'email')
})
t('GET answers { pending, kind, claimed } and never the e-mail or the hash', () => {
  const st = c.claimStatus(db)
  assert.deepEqual(st, { pending: true, kind: 'email', claimed: false })
  const hash = JSON.parse(readFileSync(join(dir, 'claim.json'), 'utf8')).hash
  const out = JSON.stringify({ ok: true, ...st })
  assert.ok(!out.includes(hash) && !/boss|example|@/i.test(out))
  const route = readFileSync(new URL('../app/api/claim/route.ts', import.meta.url), 'utf8')
  assert.ok(/return json\(\{ ok: true, \.\.\.claimStatus\(getDb\(\)\) \}\)/.test(route))
})
t('negative: an e-mail claim refuses another e-mail and any code; nothing is written, the claim still waits', () => {
  assert.deepEqual(register('stranger@example.com'), { success: false, error: 'claim-email' })
  assert.equal(c.claimMatches('AAAA-BBBB-CCCC'), false)
  assert.equal(db.prepare('SELECT COUNT(*) n FROM users').get().n, 0)
  assert.equal(c.claimStatus(db).pending, true)
})
t('the same e-mail in another letter case → the architect, the claim ends', () => {
  assert.deepEqual(register(' BOSS@example.com'), { success: true, roles: ['architect'] })
  assert.ok(!readdirSync(dir).includes('claim.json'))
  assert.deepEqual(c.claimStatus(db), { pending: false, kind: null, claimed: true })
})
t('the second account is an ordinary user', () => {
  assert.deepEqual(register('stranger@example.com'), { success: true, roles: ['user'] })
})
t('a new claim replaces the old: an e-mail claim after a code claim, a code claim after an e-mail claim', () => {
  db.exec('DELETE FROM users')
  const code2 = c.issueClaim()
  c.issueEmailClaim('a@b.cd')
  assert.equal(c.claimMatches(code2), false)
  assert.equal(c.claimMatchesEmail('A@B.CD'), true)
  const code3 = c.issueClaim()
  assert.equal(c.claimMatchesEmail('a@b.cd'), false)
  assert.equal(c.claimMatches(code3), true)
  assert.deepEqual(register('a@b.cd', 'WRONG'), { success: false, error: 'claim-code' })
  assert.deepEqual(register('a@b.cd', code3), { success: true, roles: ['architect'] })
})
t('a 739 claim file without a kind is read as a code claim (older servers)', () => {
  db.exec('DELETE FROM users')
  writeFileSync(join(dir, 'claim.json'), JSON.stringify({ hash: createHash('sha256').update('ABCDEFGHJKLM').digest('hex'), at: 'x' }))
  assert.equal(c.claimKind(), 'code')
  assert.equal(c.claimMatches('abcd-efgh-jklm'), true)
  c.endClaim()
})
t('the door without the token → 401: the lock refuses a missing, a wrong and a same-length wrong token; unset → always refused', () => {
  delete process.env.ARCHITECT_TOKEN
  assert.equal(c.architectTokenOk('anything'), false)
  process.env.ARCHITECT_TOKEN = 'secret-token-123'
  assert.equal(c.architectTokenOk(null), false)
  assert.equal(c.architectTokenOk(''), false)
  assert.equal(c.architectTokenOk('secret-token-124'), false)
  assert.equal(c.architectTokenOk('secret-token-123'), true)
  const route = readFileSync(new URL('../app/api/claim/route.ts', import.meta.url), 'utf8')
  assert.ok(/if \(!architectTokenOk\(req\.headers\.get\("x-architect-token"\)\)\) return json\(\{ ok: false, error: "bad-key" \}, 401\)/.test(route))
  assert.ok(route.indexOf('architectTokenOk(req') < route.indexOf('issueEmailClaim(body') && route.indexOf('architectTokenOk(req') < route.indexOf('issueClaim()'))
})

console.log('739-2 sign-in is never sent to a loopback address')
const sc = await import('../lib/auth/sign-in-closed.ts')
t('a public name while NEXTAUTH_URL is loopback or empty → closed; after the switch-on → open', () => {
  assert.equal(sc.signInClosedFor('auth.aifa.dev', 'http://127.0.0.1:24681'), true)
  assert.equal(sc.signInClosedFor('auth.aifa.dev', undefined), true)
  assert.equal(sc.signInClosedFor('auth.aifa.dev', 'https://auth.aifa.dev'), false)
})
t('negative: a loopback request keeps working on loopback', () => {
  assert.equal(sc.signInClosedFor('127.0.0.1:24681', 'http://127.0.0.1:24681'), false)
  assert.equal(sc.signInClosedFor('localhost:24681', 'http://127.0.0.1:24681'), false)
  assert.ok(sc.signInClosedPage('ru-RU,ru;q=0.9').includes('Вход ещё не включён'))
})
console.log(`${passed} passed`)
