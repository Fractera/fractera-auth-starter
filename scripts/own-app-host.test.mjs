// 805: the sign-in route of an app of its own (lib/auth/app-hosts.ts `ownAppHost`) reads the element's answer at birth (`app` of the
// registry, core step 804) instead of the node's type, which left the registry. Run: node scripts/own-app-host.test.mjs
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const root = mkdtempSync(join(tmpdir(), 'own-app-host-'))
const put = (rel, v) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), JSON.stringify(v)) }
put('logs/domain.json', { zone: 'fractera.ai' })
const born = { from: 'fractera-custom-item-starter' }
const registry = (extra) => put('WEB4-ITEMS-REGISTRY/web4-items.json', { ...extra, services: [
  { id: 'auth', kind: 'core' }, { id: 'root', kind: 'user' },
  { id: 'marina', kind: 'user', born, app: 'own' }, { id: 'shop', kind: 'user', born, app: 'project' }, { id: 'old', kind: 'user', born },
] })
put('data/services/marina/domain.json', { domain: 'throughsongs.com' })
put('data/services/shop/address.json', { address: 'shop' })
process.env.NODE_DOMAIN_FILE = join(root, 'logs', 'domain.json')
const h = await import('../lib/auth/app-hosts.ts')
let passed = 0
const t = (name, fn) => { fn(); passed += 1; console.log(`  ✓ ${name}`) }

registry({})
t('an app of its own: its own domain, its www and its subdomain are app hosts', () => {
  assert.equal(h.ownAppHost('throughsongs.com'), true)
  assert.equal(h.ownAppHost('www.throughsongs.com'), true)
  assert.equal(h.ownAppHost('marina.fractera.ai'), true)
})
t('negative: part of the project, root and a stranger are not', () => {
  assert.equal(h.ownAppHost('shop.fractera.ai'), false)
  assert.equal(h.ownAppHost('root.fractera.ai'), false)
  assert.equal(h.ownAppHost('example.com'), false)
})
t('a born entry without the answer reads the old node type: factory — own, otherwise not', () => {
  assert.equal(h.ownAppHost('old.fractera.ai'), false)
  registry({ nodeType: 'factory' })
  assert.equal(h.ownAppHost('old.fractera.ai'), true)
  assert.equal(h.ownAppHost('shop.fractera.ai'), false, 'an explicit answer beats the old type')
})
console.log(`===OWN_APP_HOST_OK=== ${passed} passed`)
