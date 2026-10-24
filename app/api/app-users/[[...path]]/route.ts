// @api list and change the people of one application
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth/auth"
import { getDb } from "@/lib/auth/db"
import { appOfUser } from "@/lib/auth/apps"
import { actingRoles, appOfElement, callerOf, ELEMENT_HEADER, isNodeArchitect, mayAdminister } from "@/lib/auth/caller"
import { historyOf, HISTORY_KINDS, listUsers, runBatch, type Action, type HistoryKind } from "@/lib/auth/node-users"
import { revokeUser } from "@/lib/sso"
import { deleteMediaLater } from "@/lib/auth/media-delete"

// ЛЮДИ ОДНОГО ПРИЛОЖЕНИЯ — ТАБЛИЦА НА САЙТЕ ЭЛЕМЕНТА (узел, шаг 580-2). Работа — та же, что у вкладки ядра (`lib/auth/node-users.ts`).
//   GET  /api/app-users?q=&role=&sort=created_desc|created_asc&page=&perPage=10|25|50|100
//   GET  /api/app-users/<id>/history/<roles|methods|marketing|tracking|log|messenger>?page=&perPage=
//   POST /api/app-users/batch { action, ids[], value? }
//
// 🎯 Владелец 2026-10-24: «вкладка для работы с пользователями своего приложения позволит также как и основная вкладка с пользователями
// … работать с ролями пользователей но только в рамках данной организации то есть здесь нельзя будет переключить пользователя в
// организации а в остальном этой таблице пользователей будет редактироваться также как и таблица пользователей нативном элементе».
//
// 🔒 ЗАМОК — САМ ЧЕЛОВЕК, А НЕ КЛЮЧ ЭЛЕМЕНТА. Ключ узла есть у каждого элемента, и с ним любой элемент читал бы людей любого приложения.
// Здесь сервер элемента пересылает куку и билет посетителя (`lib/auth/caller.ts`) и называет себя (`x-fractera-element`); право даёт
// приложение записи человека: архитектор узла — любое приложение, администратор — только своё. Назвать чужой id элементу не поможет:
// администратор чужого приложения тут не пройдёт.
// 🔒 ОРГАНИЗАЦИИ ЗДЕСЬ НЕ МЕНЯЮТСЯ: `addOrg`/`removeOrg` и поле `orgs` правки — отказ `org-locked`. Человек не своего приложения в
// пакете — `skipped: not-in-app`. Роль `architect` весит только у архитектора узла (`actingRoles`).

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })

type Ctx = { params: Promise<{ path?: string[] }> }

function scope(req: Parameters<typeof callerOf>[0]) {
  const caller = callerOf(req)
  if (!caller) return { error: json({ ok: false, error: "Unauthorized" }, 401) } as const
  const app = appOfElement(req.headers.get(ELEMENT_HEADER))
  if (!mayAdminister(caller, app)) return { error: json({ ok: false, error: "Forbidden", requires: ["admin", "architect"] }, 403) } as const
  return { caller, app } as const
}

export const GET = auth(async function GET(req, ctx) {
  const s = scope(req)
  if ("error" in s) return s.error
  const path = (await (ctx as unknown as Ctx).params).path ?? []
  const db = getDb()
  const sp = req.nextUrl.searchParams
  if (path.length === 0) {
    const page = listUsers(db, { app: s.app, q: sp.get("q"), role: sp.get("role"), sort: sp.get("sort"), page: sp.get("page"), perPage: sp.get("perPage") })
    return json({
      ok: true, app: s.app, me: s.caller.id, nodeArchitect: isNodeArchitect(s.caller),
      ...page,
      rows: page.rows.map(({ orgs: _orgs, ...row }) => row),
    })
  }
  if (path.length === 3 && path[1] === "history" && (HISTORY_KINDS as readonly string[]).includes(path[2])) {
    if (!db.prepare("SELECT 1 FROM users WHERE id = ?").get(path[0]) || appOfUser(path[0]) !== s.app) return json({ ok: false, error: "not-found" }, 404)
    return json({ ok: true, ...historyOf(db, path[0], path[2] as HistoryKind, sp.get("page"), sp.get("perPage")) })
  }
  return json({ ok: false, error: "unknown-path" }, 404)
})

export const POST = auth(async function POST(req, ctx) {
  const s = scope(req)
  if ("error" in s) return s.error
  const path = (await (ctx as unknown as Ctx).params).path ?? []
  if (!(path.length === 1 && path[0] === "batch")) return json({ ok: false, error: "unknown-path" }, 404)
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return json({ ok: false, error: "bad-json" }, 400)
  const action = body.action as Action
  if (action === "addOrg" || action === "removeOrg") return json({ ok: false, error: "org-locked" }, 400)
  if (action === "update" && body.value && typeof body.value === "object" && "orgs" in (body.value as object)) {
    return json({ ok: false, error: "org-locked" }, 400)
  }
  const db = getDb()
  const asked = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : []
  const inApp = asked.filter((id) => appOfUser(id) === s.app && db.prepare("SELECT 1 FROM users WHERE id = ?").get(id))
  const outside = asked.filter((id) => !inApp.includes(id)).map((id) => ({ id, reason: "not-in-app" }))
  if (inApp.length === 0) return json({ ok: true, done: [], skipped: outside })
  const r = runBatch(db, { id: s.caller.id, roles: actingRoles(s.caller) }, action, inApp, body.value)
  if ("error" in r) return json({ ok: false, error: r.error }, r.error === "only-architect" ? 403 : 400)
  for (const id of r.revoke) revokeUser(id)
  deleteMediaLater(r.mediaToDelete)
  return json({ ok: true, done: r.done, skipped: [...r.skipped, ...outside] })
})
