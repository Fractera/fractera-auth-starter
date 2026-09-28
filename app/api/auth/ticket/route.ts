import { NextRequest, NextResponse } from "next/server"
import { fromLoopback, revokeUser, whoByTicket } from "@/lib/sso"
import { userAlive } from "@/lib/guest-guard"

// КТО ЗА БИЛЕТОМ (узел, шаг 328-2). Сервер элемента на каждый запрос спрашивает по петле; погашенный или неизвестный билет —
// 401 (выход в центре гасит билеты на всех доменах).

export async function GET(req: NextRequest) {
  if (!fromLoopback(req)) return NextResponse.json({ error: "loopback-only" }, { status: 403 })
  const who = whoByTicket(req.nextUrl.searchParams.get("t") ?? "")
  if (!who) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  // 331-5: запись вытеснена или удалена — билет гаснет.
  if (!userAlive(who.userId)) { revokeUser(who.userId); return NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  return NextResponse.json(who, { headers: { "Cache-Control": "no-store" } })
}
