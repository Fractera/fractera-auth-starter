import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { fromLoopback, revokeUser } from "@/lib/sso"

// ГОСТЬ УХОДИТ И УНОСИТ СВОЮ ЗАПИСЬ (узел, шаг 331-2). Слово владельца: кнопка «удалить мою учётную запись и покинуть сайт».
// Зовёт только сервер элемента по петле машины, `{ userId }` — того, кого элемент сам узнал по сессии. Удаляется ТОЛЬКО гость:
// запись с провайдером `guest` и единственной ролью `guest`; любого другого человека дверь не трогает (404 `not-a-guest`).
// Билеты единого входа этого человека гасятся сразу — на всех доменах.

export async function POST(req: NextRequest) {
  if (!fromLoopback(req)) return NextResponse.json({ error: "loopback-only" }, { status: 403 })
  const body = (await req.json().catch(() => null)) as { userId?: unknown } | null
  const userId = typeof body?.userId === "string" ? body.userId : ""
  if (!userId) return NextResponse.json({ error: "bad-user" }, { status: 400 })
  const db = getDb()
  const row = db.prepare("SELECT roles, provider FROM users WHERE id = ?").get(userId) as { roles: string; provider: string } | undefined
  let roles: unknown = null
  try { roles = row ? JSON.parse(row.roles) : null } catch { /* битые роли — не гость */ }
  const guestOnly = Array.isArray(roles) && roles.length === 1 && roles[0] === "guest" && row?.provider === "guest"
  if (!guestOnly) return NextResponse.json({ error: "not-a-guest" }, { status: 404 })
  db.transaction(() => {
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId)
    db.prepare("DELETE FROM accounts WHERE user_id = ?").run(userId)
    db.prepare("DELETE FROM users WHERE id = ?").run(userId)
  })()
  const tickets = revokeUser(userId)
  return NextResponse.json({ ok: true, tickets }, { headers: { "Cache-Control": "no-store" } })
}
