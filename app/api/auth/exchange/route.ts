import { NextRequest, NextResponse } from "next/server"
import { exchangeCode, fromLoopback } from "@/lib/sso"

// ОБМЕН КОДА НА БИЛЕТ (узел, шаг 328-2). Зовёт только сервер элемента по петле машины: `{ code, origin }` → билет и кто это.
// Код одноразовый и годится только для источника, которому выдан. Браузер сюда не допускается.
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  if (!fromLoopback(req)) return NextResponse.json({ error: "loopback-only" }, { status: 403 })
  const body = (await req.json().catch(() => null)) as { code?: unknown; origin?: unknown } | null
  const code = typeof body?.code === "string" ? body.code : ""
  const origin = typeof body?.origin === "string" ? body.origin : ""
  const r = code && origin ? exchangeCode(code, origin) : null
  if (!r) return NextResponse.json({ error: "bad-code" }, { status: 400 })
  return NextResponse.json(r, { headers: { "Cache-Control": "no-store" } })
}
