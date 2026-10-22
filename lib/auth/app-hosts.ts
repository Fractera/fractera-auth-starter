import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"

// АДРЕС → ЭЛЕМЕНТ УЗЛА (узел, шаг 554-3). Только файлы узла, без базы: этим пользуется и прокси (решает, вести ли вход через билет),
// и двери входа (решают, в каком приложении человек). Корень узла — из `NODE_DOMAIN_FILE` (`<узел>/logs/domain.json`), как у
// `lib/sso.ts`. Элемент сайта: собственный домен (`data/services/<id>/domain.json`, и его www) или поддомен зоны узла —
// адрес элемента (реестр → `data/services/<id>/address.json` → id). Ядро, вход и встроенные элементы — не «приложения»: только
// кастомные (`kind: user`), кроме root (корень проекта).

type Entry = { id: string; kind?: string; address?: string }

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

/** Узел — завод приложений (553): поле `nodeType` реестра. */
export function isFactory(): boolean {
  const root = nodeRoot()
  return !!root && registry(root).nodeType === "factory"
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

/** На заводе вход в приложение идёт билетом и для поддомена элемента: `allowedReturn` пускает его сайт. */
export function factoryElementHost(host: string): boolean {
  return isFactory() && elementOfHost(host) !== null
}
