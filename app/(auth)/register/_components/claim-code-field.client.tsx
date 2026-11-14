"use client"
// @local — the architect's code field of the register form (one route: /register), shown only while a fresh server waits for its architect

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// 739-1: the form asks the element's own door whether a claim waits (`GET /api/claim` → `{ pending }`); only then the field appears.
// The words come from the form as props (`check:lang-delivery`: no dictionary in a client file).

export function ClaimCodeField({ label, hint, value, onChange, disabled }: { label: string; hint: string; value: string; onChange: (v: string) => void; disabled: boolean }) {
  const [pending, setPending] = useState(false)
  useEffect(() => {
    void fetch("/api/claim", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((a: { pending?: boolean } | null) => setPending(Boolean(a?.pending))).catch(() => setPending(false))
  }, [])
  if (!pending) return null
  return (
    <div className="flex flex-col gap-1.5" data-block="register-claim-code">
      <Label htmlFor="reg-claim">{label}</Label>
      <Input autoComplete="off" disabled={disabled} id="reg-claim" onChange={(e) => onChange(e.target.value)} placeholder="XXXX-XXXX-XXXX" required value={value} />
      <p className="text-muted-foreground text-xs">{hint}</p>
    </div>
  )
}
