// WHICH ROLE THE SIGN-IN FORM WAITS FOR (core step 805). The form's legacy default is «architect»: every callbackUrl was once the admin
// panel, and after a right password a person without that role saw «Доступ запрещён». ✗ Measured by the owner on his server
// (2026-11-19): the admin of an app of its own came to the element's OWN domain while the centre held his architect session — the choice
// page of 803-1 sent «войти другой записью» to `/login?callbackUrl=<sso>` with no `requireRole`, the form waited for «architect», and the
// element admin's right password ended in «доступ запрещён». A form whose return is the single sign-on door of an element's site
// (`/api/auth/sso?return=…`) waits for an ordinary visitor; a role named in the address always wins.
const BASE = 'http://localhost'

/** Is this return the single sign-on door of an element's site (relative or absolute, at any depth of `callbackUrl`)? */
export function returnsToElement(callbackUrl) {
  let u
  try { u = new URL(String(callbackUrl ?? ''), BASE) } catch { return false }
  for (let i = 0; i < 4; i++) {
    if (u.pathname === '/api/auth/sso') return true
    const inner = u.pathname === '/login' || u.pathname === '/register' ? u.searchParams.get('callbackUrl') : null
    if (!inner) return false
    try { u = new URL(inner, u) } catch { return false }
  }
  return false
}

/** The role the form waits for: the named one; none named — `user` for an element's site, `architect` for everything else. */
export function requiredRole(named, callbackUrl) {
  const role = typeof named === 'string' ? named.trim() : ''
  if (role) return role
  return returnsToElement(callbackUrl) ? 'user' : 'architect'
}
