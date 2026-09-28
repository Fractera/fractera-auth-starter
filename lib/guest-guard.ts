import type Database from "better-sqlite3"
import { readFileSync, statSync } from "node:fs"
import { dirname, join } from "node:path"
import { getDb } from "@/lib/db"
import { revokeUser } from "@/lib/sso"

// ЗАЩИТА ОТ ЗАТОПЛЕНИЯ ГОСТЯМИ (узел, шаги 331-4, 331-5). ✗ Замерено 331-3: один голый GET `/api/auth/guest` без куки создавал
// запись в базе, и генератор запросов раз в полсекунды рос бы базу без предела. Слово владельца: ограничить число обращений с
// одного IP «на каком-то предварительном слое» без базы, а общее число гостевых записей — потолком с вытеснением.
// Выборы владельца 2026-09-28: вытеснять «давно неактивных», потолок по умолчанию 5000, настройка — в самой службе входа.
//
// Два слоя, и гарантию даёт второй. Лимит по IP живёт в памяти процесса — дёшев, но ботнет с тысячей адресов его обходит.
// Потолок держит размер базы при ЛЮБОЙ атаке; цена названа вслух — затопление вытесняет давно неактивных гостей первыми.

const num = (v: string | undefined, d: number, min: number) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= min ? Math.floor(n) : d
}

// 🔒 НАСТРОЙКА ЖИВЁТ В ДАННЫХ САМОЙ СЛУЖБЫ ВХОДА, А НЕ В `.env`: `.env.example` — вопросы установщику, и `.env.local` он
// переписывает при каждой установке. Файл `guest-limits.json` лежит рядом с базой (папка из `DATABASE_URL`, то есть
// `<узел>/data/services/auth/`), читается на лету — правка действует без перезапуска. Нет файла или поля — умолчание.
//   { "max": 5000, "ipLimit": 5, "ipWindowSec": 3600 }
// Карточка этих настроек в ядре («Authorization») — позже, по слову владельца 2026-09-28.
const DEFAULTS = { max: 5000, ipLimit: 5, ipWindowSec: 3600 }

function settingsFile(): string {
  const db = process.env.DATABASE_URL?.replace(/^file:/, "") || join(process.cwd(), "data", "auth.db")
  return join(dirname(db), "guest-limits.json")
}

let cached: { mtime: number; value: typeof DEFAULTS } | null = null

/** Потолок гостевых записей и лимит создания гостей с одного IP за окно (секунды). */
export function guestSettings(): typeof DEFAULTS {
  const file = settingsFile()
  let mtime = 0
  try { mtime = statSync(file).mtimeMs } catch { return DEFAULTS }
  if (cached && cached.mtime === mtime) return cached.value
  let raw: Record<string, unknown> = {}
  try { raw = JSON.parse(readFileSync(file, "utf8")) } catch { /* битый файл — умолчание, не отказ входа */ }
  const value = {
    max: num(String(raw.max ?? ""), DEFAULTS.max, 1),
    ipLimit: num(String(raw.ipLimit ?? ""), DEFAULTS.ipLimit, 1),
    ipWindowSec: num(String(raw.ipWindowSec ?? ""), DEFAULTS.ipWindowSec, 1),
  }
  cached = { mtime, value }
  return value
}

// ── Слой 1: лимит по IP, в памяти, без базы ─────────────────────────────────────────────────────────────────────────
type Hits = { n: number; since: number }
const g = globalThis as unknown as { __guestIp?: Map<string, Hits>; __guestTouch?: Map<string, number> }
const hits = (g.__guestIp ??= new Map())

/** Настоящий адрес посетителя: снаружи к узлу приходят только через туннель Cloudflare, и он называет адрес сам. */
export function clientIp(headers: Headers): string {
  return headers.get("cf-connecting-ip")?.trim()
    || headers.get("x-forwarded-for")?.split(",")[0].trim()
    || "local"
}

/** Можно ли создать ещё одного гостя с этого адреса; да — попытка засчитывается. */
export function takeGuestSlot(ip: string): boolean {
  const { ipLimit, ipWindowSec } = guestSettings()
  const now = Date.now()
  const win = ipWindowSec * 1000
  if (hits.size > 10000) for (const [k, v] of hits) if (now - v.since > win) hits.delete(k)
  const h = hits.get(ip)
  if (!h || now - h.since > win) { hits.set(ip, { n: 1, since: now }); return true }
  if (h.n >= ipLimit) return false
  h.n += 1
  return true
}

// ── Слой 2: потолок гостевых записей с вытеснением давно неактивных ────────────────────────────────────────────────────
const GUEST = "provider = 'guest'"

function evict(db: Database.Database, ids: string[]) {
  for (const id of ids) {
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id)
    db.prepare("DELETE FROM accounts WHERE user_id = ?").run(id)
    db.prepare("DELETE FROM users WHERE id = ?").run(id)
  }
}

/** Создать гостя, освободив место под потолком; вытесненные гаснут и в билетах единого входа. */
export function createGuest(id: string, email: string): { evicted: number } {
  const db = getDb()
  const { max } = guestSettings()
  let gone: string[] = []
  db.transaction(() => {
    const { n } = db.prepare(`SELECT count(*) AS n FROM users WHERE ${GUEST}`).get() as { n: number }
    if (n >= max) {
      gone = (db.prepare(
        `SELECT id FROM users WHERE ${GUEST} ORDER BY coalesce(last_login_at, created_at) ASC LIMIT ?`,
      ).all(n - max + 1) as { id: string }[]).map((r) => r.id)
      evict(db, gone)
    }
    db.prepare(
      "INSERT INTO users (id, email, nickname, roles, provider, last_login_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
    ).run(id, email, "Guest", JSON.stringify(["guest"]), "guest")
  })()
  for (const u of gone) revokeUser(u)
  return { evicted: gone.length }
}

// ── Жива ли запись: сессия и билет вытесненного не должны узнавать «призрака» ───────────────────────────────────────────
const touched = (g.__guestTouch ??= new Map())
const TOUCH_MS = 10 * 60 * 1000

/** Запись есть — да; у гостя заодно отмечает активность не чаще раза в 10 минут (вытесняются давно неактивные). */
export function userAlive(id: string | null | undefined): boolean {
  if (!id) return false
  const db = getDb()
  const row = db.prepare("SELECT 1 AS ok FROM users WHERE id = ?").get(id) as { ok: number } | undefined
  if (!row) { touched.delete(id); return false }
  const now = Date.now()
  if (now - (touched.get(id) ?? 0) > TOUCH_MS) {
    touched.set(id, now)
    db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ? AND provider = 'guest'").run(id)
  }
  return true
}
