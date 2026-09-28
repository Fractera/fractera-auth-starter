import { NextResponse } from "next/server"
import { auth } from "@/lib/auth/auth"
import { allowedReturn, issueCode } from "@/lib/sso"
import { userAlive } from "@/lib/guest-guard"

// ВЫДАЧА КОДА ДОМЕНУ ЭЛЕМЕНТА (узел, шаг 328-2). Кнопка «Войти» на собственном домене элемента ведёт сюда с адресом возврата
// (`return` — дверь элемента `/api/auth/callback`). Не вошёл — сначала страница входа этого центра, и сюда же обратно (тот же
// источник — его отпускает `redirect` конфигурации). Вошёл — одноразовый код к адресу возврата и 302 туда. Адрес возврата —
// только подключённые домены узла (`lib/sso.ts`); чужой — 400, без переадресации. `guest=1` — вместо формы входа гость (331).

export const GET = auth(function GET(req) {
  const ret = req.nextUrl.searchParams.get("return") ?? ""
  const target = allowedReturn(ret)
  if (!target) return NextResponse.json({ error: "return-not-allowed" }, { status: 400 })
  const base = process.env.NEXTAUTH_URL ?? req.url
  // 331-5: запись вытеснена или удалена — сессия «призрака» не считается входом.
  const user = req.auth?.user && userAlive(req.auth.user.id) ? req.auth.user : undefined
  if (!user) {
    // 🔒 331: ГОСТЕВАЯ ВЕТКА ЭЛЕМЕНТА (`guest=1`). Не форма входа, а гость: `/api/auth/guest` создаёт пользователя с ролью
    // `guest` и возвращает сюда же с меткой `tried=1`, дальше — тот же код. Вернулся с меткой и без сессии (кука центра не
    // легла) — назад на сайт БЕЗ кода: замок элемента скажет об отказе и не пойдёт снова; иначе каждый круг плодил бы гостя.
    if (req.nextUrl.searchParams.get("guest") === "1") {
      if (req.nextUrl.searchParams.get("tried") === "1") return NextResponse.redirect(target, 302)
      const back = `/api/auth/sso?return=${encodeURIComponent(ret)}&guest=1&tried=1`
      return NextResponse.redirect(new URL(`/api/auth/guest?redirectUrl=${encodeURIComponent(back)}`, base), 302)
    }
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
