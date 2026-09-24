import { ThemeProvider } from "@/components/shell/theme-provider.client"
import { ProjectHeader } from "@/components/shell/project-header"
import { ProjectFooter } from "@/components/shell/project-footer"
import { loadProjectShell } from "@/components/shell/remote-shell"
import type { ShellSurface } from "@/components/shell/shell-types"
import { cacheLife } from "next/cache"

// ОБОЛОЧКА ПРОЕКТА НА СТРАНИЦАХ С ЯЗЫКОМ В АДРЕСЕ (узел Fractera, шаг 285-3).
//
// Слово владельца 2026-09-24: хедер и футер у всех служб — один и тот же компонент: вход, меню, страницы подвала,
// соцсети, язык, ширина, тема. `components/shell/` — копия сайта байт в байт (`npm run shell-kit:add` узла,
// руками не править); данные — дверь сайта `PROJECT_SHELL_URL/<язык>` на сборке.
//
// 🔒 Двери входа — свои у этой службы: кто вошёл — `/api/session`, вход — `/login`, выход — `/logout` с
// возвратом на эту страницу. Языки — только те, что у страниц этой службы есть (en, ru).
// 🛑 Только здесь, а не в корневом макете: `/login`, `/register` и соседние выбирают язык в браузере, и шапка со
// сборки вышла бы на чужом языке — оборачивать ли их, решает владелец.
const SURFACE: ShellSurface = {
  meUrl: "/api/session",
  loginHref: () => "/login",
  logoutHref: (lang) => `/logout?redirectUrl=/${lang}`,
  languages: ["en", "ru"],
}

// 295: ОБОЛОЧКА РИСУЕТСЯ ВНУТРИ КЭША (Cache Components) и держится минуты: правка меню на сайте доходит сюда без
// пересборки этой службы. Рисуется, а не только читается, в кэше намеренно: подвал печатает год (`new Date()`), а
// текущее время вне кэша Next 16 запрещает на статической странице — копию оболочки (`shell-kit`) не трогаем.
async function ShellHeader({ lang }: { lang: string }) {
  "use cache"
  cacheLife("minutes")
  const shell = await loadProjectShell(lang)
  return shell ? <ProjectHeader data={shell} surface={SURFACE} /> : null
}

async function ShellFooter({ lang }: { lang: string }) {
  "use cache"
  cacheLife("minutes")
  const shell = await loadProjectShell(lang)
  return shell ? <ProjectFooter data={shell} surface={SURFACE} /> : null
}

export default async function LangLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params
  // Незнакомый язык — страница ответит 404; оболочку у сайта за ним не спрашиваем.
  const known = SURFACE.languages?.includes(lang) ?? true
  return (
    <ThemeProvider>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        {known && <ShellHeader lang={lang} />}
        {children}
        {known && <ShellFooter lang={lang} />}
      </div>
    </ThemeProvider>
  )
}
