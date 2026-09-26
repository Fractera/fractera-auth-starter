// POST /api/settings/changed — сигнал CONFIG «версия сменилась» (узел, шаг 308). Ключ узла в `X-Settings-Key`.
// Забирает ветку `blocks` дизайна и, если она изменилась, перерисовывает страницы без пересборки.
import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { pullBlockSettings, signalKeyOk } from "@/lib/block-settings"

export async function POST(req: NextRequest) {
  if (!signalKeyOk(req.headers.get("x-settings-key"))) return NextResponse.json({ ok: false, reason: "bad-key" }, { status: 401 })
  const r = await pullBlockSettings()
  if (!r.ok) {
    console.warn(`[settings] сигнал CONFIG: забрать не удалось — ${r.reason}`)
    return NextResponse.json(r, { status: 502 })
  }
  // Перерисовка — по ЛЮБОМУ сигналу с ключом, а не только при изменении файла: собранные страницы могли быть
  // построены по другому DESIGN-CONFIG (сборка читает не тот путь, что сервер), и «файл не изменился» не значит «страницы
  // верны». ✗ Замерено на узле 2026-09-26: у данных файл уже нёс blocks, сигнал ответил «без изменений», страница осталась старой.
  revalidatePath("/", "layout")
  console.log(`[settings] сигнал CONFIG: ${r.changed ? "настройки блоков обновлены — страницы перерисованы" : "без изменений"}`)
  return NextResponse.json(r)
}
