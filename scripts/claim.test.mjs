// THE ARCHITECT'S CLAIM (node step 739-1): `node scripts/claim.test.mjs`. The claim module itself (`lib/auth/claim.ts`, Node strips its
// types) against a real better-sqlite3 database in a temporary folder.
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs'
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
  assert.ok(/claimPending\(db\)/.test(reg) && /claimMatches\(code\)/.test(reg) && /endClaim\(\)/.test(reg))
  assert.ok(/if \(isFirst && claimPending\(db\)\) throw/.test(ad))
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
