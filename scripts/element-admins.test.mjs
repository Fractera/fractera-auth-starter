// ELEMENT ADMINS (node step 778): `npm run test:element-admins`. The real doors over HTTP: this element built for production into its
// own folder (`.next-t778`, removed after) and run by its standalone server on a free loopback port, with a fresh database and a test architect key in a temporary folder — the node's live database is never touched.
// Each rule has its negative control; sign-in goes through the real NextAuth credentials form, /api/session through the real cookie.
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'

const tmp = mkdtempSync(join(tmpdir(), 'element-admins-'))
const DIST = '.next-t778'
const KEY = 'test-architect-key-778'
const port = await new Promise((ok) => { const s = createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)) }) })
const BASE = `http://127.0.0.1:${port}`
const env = {
  ...process.env, PORT: String(port), NEXT_DIST_DIR: DIST, DATABASE_URL: join(tmp, 'auth.db'), SERVICE_DATA_DIR: tmp,
  ARCHITECT_TOKEN: KEY, HOSTNAME: '127.0.0.1', NEXTAUTH_URL: BASE, NEXTAUTH_SECRET: 'test-secret-778-'.repeat(3), AUTH_SECRET: 'test-secret-778-'.repeat(3), AUTH_TRUST_HOST: 'true', COOKIE_SECURE: 'false', COOKIE_DOMAIN: '', NODE_ENV: 'production',
}
// ✗ 778: under `next dev` /api/session answers a demo architect (`shouldBypassAuth`: development) — a session check there proves nothing.
console.log('  … building for production (a few minutes)')
// `next build` adds its folder to tsconfig.json — the file is put back as it was.
const tsconfig = readFileSync('tsconfig.json', 'utf8')
const built = spawnSync('npx', ['next', 'build'], { env, encoding: 'utf8' })
writeFileSync('tsconfig.json', tsconfig)
if (built.status !== 0) { console.error((built.stdout + built.stderr).slice(-3000)); rmSync(DIST, { recursive: true, force: true }); process.exit(1) }
const server = spawn(process.execPath, [join(DIST, 'standalone', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] })
let log = ''
server.stdout.on('data', (d) => { log += d })
server.stderr.on('data', (d) => { log += d })
const stop = () => { try { server.kill('SIGTERM') } catch {} ; rmSync(DIST, { recursive: true, force: true }) }

let passed = 0
const t = async (name, fn) => { await fn(); passed += 1; console.log(`  ✓ ${name}`) }
const ARCH = { 'x-node-actor': 'arch-1', 'x-node-actor-roles': 'architect' }
const ADMIN = { 'x-node-actor': 'admin-1', 'x-node-actor-roles': 'admin' }
const call = async (method, path, body, { key = KEY, actor = ARCH } = {}) => {
  const headers = { 'content-type': 'application/json', ...(key ? { 'x-architect-token': key } : {}), ...(actor ?? {}) }
  const res = await fetch(`${BASE}/api/node-users${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await res.text()
  return { status: res.status, text, json: (() => { try { return JSON.parse(text) } catch { return null } })() }
}
const cookieJar = (res, jar = {}) => {
  for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1) }
  return jar
}
const cookieHeader = (jar) => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ')
/** The real form: csrf → credentials callback. Returns the cookie jar when the session cookie was set, else null. */
const signIn = async (email, password) => {
  const r1 = await fetch(`${BASE}/api/auth/csrf`)
  const jar = cookieJar(r1)
  const { csrfToken } = await r1.json()
  const r2 = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookieHeader(jar) },
    body: new URLSearchParams({ csrfToken, email, password }),
  })
  cookieJar(r2, jar)
  if (process.env.DEBUG778) console.log('signIn', r2.status, r2.headers.get('location'), Object.keys(jar))
  return Object.keys(jar).some((k) => k.includes('session-token')) ? jar : null
}

try {
  // Wait for the server.
  for (let i = 0; ; i++) {
    try { const r = await fetch(`${BASE}/api/node-users`, { headers: { 'x-architect-token': KEY } }); if (r.status === 200) break } catch {}
    if (i > 240 || server.exitCode !== null) throw new Error(`the server did not start:\n${log.slice(-2000)}`)
    await new Promise((r) => setTimeout(r, 500))
  }

  await t('negative: no key → 401 on every new door', async () => {
    for (const [m, p] of [['POST', '/element-admin'], ['POST', ''], ['PUT', '/x/password'], ['POST', '/strip-role']]) {
      assert.equal((await call(m, p, {}, { key: null })).status, 401, `${m} ${p}`)
    }
  })
  await t('negative: a wrong key → 401', async () => {
    assert.equal((await call('POST', '/element-admin', { email: 'a@b.cd', role: 'elementAdmin001' }, { key: 'x'.repeat(KEY.length) })).status, 401)
  })
  await t('negative: a role outside the family → 400 (000, 981, a plain role, wrong case)', async () => {
    for (const role of ['elementAdmin000', 'elementAdmin981', 'admin', 'elementadmin001', 'elementAdmin01']) {
      const r = await call('POST', '/element-admin', { email: 'x@y.zz', password: 'longenough1', role })
      assert.equal(r.status, 400, role); assert.equal(r.json.error, 'unknown-role')
    }
    assert.equal((await call('POST', '/strip-role', { role: 'elementAdmin981' })).status, 400)
  })
  await t('negative: a non-architect actor → 403 naming architect on a, c, d and on b with an element-admin role', async () => {
    for (const [m, p, b] of [['POST', '/element-admin', { email: 'q@q.qq', password: 'longenough1', role: 'elementAdmin001' }],
      ['PUT', '/someone/password', { password: 'longenough1' }], ['POST', '/strip-role', { role: 'elementAdmin001' }],
      ['POST', '', { email: 'q@q.qq', password: 'longenough1', roles: ['user', 'elementAdmin001'] }]]) {
      const r = await call(m, p, b, { actor: ADMIN })
      assert.equal(r.status, 403, `${m} ${p}`); assert.deepEqual(r.json.requires, ['architect'])
    }
  })

  let oldId
  await t('b) create a user; the same e-mail in another case → 409; a short password → 400 without the password in the answer', async () => {
    const r = await call('POST', '', { email: 'Owner@Example.com', password: 'old-password-1', roles: ['user'] }, { actor: ADMIN })
    assert.equal(r.status, 200, r.text); oldId = r.json.id
    assert.equal((await call('POST', '', { email: 'owner@EXAMPLE.com', password: 'other-password', roles: ['user'] })).status, 409)
    const short = await call('POST', '', { email: 'short@example.com', password: 'secret7', roles: ['user'] })
    assert.equal(short.status, 400); assert.ok(!short.text.includes('secret7'))
  })
  await t('a) an existing e-mail (any case): the role is added, created:false, the old password still signs in', async () => {
    const r = await call('POST', '/element-admin', { email: 'OWNER@example.com', password: 'new-password-ignored', role: 'elementAdmin007' })
    assert.equal(r.status, 200, r.text); assert.deepEqual(r.json, { ok: true, created: false, id: oldId })
    assert.ok(await signIn('owner@example.com', 'old-password-1'), 'the old password must still sign in')
    assert.equal(await signIn('owner@example.com', 'new-password-ignored'), null, 'negative: the password of the request was not set')
  })
  await t('a) no account and no password → 400 password-required; with a password → created:true, roles [user, role]', async () => {
    const no = await call('POST', '/element-admin', { email: 'fresh@example.com', role: 'elementAdmin007' })
    assert.equal(no.status, 400); assert.equal(no.json.error, 'password-required')
    const r = await call('POST', '/element-admin', { email: 'fresh@example.com', password: 'fresh-password-1', role: 'elementAdmin007' })
    assert.equal(r.status, 200, r.text); assert.equal(r.json.created, true)
    assert.ok(await signIn('fresh@example.com', 'fresh-password-1'))
  })
  await t('/api/session returns the element-admin role the person holds', async () => {
    const jar = await signIn('owner@example.com', 'old-password-1')
    const r = await fetch(`${BASE}/api/session`, { headers: { cookie: cookieHeader(jar) } })
    assert.equal(r.status, 200); const s = await r.json()
    assert.ok(s.roles.includes('elementAdmin007') && s.roles.includes('user'), JSON.stringify(s.roles))
  })
  await t('the users list returns the role, and its role filter finds the holders', async () => {
    const r = await call('GET', '?role=elementAdmin007&perPage=100')
    assert.equal(r.status, 200); assert.equal(r.json.total, 2)
    assert.ok(r.json.rows.every((u) => u.roles.includes('elementAdmin007')))
  })
  await t('c) PUT password: the new one signs in, the old does not; own password → 403; non-architect → 403', async () => {
    assert.equal((await call('PUT', `/${oldId}/password`, { password: 'set-by-architect-1' }, { actor: { 'x-node-actor': oldId, 'x-node-actor-roles': 'architect' } })).status, 403)
    const r = await call('PUT', `/${oldId}/password`, { password: 'set-by-architect-1' })
    assert.equal(r.status, 200, r.text); assert.ok(!r.text.includes('set-by-architect-1'))
    assert.ok(await signIn('owner@example.com', 'set-by-architect-1'))
    assert.equal(await signIn('owner@example.com', 'old-password-1'), null)
    assert.equal((await call('PUT', '/no-such-id/password', { password: 'whatever-123' })).status, 404)
  })
  await t('the existing batch: a non-architect cannot grant or remove an element-admin role (403), an architect can', async () => {
    const no = await call('POST', '/batch', { action: 'addRole', ids: ['x'], value: 'elementAdmin009' }, { actor: ADMIN })
    assert.equal(no.status, 403)
    const yes = await call('POST', '/batch', { action: 'addRole', ids: [oldId], value: 'elementAdmin009' })
    assert.equal(yes.status, 200); assert.deepEqual(yes.json.done, [oldId])
  })
  await t('the existing PATCH /api/admin/users/<id>: an admin by cookie cannot grant an element-admin role (403 naming architect), other roles still can', async () => {
    assert.equal((await call('POST', '', { email: 'admin@example.com', password: 'admin-password-1', roles: ['user', 'admin'] })).status, 200)
    const jar = await signIn('admin@example.com', 'admin-password-1')
    const patch = (roles) => fetch(`${BASE}/api/admin/users/${oldId}`, { method: 'PATCH', headers: { cookie: cookieHeader(jar), 'content-type': 'application/json' }, body: JSON.stringify({ roles }) })
    const no = await patch(['user', 'elementAdmin007', 'elementAdmin009', 'elementAdmin010'])
    assert.equal(no.status, 403); assert.deepEqual((await no.json()).requires, ['architect'])
    const no2 = await patch(['user', 'elementAdmin007'])
    assert.equal(no2.status, 403, 'removing one is refused too')
    const yes = await patch(['user', 'elementAdmin007', 'elementAdmin009', 'buyer'])
    assert.equal(yes.status, 200, 'a plain role change keeps working')
  })
  await t('d) strip-role removes the role from every account and returns the count; again → 0', async () => {
    const r = await call('POST', '/strip-role', { role: 'elementAdmin007' })
    assert.equal(r.status, 200); assert.deepEqual(r.json, { ok: true, count: 2 })
    assert.equal((await call('GET', '?role=elementAdmin007')).json.total, 0)
    assert.equal((await call('POST', '/strip-role', { role: 'elementAdmin007' })).json.count, 0)
    assert.ok((await call('GET', '?role=elementAdmin009')).json.total === 1, 'another element-admin role stays')
  })
  await t('the journal records every change; no password text anywhere in the database journal or the server log', async () => {
    const db = new Database(join(tmp, 'auth.db'), { readonly: true })
    const hist = db.prepare('SELECT source, actor FROM user_role_history WHERE user_id = ? ORDER BY id').all(oldId)
    // created · element-admin (a) · users-tab (batch) · direct (the existing PATCH, as before 778) · element-admin (strip)
    assert.deepEqual(hist.map((h) => h.source), ['created', 'element-admin', 'users-tab', 'direct', 'element-admin'])
    assert.ok(hist.filter((h) => h.source === 'element-admin' || h.source === 'users-tab').every((h) => h.actor === 'arch-1'))
    const logs = db.prepare("SELECT action, details FROM user_log WHERE user_id = ? AND action = 'profile_changed'").all(oldId)
    assert.ok(logs.some((l) => l.details === '["password"]'))
    const dump = JSON.stringify(db.prepare('SELECT * FROM user_log').all()) + JSON.stringify(db.prepare('SELECT * FROM user_role_history').all())
    db.close()
    for (const pw of ['old-password-1', 'new-password-ignored', 'fresh-password-1', 'set-by-architect-1', 'secret7']) {
      assert.ok(!dump.includes(pw), `journal holds ${pw}`); assert.ok(!log.includes(pw), `server log holds ${pw}`)
    }
  })
  console.log(`element admins: ${passed} checks passed`)
} catch (e) {
  console.error(e); console.error(log.slice(process.env.DEBUG778 ? -8000 : -1500)); process.exitCode = 1
} finally {
  stop()
  rmSync(tmp, { recursive: true, force: true })
}
