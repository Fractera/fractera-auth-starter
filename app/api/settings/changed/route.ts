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
  if (r.changed) revalidatePath("/", "layout")
  console.log(`[settings] сигнал CONFIG: ${r.changed ? "настройки блоков обновлены — страницы перерисованы" : "без изменений"}`)
  return NextResponse.json(r)
}
