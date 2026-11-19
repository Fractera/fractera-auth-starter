// ELEMENT ADMINS (node step 778): `npm run test:element-admins`. The real doors over HTTP: this element built for production into its
// own folder (`.next-t778`, removed after) and run by its standalone server on a free loopback port, with a fresh database and a test architect key in a temporary folder — the node's live database is never touched.
// Each rule has its negative control; sign-in goes through the real NextAuth credentials form, /api/session through the real cookie.
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'

const tmp = mkdtempSync(join(tmpdir(), 'element-admins-'))
const DIST = '.next-t778'
const KEY = 'test-architect-key-778'
// 803-1: a factory node around the service — the app element `shop` on its own domain, and `plain` (a custom element with no app
// organization), so the single sign-in door has an app site and a node site to return to.
const nodeRoot = join(tmp, 'node')
for (const d of ['logs', 'WEB4-ITEMS-REGISTRY', 'data/services/shop', 'data/services/plain']) mkdirSync(join(nodeRoot, d), { recursive: true })
writeFileSync(join(nodeRoot, 'logs', 'domain.json'), JSON.stringify({ zone: 'node.example.com' }))
// 805: the registry after core step 804 — no node type; each born element carries its answer, `shop` an app of its own with its admin role.
writeFileSync(join(nodeRoot, 'WEB4-ITEMS-REGISTRY', 'web4-items.json'), JSON.stringify({ services: [{ id: 'shop', kind: 'user', born: { from: 'custom' }, app: 'own', adminRole: 'elementAdmin011' }, { id: 'plain', kind: 'user', born: { from: 'custom' }, app: 'project' }] }))
writeFileSync(join(nodeRoot, 'data/services/shop/domain.json'), JSON.stringify({ domain: 'shop.example.com' }))
writeFileSync(join(nodeRoot, 'data/services/plain/domain.json'), JSON.stringify({ domain: 'plain.example.com' }))
const port = await new Promise((ok) => { const s = createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)) }) })
const BASE = `http://127.0.0.1:${port}`
const env = {
  ...process.env, PORT: String(port), NEXT_DIST_DIR: DIST, DATABASE_URL: join(tmp, 'auth.db'), SERVICE_DATA_DIR: tmp,
  ARCHITECT_TOKEN: KEY, NODE_DOMAIN_FILE: join(nodeRoot, 'logs', 'domain.json'), HOSTNAME: '127.0.0.1', NEXTAUTH_URL: BASE, NEXTAUTH_SECRET: 'test-secret-778-'.repeat(3), AUTH_SECRET: 'test-secret-778-'.repeat(3), AUTH_TRUST_HOST: 'true', COOKIE_SECURE: 'false', COOKIE_DOMAIN: '', NODE_ENV: 'production',
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
const failed = []
// A failed check is named and the run goes on (803-1): a spoiled rule must show every check it breaks, not only the first.
const t = async (name, fn) => {
  try { await fn(); passed += 1; console.log(`  ✓ ${name}`) } catch (e) { failed.push(name); console.log(`  ✗ ${name}\n      ${String(e?.message ?? e).split('\n')[0]}`) }
}
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
const signIn = async (email, password, site) => {
  const r1 = await fetch(`${BASE}/api/auth/csrf`)
  const jar = cookieJar(r1)
  const { csrfToken } = await r1.json()
  const r2 = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookieHeader(jar) },
    // 803-1: `site` — sign in for an app site: the form's callbackUrl carries the return, as the real form does.
    body: new URLSearchParams({ csrfToken, email, password, ...(site ? { callbackUrl: `${BASE}/login?callbackUrl=${encodeURIComponent(site)}` } : {}) }),
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
  // ── 803-1 ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const db = () => new Database(join(tmp, 'auth.db'), { readonly: true })
  const appOf = (id) => { const d = db(); const r = d.prepare('SELECT app FROM users WHERE id = ?').get(id); d.close(); return r?.app }
  const SHOP = 'https://shop.example.com/api/auth/callback?next=%2F'
  let shopAdmin
  await t('803-1 (1): element with an app organization → the admin is created in THAT app, beside the node account of the same e-mail', async () => {
    assert.equal((await call('POST', '/apps', { element: 'shop' })).status, 200)
    const r = await call('POST', '/element-admin', { email: 'Owner@Example.com', password: 'shop-password-1', role: 'elementAdmin011', element: 'shop' })
    assert.equal(r.status, 200, r.text); assert.equal(r.json.created, true); assert.notEqual(r.json.id, oldId, 'not the node account')
    shopAdmin = r.json.id
    assert.equal(appOf(shopAdmin), 'shop'); assert.equal(appOf(oldId), 'node')
  })
  await t('803-1 (1): the existing account of that app gets the role, its password never touched', async () => {
    const r = await call('POST', '/element-admin', { email: 'owner@example.com', password: 'other-password-9', role: 'elementAdmin012', element: 'shop' })
    assert.deepEqual(r.json, { ok: true, created: false, id: shopAdmin })
    assert.ok(await signIn('owner@example.com', 'shop-password-1', SHOP), 'the app password still signs in on the app site')
    assert.equal(await signIn('owner@example.com', 'other-password-9', SHOP), null, 'negative: the request password was not set')
  })
  await t('803-1 (1) negative: no element, an element without an app organization → the node account, as before; a malformed element → 400', async () => {
    const a = await call('POST', '/element-admin', { email: 'owner@example.com', role: 'elementAdmin013' })
    assert.deepEqual(a.json, { ok: true, created: false, id: oldId })
    const b = await call('POST', '/element-admin', { email: 'owner@example.com', role: 'elementAdmin013', element: 'plain' })
    assert.deepEqual(b.json, { ok: true, created: false, id: oldId })
    const c = await call('POST', '/element-admin', { email: 'owner@example.com', role: 'elementAdmin013', element: 'Bad Element!' })
    assert.equal(c.status, 400); assert.equal(c.json.error, 'bad-element')
  })
  await t('803-1 (1): POST /api/node-users with element → the app; the same e-mail again in that app → 409; in node it is free', async () => {
    const r = await call('POST', '', { email: 'buyer@example.com', password: 'buyer-password-1', roles: ['user'], element: 'shop' })
    assert.equal(r.status, 200, r.text); assert.equal(appOf(r.json.id), 'shop')
    assert.equal((await call('POST', '', { email: 'BUYER@example.com', password: 'buyer-password-2', roles: ['user'], element: 'shop' })).status, 409)
    const n = await call('POST', '', { email: 'buyer@example.com', password: 'buyer-password-3', roles: ['user'] })
    assert.equal(n.status, 200, n.text); assert.equal(appOf(n.json.id), 'node')
  })

  const archA = await call('POST', '', { email: 'arch-a@example.com', password: 'arch-a-password', roles: ['user', 'architect'] })
  const archAId = archA.json?.id
  const sso = (jar, ret, extra = '', lang) => fetch(`${BASE}/api/auth/sso?return=${encodeURIComponent(ret)}${extra}`,
    { redirect: 'manual', headers: { cookie: cookieHeader(jar), ...(lang ? { 'accept-language': lang } : {}) } })
  await t('803-1 (3): the node architect on an app site → the choice page, not a code', async () => {
    const jar = await signIn('arch-a@example.com', 'arch-a-password')
    assert.ok(jar, 'the architect signs in')
    const r = await sso(jar, SHOP)
    assert.equal(r.status, 302); const loc = new URL(r.headers.get('location'))
    assert.equal(loc.pathname, '/continue-as'); assert.equal(loc.searchParams.get('return'), SHOP); assert.ok(!loc.searchParams.get('code'))
  })
  await t('803-1 (3): the choice page — ru words, en words, de falls back to English; the two links', async () => {
    const jar = await signIn('arch-a@example.com', 'arch-a-password')
    const page = async (lang) => (await fetch(`${BASE}/continue-as?return=${encodeURIComponent(SHOP)}`, { headers: { cookie: cookieHeader(jar), 'accept-language': lang } })).text()
    const ru = await page('ru-RU,ru;q=0.9,en;q=0.8')
    for (const w of ['Вы вошли как arch-a@example.com', 'Продолжить как arch-a@example.com', 'Войти другим аккаунтом']) assert.ok(ru.includes(w), w)
    const en = await page('en-US')
    for (const w of ['You are signed in as arch-a@example.com', 'Continue as arch-a@example.com', 'Sign in with another account']) assert.ok(en.includes(w), w)
    assert.ok((await page('de-DE,de')).includes('Sign in with another account'), 'de → English')
    const ssoPath = `/api/auth/sso?return=${encodeURIComponent(SHOP)}`
    assert.ok(en.includes(`href="${`${ssoPath}&confirmed=1`.replace(/&/g, '&amp;')}"`), 'continue link')
    // 805: the login of «another account» hears the role the site asked for — none named: a visitor, never the legacy «architect».
    assert.ok(en.includes(`href="/logout?redirectUrl=${encodeURIComponent(`/login?callbackUrl=${encodeURIComponent(ssoPath)}&requireRole=user`)}"`), 'another-account link')
  })
  await t('803-1 (3): «Continue» → the code to the app site; «Another account» → signed out of the center, the login with the same return', async () => {
    const jar = await signIn('arch-a@example.com', 'arch-a-password')
    const r = await sso(jar, SHOP, '&confirmed=1')
    assert.equal(r.status, 302); const loc = new URL(r.headers.get('location'))
    assert.equal(loc.host, 'shop.example.com'); assert.ok(loc.searchParams.get('code'))
    const ssoPath = `/api/auth/sso?return=${encodeURIComponent(SHOP)}`
    const out = await fetch(`${BASE}/logout?redirectUrl=${encodeURIComponent(`/login?callbackUrl=${encodeURIComponent(ssoPath)}`)}`, { redirect: 'manual', headers: { cookie: cookieHeader(jar) } })
    const to = new URL(out.headers.get('location'))
    assert.equal(to.origin, BASE); assert.equal(to.pathname, '/login'); assert.equal(to.searchParams.get('callbackUrl'), ssoPath)
    assert.ok(out.headers.getSetCookie().some((c) => /session-token=;|session-token=[^;]*;.*(Max-Age=0|Expires=Thu, 01 Jan 1970)/i.test(c)), 'the session cookie is cleared')
  })
  await t('803-1 (3) negative: the app\'s own person → the code at once; the architect on a site without an app → the code at once', async () => {
    const own = await signIn('owner@example.com', 'shop-password-1', SHOP)
    const r = await sso(own, SHOP)
    assert.equal(r.status, 302); assert.equal(new URL(r.headers.get('location')).host, 'shop.example.com')
    const jar = await signIn('arch-a@example.com', 'arch-a-password')
    const p = await sso(jar, 'https://plain.example.com/api/auth/callback')
    assert.equal(p.status, 302); const loc = new URL(p.headers.get('location'))
    assert.equal(loc.host, 'plain.example.com'); assert.ok(loc.searchParams.get('code'))
  })

  // ── 805 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const appUsers = (jar, method = 'GET', path = '', body, element = 'shop') => fetch(`${BASE}/api/app-users${path}`, {
    method, headers: { cookie: cookieHeader(jar), 'content-type': 'application/json', 'x-fractera-element': element },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  await t('805: the single sign-on door with no role sends the form a visitor\'s role, never the legacy «architect»', async () => {
    const r = await fetch(`${BASE}/api/auth/sso?return=${encodeURIComponent(SHOP)}`, { redirect: 'manual' })
    assert.equal(r.status, 302); const loc = new URL(r.headers.get('location'))
    assert.equal(loc.pathname, '/login'); assert.equal(loc.searchParams.get('requireRole'), 'user')
    const named = await fetch(`${BASE}/api/auth/sso?return=${encodeURIComponent(SHOP)}&requireRole=elementAdmin011`, { redirect: 'manual' })
    assert.equal(new URL(named.headers.get('location')).searchParams.get('requireRole'), 'elementAdmin011', 'a named role wins')
  })
  await t('805: the element\'s own admin administers the people of its app — only them', async () => {
    const jar = await signIn('owner@example.com', 'shop-password-1', SHOP)
    const r = await appUsers(jar, 'GET', '?perPage=100')
    assert.equal(r.status, 200, await r.clone().text()); const j = await r.json()
    assert.equal(j.app, 'shop'); assert.ok(j.rows.length > 0 && j.rows.every((u) => appOf(u.id) === 'shop'))
  })
  await t('805 negative: a plain person of the app, and the own admin of ANOTHER element, are refused (403)', async () => {
    const buyer = await signIn('buyer@example.com', 'buyer-password-1', SHOP)
    assert.equal((await appUsers(buyer)).status, 403)
    const jar = await signIn('owner@example.com', 'shop-password-1', SHOP)
    assert.equal((await appUsers(jar, 'GET', '', undefined, 'plain')).status, 403, 'plain has no app of its own: its people are node\'s')
  })
  let made
  await t('805: «Добавить пользователя» — the own admin makes a person of the app; they sign in on the app site', async () => {
    const jar = await signIn('owner@example.com', 'shop-password-1', SHOP)
    const r = await appUsers(jar, 'POST', '/create', { email: 'New.Person@Example.com', password: 'new-person-pass1' })
    assert.equal(r.status, 201, await r.clone().text()); made = (await r.json()).id
    assert.equal(appOf(made), 'shop')
    assert.ok(await signIn('new.person@example.com', 'new-person-pass1', SHOP), 'the new person signs in on the app site')
  })
  await t('805 negative: an e-mail that exists in ANY app → 409 email-taken (the core\'s architect, a node person, a person of this app)', async () => {
    const jar = await signIn('owner@example.com', 'shop-password-1', SHOP)
    for (const email of ['ARCH-A@example.com', 'admin@example.com', 'new.person@example.com']) {
      const r = await appUsers(jar, 'POST', '/create', { email, password: 'whatever-pass-1' })
      assert.equal(r.status, 409, email); assert.equal((await r.json()).error, 'email-taken')
    }
    const short = await appUsers(jar, 'POST', '/create', { email: 'short2@example.com', password: 'short7' })
    assert.equal(short.status, 400)
    const buyer = await signIn('buyer@example.com', 'buyer-password-1', SHOP)
    assert.equal((await appUsers(buyer, 'POST', '/create', { email: 'x2@example.com', password: 'whatever-pass-1' })).status, 403, 'no rights — no person')
  })

  const batch = (action, ids, value) => call('POST', '/batch', { action, ids, value })
  await t('803-1 (2): the last active architect is never anonymized, blocked or stripped — skip last-architect', async () => {
    assert.ok(archAId, archA.text)
    for (const [action, value] of [['anonymize'], ["block"], ['removeRole', 'architect'], ['update', { roles: ['user'] }], ['update', { blocked: true }]]) {
      const r = await batch(action, [archAId], value)
      assert.equal(r.status, 200, r.text); assert.deepEqual(r.json.skipped, [{ id: archAId, reason: 'last-architect' }], `${action} ${JSON.stringify(value)}`)
    }
    const ok = await batch('update', [archAId], { firstName: 'Arch' })
    assert.deepEqual(ok.json.done, [archAId], 'other edits of the last architect still work')
  })
  await t('803-1 (2) negative: with two architects one may go, the second is the last', async () => {
    const b = await call('POST', '', { email: 'arch-b@example.com', password: 'arch-b-password', roles: ['user', 'architect'] })
    const r = await batch("block", [archAId, b.json.id])
    assert.deepEqual(r.json.done, [archAId]); assert.deepEqual(r.json.skipped, [{ id: b.json.id, reason: 'last-architect' }])
    assert.deepEqual((await batch('unblock', [archAId])).json.done, [archAId])
    const an = await batch('anonymize', [b.json.id])
    assert.deepEqual(an.json.done, [b.json.id], 'A is active again, so B may go')
  })

  console.log(`element admins: ${passed} checks passed${failed.length ? `, ${failed.length} FAILED` : ''}`)
  if (failed.length) process.exitCode = 1
} catch (e) {
  console.error(e); console.error(log.slice(process.env.DEBUG778 ? -8000 : -1500)); process.exitCode = 1
} finally {
  stop()
  rmSync(tmp, { recursive: true, force: true })
}
