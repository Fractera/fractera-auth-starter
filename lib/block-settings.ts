// НАСТРОЙКИ БЛОКОВ ИЗ CONFIG — НА ЛЕТУ (узел, шаг 308; слово владельца 2026-09-26: «если пользователь меняет … настройки
// блоков … такой же процесс который позволит на литу применить изменения»).
//
// Служба берёт у элемента CONFIG ветку `blocks` дизайна (ширина и размеры первого экрана) и кладёт её в свой
// `DESIGN-CONFIG` — тот же файл, куда ядро пишет остальное оформление. Когда: при старте (`instrumentation.ts`) и по
// сигналу CONFIG «версия сменилась» (`/api/settings/changed`), после чего страницы перерисовываются без пересборки.
// 🔒 Сигнал — не настройки: служба забирает их сама по MCP. Таймеров и опроса нет — только ответ на сохранение человеком.
// 🔒 Берётся ТОЛЬКО ветка `blocks`: цвета, шрифты и формы по-прежнему присылает ядро (дверь `/api/settings/design`).
// Перенос в другую службу и правила — `fractera-root-starter/lib/settings-listener.README.md` (тот же замысел).
import { readFileSync, writeFileSync, renameSync, mkdirSync, unlinkSync, existsSync } from "fs"
import { dirname, join } from "path"
import { timingSafeEqual } from "crypto"

const designPath = () => process.env.DESIGN_CONFIG_PATH ?? join(process.cwd(), "DESIGN-CONFIG", "design-config.json")
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const base = process.env.CONFIG_SERVICE_URL?.trim().replace(/\/+$/, "")
  const key = process.env.SETTINGS_SECRET?.trim()
  if (!base) throw new Error("no-config-element")
  if (!key) throw new Error("no-settings-key")
  const res = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "x-settings-key": key },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) throw new Error(`http-${res.status}`)
  const text = await res.text()
  const line = text.trimStart().startsWith("{") ? text : text.split("\n").find((l) => l.startsWith("data:"))?.slice(5) ?? ""
  const msg = JSON.parse(line) as { result?: { isError?: boolean; content?: { type: string; text: string }[] }; error?: { message?: string } }
  if (msg.error) throw new Error(`mcp: ${msg.error.message ?? "error"}`)
  const out = msg.result?.content?.find((c) => c.type === "text")?.text ?? ""
  if (msg.result?.isError) throw new Error(out || "tool-error")
  return JSON.parse(out)
}

export type BlockSettingsResult = { ok: true; changed: boolean } | { ok: false; reason: string }

/** Забрать ветку `blocks` дизайна у CONFIG и записать в свой DESIGN-CONFIG. Отказ ничего не стирает. */
export async function pullBlockSettings(): Promise<BlockSettingsResult> {
  let blocks: unknown
  try {
    const got = (await callTool("get_project_settings", { kind: "design" })) as { patches?: { design?: { blocks?: unknown } } }
    blocks = got?.patches?.design?.blocks
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) }
  }
  const file = designPath()
  let current: Record<string, unknown> = {}
  try { const p = JSON.parse(readFileSync(file, "utf8")); if (isObj(p)) current = p } catch { /* файла нет — тема службы */ }
  const next = { ...current }
  if (isObj(blocks) && Object.keys(blocks).length) next.blocks = blocks
  else delete next.blocks
  if (JSON.stringify(next.blocks ?? null) === JSON.stringify(current.blocks ?? null)) return { ok: true, changed: false }
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  try {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(tmp, JSON.stringify(next, null, 2) + "\n", "utf8")
    renameSync(tmp, file)
  } catch (err) {
    if (existsSync(tmp)) try { unlinkSync(tmp) } catch { /* уже нет */ }
    return { ok: false, reason: `write-failed: ${err instanceof Error ? err.message : err}` }
  }
  return { ok: true, changed: true }
}

/** Подписаться на сигнал CONFIG. Зовётся при каждом старте: у CONFIG одна запись на службу. */
export async function subscribeToConfig(who: string): Promise<{ ok: boolean; reason?: string; url?: string }> {
  const port = Number(process.env.PORT)
  if (!Number.isInteger(port) || port <= 0) return { ok: false, reason: "no-port" }
  const url = `http://127.0.0.1:${port}/api/settings/changed`
  try {
    await callTool("subscribe", { url, who })
    return { ok: true, url }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) }
  }
}

/** Сигнал пришёл с ключом узла? */
export function signalKeyOk(given: string | null): boolean {
  const expected = process.env.SETTINGS_SECRET ?? ""
  const g = given ?? ""
  if (!expected || g.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(g), Buffer.from(expected))
}
