// POST /api/settings/changed — сигнал элемента «Дизайн» «версия сменилась» (узел, шаги 308–309). Ключ узла в `X-Settings-Key`.
// Забирает оформление проекта (цвета, шрифты, текст, формы, блоки) и перерисовывает страницы без пересборки.
import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { pullDesign, signalKeyOk } from "@/lib/design-follow"

export async function POST(req: NextRequest) {
  if (!signalKeyOk(req.headers.get("x-settings-key"))) return NextResponse.json({ ok: false, reason: "bad-key" }, { status: 401 })
  const r = await pullDesign()
  if (!r.ok) {
    console.warn(`[design] сигнал: забрать не удалось — ${r.reason}`)
    return NextResponse.json(r, { status: 502 })
  }
  // Перерисовка — по ЛЮБОМУ сигналу с ключом: собранные страницы могли быть построены по другому DESIGN-CONFIG (сборка
  // читает не тот путь, что сервер), и «файл не изменился» не значит «страницы верны» (замерено на узле 2026-09-26).
  revalidatePath("/", "layout")
  console.log(`[design] сигнал: ${r.changed ? "оформление обновлено" : "без изменений"} — страницы перерисованы`)
  return NextResponse.json(r)
}
