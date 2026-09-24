import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, unlinkSync } from "fs"
import { dirname, join } from "path"
import { getDesignConfigPath } from "@/config/design-config"

// ЗАПИСЬ `DESIGN-CONFIG` СЛУЖБЫ ВХОДА — ТОЛЬКО ДВЕРЬЮ НАСТРОЕК (шаг 280-10).
//
// Те же приёмы, что у писателя сайта-стартера: заплата вместо снимка (ветки fonts/type/shape/colors
// правят порознь), слияние спускается в light/dark, `null` стирает ключ, запись атомарна через
// временный файл.

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v)

function merge(base: unknown, patch: Obj): Obj {
  const out: Obj = isObj(base) ? { ...base } : {}
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete out[k]
    else out[k] = isObj(v) ? merge(out[k], v) : v
  }
  return out
}

export function readRawDesign(): Obj {
  try {
    const parsed: unknown = JSON.parse(readFileSync(getDesignConfigPath(), "utf8"))
    return isObj(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function writeDesignPatch(patch: unknown): { ok: true; config: Obj } | { ok: false; reason: string } {
  if (!isObj(patch)) return { ok: false, reason: "bad-body" }
  const path = getDesignConfigPath()
  const next = merge(readRawDesign(), patch)
  const tmp = join(dirname(path), `.design-config.${process.pid}.${Date.now()}.tmp`)
  try {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(tmp, JSON.stringify(next, null, 2) + "\n", "utf8")
    renameSync(tmp, path)
    return { ok: true, config: next }
  } catch {
    if (existsSync(tmp)) try { unlinkSync(tmp) } catch { /* уже нет */ }
    return { ok: false, reason: "write-failed" }
  }
}
