// @local — the one choice screen of the single sign-in door (803-1); nothing else shows it
import { Suspense } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { allowedReturn } from "@/lib/sso"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { continueAsWords, fillEmail } from "./_components/continue-as-words"

// 🔒 СТРАНИЦА ВЫБОРА ЕДИНОГО ВХОДА (шаг ядра 803-1). Измерено владельцем на заводе: архитектор узла вошёл в центре, пришёл на сайт
// приложения — и центр сразу выдал код его записи узла; человек, который хотел войти СВОЕЙ записью этого приложения, не мог.
// Теперь `/api/auth/sso` присылает сюда сессию, которую сайт признаёт, но которая не его человек (`admittedTo` — да, приложение
// записи — другое). Две ссылки: продолжить этой записью (`confirmed=1` — тот же код, что и прежде) или выйти из центра и войти другой
// записью на той же форме с тем же возвратом. Выбор — удобство, не замок: замок остаётся `admittedTo` в двери кода.
type Query = Promise<Record<string, string | string[] | undefined>>

export default function ContinueAsPage({ searchParams }: { searchParams: Query }) {
  return (
    <Suspense fallback={null}>
      <ContinueAsForRequest searchParams={searchParams} />
    </Suspense>
  )
}

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "")

async function ContinueAsForRequest({ searchParams }: { searchParams: Query }) {
  const q = await searchParams
  const ret = one(q.return)
  if (!allowedReturn(ret)) redirect("/login")
  const role = one(q.requireRole)
  const sso = `/api/auth/sso?return=${encodeURIComponent(ret)}${role ? `&requireRole=${encodeURIComponent(role)}` : ""}`
  const session = await auth()
  const email = session?.user?.email
  if (!email) redirect(sso)
  const w = continueAsWords((await headers()).get("accept-language"))
  // 805: the form waits for the same role the site asked for (no role named — a visitor): without it the form's legacy default
  // «architect» refused the element's own admin after a right password (measured by the owner on his server, 2026-11-19).
  const other = `/logout?redirectUrl=${encodeURIComponent(`/login?callbackUrl=${encodeURIComponent(sso)}&requireRole=${encodeURIComponent(role || "user")}`)}`

  // Plain links, not `next/link`: both lead to doors that answer 302 to another site — a soft navigation has nothing to render.
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-balance break-words">{fillEmail(w.title, email)}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <a href={`${sso}&confirmed=1`} className={buttonVariants({ className: "w-full h-auto min-h-9 whitespace-normal break-all" })}>
            {fillEmail(w.go, email)}
          </a>
          <a href={other} className={buttonVariants({ variant: "outline", className: "w-full" })}>
            {w.other}
          </a>
        </CardContent>
      </Card>
    </main>
  )
}
