import { ProjectHeader } from "@/components/fractera/project-header"
import { ProjectFooter } from "@/components/fractera/project-footer"

// ХЕДЕР И ФУТЕР ПРОЕКТА НА СТРАНИЦАХ С ЯЗЫКОМ В АДРЕСЕ (узел Fractera, шаг 283-4).
//
// Слово владельца 2026-09-24: все службы пользуются одним меню проекта и по желанию оборачивают себя в наш
// хедер и футер. Оба — готовые решения узла (`components/fractera/`, ставятся `header-kit:add` и
// `footer-kit:add`; руками не править): меню, страницы подвала и имя проекта берутся у двери сайта на сборке.
//
// 🛑 ТОЛЬКО ЗДЕСЬ, А НЕ В КОРНЕВОМ МАКЕТЕ. `/login`, `/register` и соседние выбирают язык в браузере — у них нет
// языка в адресе, и хедер, собранный на сборке, вышел бы на чужом языке. Оборачивать ли их — решение владельца.
export default async function LangLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <ProjectHeader lang={lang} />
      {children}
      <ProjectFooter lang={lang} />
    </div>
  )
}
