import { timingSafeEqual } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { readRawDesign, writeDesignPatch } from "@/lib/settings/design-store"

// ДВЕРЬ НАСТРОЕК СЛУЖБЫ ВХОДА — ОФОРМЛЕНИЕ (узел Fractera, шаг 280-10).
//
// Тот же договор, что у сайта-стартера: ядро узла приходит без сессии, с ключом `SETTINGS_SECRET`
// (установщик генерирует его один раз и кладёт в оба конца). Ключа в окружении нет — дверь закрыта для
// всех. Запись не меняет страницы сама: их применяет развёртывание.

function keyOk(req: NextRequest): boolean {
  const expected = process.env.SETTINGS_SECRET ?? ""
  const given = req.headers.get("x-settings-key") ?? ""
  if (!expected || given.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected))
}

const denied = () => NextResponse.json({ ok: false, reason: "bad-key" }, { status: 401 })

export async function GET(req: NextRequest) {
  if (!keyOk(req)) return denied()
  return NextResponse.json({ ok: true, config: readRawDesign() }, { headers: { "Cache-Control": "no-store" } })
}

export async function PATCH(req: NextRequest) {
  if (!keyOk(req)) return denied()
  let patch: unknown
  try {
    patch = await req.json()
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-body" }, { status: 400 })
  }
  const result = writeDesignPatch(patch)
  if (!result.ok) return NextResponse.json(result, { status: result.reason === "bad-body" ? 400 : 500 })
  return NextResponse.json({ ok: true, config: result.config, rebuildNeeded: true })
}
