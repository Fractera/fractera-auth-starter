// @api list, edit and anonymize node users for the core Users tab
import { timingSafeEqual } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/auth/db"
import { fromOutside } from "@/lib/a2a/boundary"
import { revokeUser } from "@/lib/sso"
import { deleteMediaLater } from "@/lib/auth/media-delete"
import { appOrg, createOrg, createUser, grantElementAdmin, historyOf, HISTORY_KINDS, listOrgs, listUsers, runBatch, setPassword, stripRole, type Action, type Actor, type HistoryKind } from "@/lib/auth/node-users"

// ДВЕРЬ ПОЛЬЗОВАТЕЛЕЙ УЗЛА ДЛЯ ЯДРА (узел, шаг 559-3). Работа — `lib/auth/node-users.ts`.
//   GET  /api/node-users?q=&org=&role=&sort=created_desc|created_asc&page=&perPage=10|25|50|100
//   GET  /api/node-users/<id>/history/<roles|methods|marketing|tracking|log|messenger>?page=&perPage=
//   GET  /api/node-users/organizations          POST /api/node-users/organizations { name }
//   POST /api/node-users/batch { action, ids[], value? }
//   POST /api/node-users/apps { element } — организация-приложение элемента завода (554-1): есть — та же, нет — новая
//   778 — администраторы элементов (README, «Element admins (step 778)»); a, c, d и любая роль elementAdmin — только архитектор:
//   POST /api/node-users/element-admin { email, password?, role }   POST /api/node-users { email, password, roles[] }
//   PUT  /api/node-users/<id>/password { password }                  POST /api/node-users/strip-role { role }
//   🔒 Пароль не попадает ни в лог, ни в журнал, ни в ответ, ни в ошибку.
// 🔒 ЗАМОК — КЛЮЧ АРХИТЕКТОРА (`ARCHITECT_TOKEN`, заголовок `x-architect-token`) и только петля машины. Ключ общий у ядра и этой службы
// и больше ни у кого; `SETTINGS_SECRET` для этой двери не годится — он есть у каждого элемента узла, и любой из них читал бы людей.
// Через туннель дверь отвечает 404 — её как будто нет. Кто действует — заголовки ядра `x-node-actor`, `x-node-actor-roles`: ядро
// проверило вход и роль (`requireRoles`) и передаёт, кого проверило.
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function tokenOk(given: string | null): boolean {
  const expected = process.env.ARCHITECT_TOKEN ?? ""
  const g = given ?? ""
  if (!expected || g.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(g), Buffer.from(expected))
}

function guard(req: NextRequest): NextResponse | null {
  if (fromOutside(req.headers)) return new NextResponse(null, { status: 404 })
  if (!tokenOk(req.headers.get("x-architect-token"))) return NextResponse.json({ ok: false, error: "bad-key" }, { status: 401 })
  return null
}

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })

type Ctx = { params: Promise<{ path?: string[] }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  const denied = guard(req)
  if (denied) return denied
  const path = (await ctx.params).path ?? []
  const db = getDb()
  const sp = req.nextUrl.searchParams
  if (path.length === 0) {
    return json({ ok: true, ...listUsers(db, { q: sp.get("q"), org: sp.get("org"), role: sp.get("role"), sort: sp.get("sort"), page: sp.get("page"), perPage: sp.get("perPage") }) })
  }
  if (path.length === 1 && path[0] === "organizations") return json({ ok: true, organizations: listOrgs(db) })
  if (path.length === 3 && path[1] === "history" && (HISTORY_KINDS as readonly string[]).includes(path[2])) {
    if (!db.prepare("SELECT 1 FROM users WHERE id = ?").get(path[0])) return json({ ok: false, error: "not-found" }, 404)
    return json({ ok: true, ...historyOf(db, path[0], path[2] as HistoryKind, sp.get("page"), sp.get("perPage")) })
  }
  return json({ ok: false, error: "unknown-path" }, 404)
}

const actorOf = (req: NextRequest): Actor | null => {
  const id = req.headers.get("x-node-actor")?.trim()
  return id ? { id, roles: (req.headers.get("x-node-actor-roles") ?? "").split(",").map((r) => r.trim()).filter(Boolean) } : null
}
// 778: a refusal names the role that would have been enough.
const refused = (r: { error: string; status: number }) => json({ ok: false, error: r.error, ...(r.error === "only-architect" ? { requires: ["architect"] } : {}) }, r.status)

export async function POST(req: NextRequest, ctx: Ctx) {
  const denied = guard(req)
  if (denied) return denied
  const path = (await ctx.params).path ?? []
  const actor = actorOf(req)
  if (!actor) return json({ ok: false, error: "no-actor" }, 400)
  const { id: actorId, roles: actorRoles } = actor
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return json({ ok: false, error: "bad-json" }, 400)
  const db = getDb()
  if (path.length === 0) {
    const r = await createUser(db, actor, body)
    return "error" in r ? refused(r) : json({ ok: true, id: r.id })
  }
  if (path.length === 1 && path[0] === "element-admin") {
    const r = await grantElementAdmin(db, actor, body)
    return "error" in r ? refused(r) : json({ ok: true, created: r.created, id: r.id })
  }
  if (path.length === 1 && path[0] === "strip-role") {
    const r = stripRole(db, actor, body.role)
    return "error" in r ? refused(r) : json({ ok: true, count: r.count })
  }
  if (path.length === 1 && path[0] === "organizations") {
    const r = createOrg(db, body.name)
    return "error" in r ? json({ ok: false, error: r.error }, 400) : json({ ok: true, organization: r })
  }
  if (path.length === 1 && path[0] === "apps") {
    const r = appOrg(db, body.element)
    return "error" in r ? json({ ok: false, error: r.error }, 400) : json({ ok: true, organization: r })
  }
  if (path.length === 1 && path[0] === "batch") {
    const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : []
    const r = runBatch(db, { id: actorId, roles: actorRoles }, body.action as Action, ids, body.value)
    if ("error" in r) return r.error === "only-architect" ? refused({ error: r.error, status: 403 }) : json({ ok: false, error: r.error }, 400)
    for (const id of r.revoke) revokeUser(id)
    deleteMediaLater(r.mediaToDelete)
    return json({ ok: true, done: r.done, skipped: r.skipped })
  }
  return json({ ok: false, error: "unknown-path" }, 404)
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const denied = guard(req)
  if (denied) return denied
  const path = (await ctx.params).path ?? []
  const actor = actorOf(req)
  if (!actor) return json({ ok: false, error: "no-actor" }, 400)
  if (!(path.length === 2 && path[1] === "password")) return json({ ok: false, error: "unknown-path" }, 404)
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return json({ ok: false, error: "bad-json" }, 400)
  const r = await setPassword(getDb(), actor, path[0], body)
  if ("error" in r) return refused(r)
  revokeUser(r.id) // a new password ends the sessions made with the old one
  return json({ ok: true, id: r.id })
}
