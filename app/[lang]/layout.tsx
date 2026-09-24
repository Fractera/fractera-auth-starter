import { ThemeProvider } from "@/components/shell/theme-provider.client"
import { ProjectHeader } from "@/components/shell/project-header"
import { ProjectFooter } from "@/components/shell/project-footer"
import { loadProjectShell } from "@/components/shell/remote-shell"
import type { ShellSurface } from "@/components/shell/shell-types"

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

export default async function LangLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const shell = await loadProjectShell(lang)
  return (
    <ThemeProvider>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        {shell && <ProjectHeader data={shell} surface={SURFACE} />}
        {children}
        {shell && <ProjectFooter data={shell} surface={SURFACE} />}
      </div>
    </ThemeProvider>
  )
}
