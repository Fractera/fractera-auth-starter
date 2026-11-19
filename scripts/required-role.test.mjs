// 805: the role the sign-in form waits for (lib/auth/required-role.mjs). Run: node scripts/required-role.test.mjs
import assert from 'node:assert/strict'
import { requiredRole, returnsToElement } from '../lib/auth/required-role.mjs'
let passed = 0
const t = (name, fn) => { fn(); passed += 1; console.log(`  ✓ ${name}`) }
const sso = '/api/auth/sso?return=' + encodeURIComponent('https://throughsongs.com/api/auth/callback?next=%2Fru')
t('the choice page\'s «another account» to an element\'s own domain waits for a visitor, not the architect', () => {
  assert.equal(requiredRole(null, sso), 'user')
  assert.equal(requiredRole('', `https://auth.fractera.ai${sso}`), 'user')
  assert.ok(returnsToElement(`/login?callbackUrl=${encodeURIComponent(sso)}`))
})
t('a role named in the address always wins', () => {
  assert.equal(requiredRole('architect', sso), 'architect')
  assert.equal(requiredRole('elementAdmin002', sso), 'elementAdmin002')
})
t('negative: no element return — the legacy default stays «architect» (the panel, a bare /login)', () => {
  assert.equal(requiredRole(null, '/'), 'architect')
  assert.equal(requiredRole(null, 'https://architect.fractera.ai/ru/architect'), 'architect')
  assert.equal(requiredRole(undefined, 'not a url ::'), 'architect')
})
console.log(`===REQUIRED_ROLE_OK=== ${passed} passed`)
