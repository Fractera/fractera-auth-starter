// @api the architect's claim of a fresh server by e-mail or code
import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/auth/db"
import { fromOutside } from "@/lib/a2a/boundary"
import { architectTokenOk, claimStatus, issueClaim, issueEmailClaim } from "@/lib/auth/claim"

// THE CLAIM DOOR (node steps 739-1, 796-1). `GET` — anyone (the register form asks what to show): `{ pending, kind, claimed }`, never the
// e-mail, never a hash. `POST` — the core only: the lock `x-architect-token` = `ARCHITECT_TOKEN` and only the machine's loopback — through
// a public name the door answers 404. With a JSON body `{ email }` it keeps the SHA-256 of the trimmed lower-cased e-mail and answers
// `{ ok, kind: "email" }`; without a body it makes a one-time code as in 739 and returns it once. A new claim replaces the old one;
// refused once the node has an account (`claimed`, 409).
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })

export async function GET() {
  return json({ ok: true, ...claimStatus(getDb()) })
}

export async function POST(req: NextRequest) {
  if (fromOutside(req.headers)) return new NextResponse(null, { status: 404 })
  if (!architectTokenOk(req.headers.get("x-architect-token"))) return json({ ok: false, error: "bad-key" }, 401)
  if (claimStatus(getDb()).claimed) return json({ ok: false, error: "claimed" }, 409)
  const text = await req.text().catch(() => "")
  if (!text.trim()) return json({ ok: true, kind: "code", code: issueClaim() })
  let body: { email?: unknown } | null = null
  try { body = JSON.parse(text) } catch { return json({ ok: false, error: "bad-json" }, 400) }
  if (body?.email === undefined) return json({ ok: true, kind: "code", code: issueClaim() })
  if (typeof body.email !== "string" || !issueEmailClaim(body.email)) return json({ ok: false, error: "bad-email" }, 400)
  return json({ ok: true, kind: "email" })
}
