import { NextResponse } from "next/server"
import { auth } from "@/lib/auth/auth"
import { allowedReturn, issueCode } from "@/lib/sso"

// ВЫДАЧА КОДА ДОМЕНУ ЭЛЕМЕНТА (узел, шаг 328-2). Кнопка «Войти» на собственном домене элемента ведёт сюда с адресом возврата
// (`return` — дверь элемента `/api/auth/callback`). Не вошёл — сначала страница входа этого центра, и сюда же обратно (тот же
// источник — его отпускает `redirect` конфигурации). Вошёл — одноразовый код к адресу возврата и 302 туда. Адрес возврата —
// только подключённые домены узла (`lib/sso.ts`); чужой — 400, без переадресации.
export const dynamic = "force-dynamic"

export const GET = auth(function GET(req) {
  const ret = req.nextUrl.searchParams.get("return") ?? ""
  const target = allowedReturn(ret)
  if (!target) return NextResponse.json({ error: "return-not-allowed" }, { status: 400 })
  const base = process.env.NEXTAUTH_URL ?? req.url
  const user = req.auth?.user
  if (!user) {
    const again = `/api/auth/sso?return=${encodeURIComponent(ret)}`
    const role = req.nextUrl.searchParams.get("requireRole")
    const login = new URL(`/login?callbackUrl=${encodeURIComponent(again)}${role ? `&requireRole=${encodeURIComponent(role)}` : ""}`, base)
    return NextResponse.redirect(login, 302)
  }
  const code = issueCode(
    { userId: String(user.id), email: user.email ?? null, roles: (user as { roles?: string[] }).roles ?? ["user"] },
    target,
  )
  target.searchParams.set("code", code)
  return NextResponse.redirect(target, 302)
})
