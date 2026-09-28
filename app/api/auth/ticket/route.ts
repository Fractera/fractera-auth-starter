import { NextRequest, NextResponse } from "next/server"
import { fromLoopback, whoByTicket } from "@/lib/sso"

// КТО ЗА БИЛЕТОМ (узел, шаг 328-2). Сервер элемента на каждый запрос спрашивает по петле; погашенный или неизвестный билет —
// 401 (выход в центре гасит билеты на всех доменах).
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  if (!fromLoopback(req)) return NextResponse.json({ error: "loopback-only" }, { status: 403 })
  const who = whoByTicket(req.nextUrl.searchParams.get("t") ?? "")
  if (!who) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json(who, { headers: { "Cache-Control": "no-store" } })
}
