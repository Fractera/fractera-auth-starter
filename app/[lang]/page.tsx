import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

// СТРАНИЦА-ПРЕЗЕНТАЦИЯ СЛУЖБЫ ВХОДА (узел Fractera; слово владельца 2026-09-24: у входа и данных должна
// существовать страница на `app/[lang]/page`, чтобы из ядра смотреть их содержимое и видеть, как к ним
// применяется оформление). Самый минимальный интерфейс: что это за служба и две кнопки.
//
// 🔒 Только собственные языки страницы; прочие адреса вида `/<что-то>` не перехватываются — статические
// маршруты входа (`/login`, `/register`…) важнее динамического сегмента, а незнакомый язык — 404.
const WORDS = {
  en: {
    title: "Sign-in service",
    lead: "The one place where people of this node sign in: email and password, and the providers you switch on in the core.",
    signIn: "Sign in",
    register: "Create an account",
  },
  ru: {
    title: "Служба входа",
    lead: "Единственное место, где люди этого узла входят: почта и пароль, а также провайдеры, которые вы включаете в ядре.",
    signIn: "Войти",
    register: "Создать аккаунт",
  },
} as const

type Lang = keyof typeof WORDS

export const dynamicParams = false

export function generateStaticParams() {
  return Object.keys(WORDS).map((lang) => ({ lang }))
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const w = WORDS[(lang in WORDS ? lang : "en") as Lang]
  return { title: w.title }
}

export default async function AuthPresentation({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!(lang in WORDS)) notFound()
  const w = WORDS[lang as Lang]
  return (
    <main className="flex flex-1 items-center justify-center bg-background p-6 text-foreground">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-[var(--radius)] border border-border bg-card p-8 text-card-foreground">
        <h1 className="text-2xl font-semibold">{w.title}</h1>
        <p className="text-muted-foreground">{w.lead}</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/login" className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            {w.signIn}
          </Link>
          <Link href="/register" className="rounded-[var(--radius)] border border-border px-4 py-2 text-sm font-medium">
            {w.register}
          </Link>
        </div>
      </div>
    </main>
  )
}
