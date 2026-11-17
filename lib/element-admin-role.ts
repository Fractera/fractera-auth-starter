// ELEMENT ADMINS (node step 778). Owner 2026-11-17: «elementAdmin001…elementAdmin980 … во всех проектах могут быть одинаковыми
// изначально создать и жёстко пришить использовать только эти названия».
// 🔒 ONE fixed family, the same in every Fractera project — the core's rule (`lib/web4-items/element-admin-role.cjs`) written here
// again, never generated per node. 🔒 Never added to `ALL_ROLES`: role pickers read that list of 15, and 980 more would drown it.
// Stored, validated and returned wherever roles are — the users list, its role filter, PATCH of roles, /api/session.

export const ELEMENT_ADMIN_MAX = 980
const RULE = /^elementAdmin(\d{3})$/

/** elementAdmin001 … elementAdmin980 — and nothing else (elementAdmin000, elementAdmin981, elementadmin001 are refused). */
export function isElementAdminRole(role: unknown): role is string {
  if (typeof role !== "string") return false
  const m = RULE.exec(role)
  if (!m) return false
  const n = Number(m[1])
  return n >= 1 && n <= ELEMENT_ADMIN_MAX
}

/** A role that may be stored on an account: one of `ALL_ROLES` or one of the 980. */
export function isStorableRole(role: unknown, allRoles: readonly string[]): role is string {
  return typeof role === "string" && (allRoles.includes(role) || isElementAdminRole(role))
}

/** Did the element-admin roles change between two role lists (granted or removed)? Then only an architect may do it. */
export function elementAdminRolesDiffer(before: readonly string[], after: readonly string[]): boolean {
  const a = before.filter(isElementAdminRole).sort().join(",")
  const b = after.filter(isElementAdminRole).sort().join(",")
  return a !== b
}
