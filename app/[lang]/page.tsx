import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { TriangleAlert } from "lucide-react"

// СТРАНИЦА-ПРЕЗЕНТАЦИЯ СЛУЖБЫ ВХОДА (узел Fractera; 280-10, оформление главной сайта — шаг 286).
//
// Слово владельца 2026-09-24: «мне нравится как легко и непринуждённо оформлена страница корня только изображение не
// нужно имеющиеся в корне заголовок и описание просто растяни на всю ширину экрана». Отсюда: шапка первого экрана —
// как у главной сайта (заголовок 39/47/62 px, жирный, плотный; описание крупным текстом), без картинки и на всю ширину;
// ниже — предупреждение о риске. Текст — слова владельца.
// 🛑 Фраза об откате через «Дашборд развёртываний» НЕ опубликована: функции ещё нет (шаг 287), а публичный текст не
// утверждает несуществующее (закон «не надгробие» — спросить до публикации).
//
// 🔒 Только собственные языки страницы; прочие адреса вида `/<что-то>` не перехватываются — статические
// маршруты входа (`/login`, `/register`…) важнее динамического сегмента, а незнакомый язык — 404.
const WORDS = {
  en: {
    title: "Sign-in service",
    lead: "To build your application, open the Authorization tab in the core and activate your programmer agent: with it, right in the interface, you change how this application is built.",
    riskTitle: "Better at an early stage",
    risk: "Do this work early in the life of the application: it carries the highest risk. If sign-in breaks, nobody can use the protected routes — architects included. Sign-in can be restored through the development mode.",
    signIn: "Sign in",
    register: "Create an account",
  },
  ru: {
    title: "Служба входа",
    lead: "Чтобы построить ваше приложение, в ядре перейдите на вкладку авторизации и активируйте вашего агента-программиста: с ним прямо в интерфейсе вы меняете структуру этого приложения.",
    riskTitle: "Лучше на ранней стадии",
    risk: "Эти задачи рекомендуется делать на ранней стадии работы приложения: у этой работы самая высокая группа риска. Если вы повредите авторизацию, пользователи вообще не смогут пользоваться защищёнными маршрутами — в том числе архитекторы. Восстановить авторизацию можно через режим разработки.",
    signIn: "Войти",
    register: "Создать аккаунт",
  },
} as const

type Lang = keyof typeof WORDS

export function generateStaticParams() {
  return Object.keys(WORDS).map((lang) => ({ lang }))
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const w = WORDS[(lang in WORDS ? lang : "en") as Lang]
  return { title: w.title, description: w.lead }
}

export default async function AuthPresentation({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!(lang in WORDS)) notFound()
  const w = WORDS[lang as Lang]
  return (
    <main className="flex flex-1 flex-col gap-10 bg-background px-6 py-12 text-foreground md:px-8 md:py-16">
      {/* Первый экран — как у главной сайта, без картинки: заголовок и описание на всю ширину. */}
      <header className="flex flex-col gap-6">
        <h1 className="text-[39px] font-bold leading-[1.1] tracking-tight md:text-[47px] lg:text-[62px]">{w.title}</h1>
        <p className="text-lg leading-relaxed text-muted-foreground md:text-xl">{w.lead}</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/login" className="rounded-[var(--radius)] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
            {w.signIn}
          </Link>
          <Link href="/register" className="rounded-[var(--radius)] border border-border px-5 py-2.5 text-sm font-medium">
            {w.register}
          </Link>
        </div>
      </header>

      {/* Предупреждение — карточка в тоне «warning» слоя архитектора. */}
      <section className="flex gap-4 rounded-xl border border-destructive/40 bg-destructive/10 p-6">
        <TriangleAlert aria-hidden className="mt-1 size-6 shrink-0 text-destructive" />
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-destructive">{w.riskTitle}</h2>
          <p className="leading-relaxed text-destructive">{w.risk}</p>
        </div>
      </section>
    </main>
  )
}
