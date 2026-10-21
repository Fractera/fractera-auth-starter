// @api check a single sign-on ticket and return who it belongs to
import { NextRequest, NextResponse } from "next/server"
import { fromLoopback, revokeUser, whoByTicket } from "@/lib/sso"
import { liveUser } from "@/lib/guest-guard"

// КТО ЗА БИЛЕТОМ (узел, шаг 328-2). Сервер элемента на каждый запрос спрашивает по петле; погашенный или неизвестный билет —
// 401 (выход в центре гасит билеты на всех доменах).

export async function GET(req: NextRequest) {
  if (!fromLoopback(req)) return NextResponse.json({ error: "loopback-only" }, { status: 403 })
  const who = whoByTicket(req.nextUrl.searchParams.get("t") ?? "")
  if (!who) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  // 331-5: запись вытеснена или удалена — билет гаснет. 559-1: заблокирована — так же; роли — из базы (как `/api/session`).
  const live = liveUser(who.userId)
  if (!live) { revokeUser(who.userId); return NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  return NextResponse.json({ ...who, roles: live.roles }, { headers: { "Cache-Control": "no-store" } })
}
