// THE ARCHITECT'S CLAIM ON A FRESH SERVER (node step 739-1, decisions D27–D30). The owner, 2026-11-14: «да, D23 в 739».
// The first node account is the architect for good (`register.ts`, `sqlite-adapter.ts`). On a person's computer it is made at the keyboard
// before any public name exists; a server launched from the core's page opens its public names first — a stranger who reads them in the
// certificate logs could register first. So the core, at the server's last launch step, asks this element (`POST /api/claim`, the lock
// `x-architect-token`, loopback only) for a one-time code: the element makes it, keeps only its SHA-256 here, and gives the code back once.
// While a claim waits and no node account exists, the first registration needs the code — by the form only (D29: Google and the magic
// link create no first account then); the first registration ends the claim. No claim (a computer) — the rule is as before (D30).
// 🔒 The code never lands in a file or a log: only its hash, in this element's own `data/` (outside git).
import { createHash, randomInt, timingSafeEqual } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import type Database from "better-sqlite3"

const FILE = () => path.join(process.env.CLAIM_DIR ?? path.join(process.cwd(), "data"), "claim.json")
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no 0/O, 1/I: a code read off a screen
const sha = (s: string) => createHash("sha256").update(s).digest("hex")
/** What the person types → the code's own form: upper case, no spaces or dashes. */
export const normalizeCode = (s: string) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "")

function read(): { hash: string; at: string } | null {
  try {
    const j = JSON.parse(readFileSync(FILE(), "utf8"))
    return typeof j?.hash === "string" && j.hash.length === 64 ? j : null
  } catch { return null }
}

/** A new code (12 characters, shown as XXXX-XXXX-XXXX); it replaces any earlier one. */
export function issueClaim(): string {
  const raw = Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")
  mkdirSync(path.dirname(FILE()), { recursive: true })
  writeFileSync(FILE(), `${JSON.stringify({ hash: sha(raw), at: new Date().toISOString() })}\n`, { mode: 0o600 })
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`
}

/** A claim waits: a code was issued and the node has no account yet. */
export function claimPending(db: Database.Database): boolean {
  if (!read()) return false
  return !db.prepare("SELECT id FROM users WHERE app = 'node' LIMIT 1").get()
}

export function claimMatches(code: string): boolean {
  const c = read()
  if (!c) return false
  const given = Buffer.from(sha(normalizeCode(code)))
  return timingSafeEqual(given, Buffer.from(c.hash))
}

export function endClaim(): void {
  if (existsSync(FILE())) rmSync(FILE(), { force: true })
}
