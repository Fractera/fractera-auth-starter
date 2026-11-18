// THE ARCHITECT'S CLAIM ON A FRESH SERVER (node step 739-1, decisions D27–D30). The owner, 2026-11-14: «да, D23 в 739».
// The first node account is the architect for good (`register.ts`, `sqlite-adapter.ts`). On a person's computer it is made at the keyboard
// before any public name exists; a server launched from the core's page opens its public names first — a stranger who reads them in the
// certificate logs could register first. So the core, at the server's last launch step, asks this element (`POST /api/claim`, the lock
// `x-architect-token`, loopback only) for a one-time code: the element makes it, keeps only its SHA-256 here, and gives the code back once.
// While a claim waits and no node account exists, the first registration needs the code — by the form only (D29: Google and the magic
// link create no first account then); the first registration ends the claim. No claim (a computer) — the rule is as before (D30).
// 🔒 The code never lands in a file or a log: only its hash, in this element's own `data/` (outside git).
// 796-1 (approved by the owner, Telegram 690): the core may claim by the architect's e-mail instead — `POST /api/claim {email}` keeps
// the SHA-256 of the trimmed lower-cased e-mail (never the e-mail); while it waits, the first node account is made only with that
// e-mail (any letter case) and becomes the architect. A body-less POST keeps the code of 739, so older servers do not break.
import { createHash, randomInt, timingSafeEqual } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import type Database from "better-sqlite3"

const FILE = () => path.join(process.env.CLAIM_DIR ?? path.join(process.cwd(), "data"), "claim.json")
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no 0/O, 1/I: a code read off a screen
const sha = (s: string) => createHash("sha256").update(s).digest("hex")
/** What the person types → the code's own form: upper case, no spaces or dashes. */
export const normalizeCode = (s: string) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "")

/** An e-mail's own form for the claim: trimmed, lower case. */
export const normalizeEmail = (s: string) => String(s ?? "").trim().toLowerCase()
export type ClaimKind = "email" | "code"
type Kept = { hash: string; at: string; kind: ClaimKind }

function read(): Kept | null {
  try {
    const j = JSON.parse(readFileSync(FILE(), "utf8"))
    if (typeof j?.hash !== "string" || j.hash.length !== 64) return null
    return { hash: j.hash, at: String(j.at ?? ""), kind: j.kind === "email" ? "email" : "code" } // a 739 file has no kind: a code
  } catch { return null }
}

function keep(hash: string, kind: ClaimKind): void {
  mkdirSync(path.dirname(FILE()), { recursive: true })
  writeFileSync(FILE(), `${JSON.stringify({ hash, kind, at: new Date().toISOString() })}\n`, { mode: 0o600 })
}

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

/** A new code (12 characters, shown as XXXX-XXXX-XXXX); it replaces any earlier one. */
export function issueClaim(): string {
  const raw = Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")
  keep(sha(raw), "code")
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`
}

/** A claim waits: a code was issued and the node has no account yet. */
export function claimPending(db: Database.Database): boolean {
  if (!read()) return false
  return !nodeAccountExists(db)
}

/** 796-1: an e-mail claim; it replaces any earlier claim, a code one too. False when the value is not an e-mail. */
export function issueEmailClaim(email: string): boolean {
  const e = normalizeEmail(email)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return false
  keep(sha(e), "email")
  return true
}

/** The kind of the kept claim, or null when none is kept. */
export function claimKind(): ClaimKind | null {
  return read()?.kind ?? null
}

export function claimMatches(code: string): boolean {
  const c = read()
  if (!c || c.kind !== "code") return false
  return same(sha(normalizeCode(code)), c.hash)
}

export function claimMatchesEmail(email: string): boolean {
  const c = read()
  if (!c || c.kind !== "email") return false
  return same(sha(normalizeEmail(email)), c.hash)
}

const nodeAccountExists = (db: Database.Database) => Boolean(db.prepare("SELECT id FROM users WHERE app = 'node' LIMIT 1").get())

/**
 * The gate of the first node account made by the register form (`register.ts`). `claimed` — a claim was met and must end once the
 * account is written; `error` — refused: `claim-email` (another e-mail than the claimed one) or `claim-code` (739).
 */
export function firstAccountGate(db: Database.Database, isFirst: boolean, email: string, code: string): { ok: boolean; claimed: boolean; error?: "claim-email" | "claim-code" } {
  if (!isFirst || !claimPending(db)) return { ok: true, claimed: false }
  if (claimKind() === "email") return claimMatchesEmail(email) ? { ok: true, claimed: true } : { ok: false, claimed: true, error: "claim-email" }
  return claimMatches(code) ? { ok: true, claimed: true } : { ok: false, claimed: true, error: "claim-code" }
}

/** `GET /api/claim`: whether a claim waits, its kind, whether a node account exists — never the e-mail, never the hash. */
export function claimStatus(db: Database.Database): { pending: boolean; kind: ClaimKind | null; claimed: boolean } {
  const claimed = nodeAccountExists(db)
  const pending = !claimed && claimKind() !== null
  return { pending, kind: pending ? claimKind() : null, claimed }
}

/** The door's lock: `x-architect-token` equals `ARCHITECT_TOKEN` (unset → always refused). */
export function architectTokenOk(given: string | null | undefined): boolean {
  const expected = process.env.ARCHITECT_TOKEN ?? ""
  return Boolean(expected) && same(String(given ?? ""), expected)
}

export function endClaim(): void {
  if (existsSync(FILE())) rmSync(FILE(), { force: true })
}
