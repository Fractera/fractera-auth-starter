import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"

// АДРЕС → ЭЛЕМЕНТ УЗЛА (узел, шаг 554-3). Только файлы узла, без базы: этим пользуется и прокси (решает, вести ли вход через билет),
// и двери входа (решают, в каком приложении человек). Корень узла — из `NODE_DOMAIN_FILE` (`<узел>/logs/domain.json`), как у
// `lib/sso.ts`. Элемент сайта: собственный домен (`data/services/<id>/domain.json`, и его www) или поддомен зоны узла —
// адрес элемента (реестр → `data/services/<id>/address.json` → id). Ядро, вход и встроенные элементы — не «приложения»: только
// кастомные (`kind: user`), кроме root (корень проекта).

type Entry = { id: string; kind?: string; address?: string; app?: string; born?: unknown; adminRole?: string }

function nodeRoot(): string | null {
  const file = process.env.NODE_DOMAIN_FILE?.trim()
  return file ? dirname(dirname(file)) : null
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T
  } catch {
    return null
  }
}

function registry(root: string): { nodeType?: string; services?: Entry[] } {
  return readJson(join(root, "WEB4-ITEMS-REGISTRY", "web4-items.json")) ?? {}
}

/** Шаг ядра 804: у узла больше нет типа — каждый рождённый элемент ответил при рождении, часть ли он проекта (`app: "project"`) или
 *  самостоятельное приложение (`app: "own"`). Запись до 804 без ответа читает прежний тип узла (`nodeType: factory` — своё приложение),
 *  то же правило, что у ядра (`lib/web4-items/element-app.cjs`). */
function isOwnApp(e: Entry, nodeType: string | undefined): boolean {
  if (e.app === "own") return true
  if (e.app === "project") return false
  return !!e.born && nodeType === "factory"
}

function zoneOf(root: string): string | null {
  const z = readJson<{ zone?: unknown }>(join(root, "logs", "domain.json"))?.zone
  return typeof z === "string" && z ? z.toLowerCase() : null
}

/** Кастомный элемент, чей сайт живёт на этом хосте, или null. */
export function elementOfHost(rawHost: string): string | null {
  const root = nodeRoot()
  if (!root) return null
  const host = rawHost.toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "")
  const apps = (registry(root).services ?? []).filter((e) => e.kind === "user" && e.id !== "root")
  for (const e of apps) {
    const d = readJson<{ domain?: unknown }>(join(root, "data", "services", e.id, "domain.json"))?.domain
    if (typeof d === "string" && d.toLowerCase() === host) return e.id
  }
  const zone = zoneOf(root)
  if (!zone || !host.endsWith(`.${zone}`)) return null
  const label = host.slice(0, -(zone.length + 1))
  for (const e of apps) {
    const a = readJson<{ address?: unknown }>(join(root, "data", "services", e.id, "address.json"))?.address
    const own = typeof e.address === "string" && e.address ? e.address : typeof a === "string" && a ? a : e.id
    if (own === label) return e.id
  }
  return null
}

/** Адрес, куда человек в итоге вернётся: внутрь `/login|/register?callbackUrl=` и `/api/auth/sso?return=`. */
export function finalReturn(raw: string | null | undefined, base: string): URL | null {
  let u: URL
  try { u = new URL(raw ?? "", base) } catch { return null }
  for (let i = 0; i < 4; i++) {
    const inner = u.pathname === "/api/auth/sso" ? u.searchParams.get("return")
      : u.pathname === "/login" || u.pathname === "/register" ? u.searchParams.get("callbackUrl")
      : null
    if (!inner) break
    try { u = new URL(inner, u) } catch { return null }
  }
  return u
}

/** Сайт самостоятельного приложения на этом хосте (его свой домен или поддомен зоны): вход в него идёт билетом и для поддомена —
 *  `allowedReturn` пускает его сайт, прокси заворачивает его `/login` в единый вход. 805: прежде — «узел завод» (`nodeType`), а тип
 *  ушёл из реестра в шаге ядра 804, и вход по поддомену приложения перестал бы заворачиваться. */
export function ownAppHost(host: string): boolean {
  const root = nodeRoot()
  if (!root) return false
  const id = elementOfHost(host)
  if (!id) return false
  const reg = registry(root)
  const e = (reg.services ?? []).find((x) => x.id === id)
  return !!e && isOwnApp(e, reg.nodeType)
}

/** 805: the element's own admin role (`adminRole` of its registry entry, elementAdmin001…980, step 778) — or null. */
export function adminRoleOf(id: string): string | null {
  const root = nodeRoot()
  if (!root) return null
  const e = (registry(root).services ?? []).find((x) => x.id === id)
  return typeof e?.adminRole === "string" && /^elementAdmin\d{3}$/.test(e.adminRole) ? e.adminRole : null
}
