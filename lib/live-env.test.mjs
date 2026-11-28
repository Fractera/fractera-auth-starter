// lib/live-env.mjs — a key written into the element's .env.local is seen without a deploy (node step 869). Run: npm run test:live-env
import { mkdtempSync, renameSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseEnv, refreshEnv } from './live-env.mjs'

let failed = 0
const check = (name, ok, got) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); if (!ok) { failed++; console.log('     got:', got) } }

const dir = mkdtempSync(join(tmpdir(), 'live-env-'))
const file = join(dir, '.env.local')
const bump = (s) => { const t = new Date(Date.now() + s * 1000); utimesSync(file, t, t) }
// The screens replace the file by a rename (core lib/env-file.ts): the test writes the same way.
const put = (text, s) => { writeFileSync(`${file}.tmp`, text); renameSync(`${file}.tmp`, file); bump(s) }
try {
  const p = parseEnv('# c\nA=1\nexport B="two words"\nC=\'x#y\'\nD=v # note\n bad line\nE=\n')
  check('parse: plain, export, quotes, inline comment, empty', p.get('A') === '1' && p.get('B') === 'two words' && p.get('C') === 'x#y' && p.get('D') === 'v' && p.get('E') === '' && p.size === 5, [...p])

  const env = { PORT: '24691', NODE_ENV: 'production', STRIPE_WEBHOOK_SECRET: undefined }
  const memo = { stamp: '', owned: new Set() }
  check('no file → nothing changes', refreshEnv({ file, env, memo }).changed.length === 0, env)

  put('STRIPE_SECRET_KEY=sk_test_old\nPORT=1\nNEXT_PUBLIC_X=baked\n', 1)
  let r = refreshEnv({ file, env, memo })
  check('first read sets the key', env.STRIPE_SECRET_KEY === 'sk_test_old' && r.changed.join() === 'STRIPE_SECRET_KEY', r)
  check('PORT and NEXT_PUBLIC_* are never overridden', env.PORT === '24691' && !('NEXT_PUBLIC_X' in env), env)

  check('same file → no reparse, nothing changes', refreshEnv({ file, env, memo }).changed.length === 0, memo)

  put('STRIPE_SECRET_KEY=sk_test_new\nSTRIPE_WEBHOOK_SECRET=whsec_1\n', 2)
  r = refreshEnv({ file, env, memo })
  check('a screen saves a new key → live at the next read', env.STRIPE_SECRET_KEY === 'sk_test_new' && env.STRIPE_WEBHOOK_SECRET === 'whsec_1' && r.changed.length === 2, r)

  put('STRIPE_SECRET_KEY=sk_test_new\n', 3)
  r = refreshEnv({ file, env, memo })
  check('a key removed from the file is removed from the process', !('STRIPE_WEBHOOK_SECRET' in env) && r.changed.join() === 'STRIPE_WEBHOOK_SECRET', r)

  const foreign = { HOME: '/x' }
  const m2 = { stamp: '', owned: new Set() }
  put('A=1\n', 4); refreshEnv({ file, env: foreign, memo: m2 })
  put('B=2\n', 5); refreshEnv({ file, env: foreign, memo: m2 })
  check('a variable the file never held is left alone', foreign.HOME === '/x' && foreign.B === '2' && !('A' in foreign), foreign)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
console.log(failed ? `\n${failed} failed` : '\nall passed')
process.exit(failed ? 1 : 0)
