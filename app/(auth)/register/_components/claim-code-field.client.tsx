"use client"
// @local — the architect's claim on the register form (one route: /register): the code field (739) or the e-mail line (796-1)

import { useEffect, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// 739-1, 796-1: the form asks the element's own door what a waiting claim is (`GET /api/claim` → `{ pending, kind }`): a code claim shows
// the code field, an e-mail claim shows only one line above the form — no field. The words come from the form as props
// (`check:lang-delivery`: no dictionary in a client file).

export type ClaimKind = "email" | "code" | null

export function useClaimKind(): ClaimKind {
  const [kind, setKind] = useState<ClaimKind>(null)
  useEffect(() => {
    void fetch("/api/claim", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((a: { pending?: boolean; kind?: string } | null) => setKind(a?.pending ? (a.kind === "email" ? "email" : "code") : null))
      .catch(() => setKind(null))
  }, [])
  return kind
}

export function ClaimEmailNotice({ text }: { text: string }) {
  return (
    <Alert data-block="register-claim-email">
      <AlertDescription>{text}</AlertDescription>
    </Alert>
  )
}

export function ClaimCodeField({ label, hint, value, onChange, disabled }: { label: string; hint: string; value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <div className="flex flex-col gap-1.5" data-block="register-claim-code">
      <Label htmlFor="reg-claim">{label}</Label>
      <Input autoComplete="off" disabled={disabled} id="reg-claim" onChange={(e) => onChange(e.target.value)} placeholder="XXXX-XXXX-XXXX" required value={value} />
      <p className="text-muted-foreground text-xs">{hint}</p>
    </div>
  )
}
