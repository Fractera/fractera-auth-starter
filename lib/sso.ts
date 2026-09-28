import { randomBytes } from "node:crypto"
import { readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import type { NextRequest } from "next/server"

// ЕДИНЫЙ ВХОД ДЛЯ ДОМЕНОВ ЭЛЕМЕНТОВ (узел, шаг 328). Слово владельца 2026-09-28: «у пользователя могут быть сотни AGI ITEMS,
// у каждого может быть свой домен, и при этом их должна покрывать общая авторизация».
//
// Кука этой службы живёт на зоне узла (`COOKIE_DOMAIN`), и на чужой домен элемента браузер её не несёт. Поэтому центр отдаёт
// домену не куку, а ОДНОРАЗОВЫЙ КОД:
//   1. `GET /api/auth/sso?return=<https://домен/...>` — человек вошёл в центр → код, привязанный к адресу возврата, и 302 туда;
//   2. сервер элемента по петле машины: `POST /api/auth/exchange { code }` → БИЛЕТ (длинная случайная строка) и кто это;
//   3. элемент ставит билет своей кукой на свой адрес и на каждый запрос спрашивает `GET /api/auth/ticket` (петля).
// Выход в центре гасит все билеты человека (событие signOut) — на всех доменах сразу.
//
// 🔒 АДРЕС ВОЗВРАТА — ТОЛЬКО ПОДКЛЮЧЁННЫЕ ДОМЕНЫ УЗЛА (и их www) по https. Иначе дверь была бы открытой переадресацией,
// раздающей коды входа кому угодно. Список читается из записей элементов узла (`data/services/<id>/domain.json`), а не
// ведётся руками: подключили домен — он разрешён, отключили — нет.
// 🔒 ОБМЕН И ПРОВЕРКА — ТОЛЬКО С ПЕТЛИ МАШИНЫ (нет заголовков сети Cloudflare, хост — петля): билет знает сервер элемента,
// браузер его в центр не носит.
// 🛑 ЖУРНАЛ — В ПАМЯТИ ПРОЦЕССА. Перезапуск службы гасит билеты; человек, вошедший в центр, получает новый код без пароля.

export type Who = { userId: string; email: string | null; roles: string[] }

const CODE_TTL_MS = 60_000
const TICKET_TTL_MS = 30 * 24 * 60 * 60_000

type Store = {
  codes: Map<string, { who: Who; returnTo: string; exp: number }>
  tickets: Map<string, { who: Who; host: string; exp: number }>
}
// Next собирает каждую дверь отдельным пакетом — общий журнал держится на globalThis, иначе у двери выдачи и двери обмена
// были бы разные Map.
const g = globalThis as typeof globalThis & { __frSso?: Store }
const store: Store = (g.__frSso ??= { codes: new Map(), tickets: new Map() })

const random = () => randomBytes(32).toString("base64url")

function sweep(): void {
  const now = Date.now()
  for (const [k, v] of store.codes) if (v.exp < now) store.codes.delete(k)
  for (const [k, v] of store.tickets) if (v.exp < now) store.tickets.delete(k)
}

/** Собственные домены элементов узла (из их записей). */
export function connectedDomains(): string[] {
  const file = process.env.NODE_DOMAIN_FILE?.trim()
  if (!file) return []
  const services = join(dirname(dirname(file)), "data", "services")
  let ids: string[] = []
  try { ids = readdirSync(services) } catch { return [] }
  const out: string[] = []
  for (const id of ids) {
    try {
      const d = (JSON.parse(readFileSync(join(services, id, "domain.json"), "utf8")) as { domain?: unknown }).domain
      if (typeof d === "string" && /^[a-z0-9.-]+$/.test(d)) out.push(d)
    } catch { /* у элемента нет своего домена */ }
  }
  return out
}

/** Разрешён ли адрес возврата: https и хост — подключённый домен элемента или его www. */
export function allowedReturn(url: string): URL | null {
  let u: URL
  try { u = new URL(url) } catch { return null }
  if (u.protocol !== "https:") return null
  const host = u.hostname.toLowerCase()
  return connectedDomains().some((d) => host === d || host === `www.${d}`) ? u : null
}

export function issueCode(who: Who, returnTo: URL): string {
  sweep()
  const code = random()
  store.codes.set(code, { who, returnTo: returnTo.origin, exp: Date.now() + CODE_TTL_MS })
  return code
}

/** Код → билет. Код годится один раз и только для того источника, куда его отдали. */
export function exchangeCode(code: string, origin: string): { ticket: string; who: Who } | null {
  sweep()
  const c = store.codes.get(code)
  store.codes.delete(code)
  if (!c || c.exp < Date.now() || c.returnTo !== origin) return null
  const ticket = random()
  store.tickets.set(ticket, { who: c.who, host: new URL(origin).hostname, exp: Date.now() + TICKET_TTL_MS })
  return { ticket, who: c.who }
}

export function whoByTicket(ticket: string): Who | null {
  const t = store.tickets.get(ticket)
  if (!t || t.exp < Date.now()) return null
  return t.who
}

/** Выход в центре: все билеты этого человека гаснут. */
export function revokeUser(userId: string): number {
  let n = 0
  for (const [k, v] of store.tickets) if (v.who.userId === userId) { store.tickets.delete(k); n++ }
  return n
}

/** Запрос с петли машины: хост — петля, заголовков сети Cloudflare нет. */
export function fromLoopback(req: NextRequest): boolean {
  if (req.headers.get("cf-connecting-ip") || req.headers.get("cf-ray") || req.headers.get("x-forwarded-host")) return false
  const host = (req.headers.get("host") ?? "").toLowerCase().replace(/:\d+$/, "")
  return host === "127.0.0.1" || host === "localhost" || host === "[::1]"
}
