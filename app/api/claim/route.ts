// @api the architect's one-time claim code of a fresh server
import { timingSafeEqual } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/auth/db"
import { fromOutside } from "@/lib/a2a/boundary"
import { claimPending, issueClaim } from "@/lib/auth/claim"

// THE CLAIM DOOR (node step 739-1). `GET` — anyone (the register form asks whether to show the code field): `{ pending }`, nothing else.
// `POST` — the core only: the lock `x-architect-token` = `ARCHITECT_TOKEN` (the core and this element hold it, nobody else) and only the
// machine's loopback — through a public name the door answers 404. It makes a new code, keeps its hash and returns the code once;
// refused once the node has an account (`claimed`).
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })

function tokenOk(given: string | null): boolean {
  const expected = process.env.ARCHITECT_TOKEN ?? ""
  const g = given ?? ""
  if (!expected || g.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(g), Buffer.from(expected))
}

export async function GET() {
  return json({ ok: true, pending: claimPending(getDb()) })
}

export async function POST(req: NextRequest) {
  if (fromOutside(req.headers)) return new NextResponse(null, { status: 404 })
  if (!tokenOk(req.headers.get("x-architect-token"))) return json({ ok: false, error: "bad-key" }, 401)
  if (getDb().prepare("SELECT id FROM users WHERE app = 'node' LIMIT 1").get()) return json({ ok: false, error: "claimed" }, 409)
  return json({ ok: true, code: issueClaim() })
}
