// СТАНДАРТНЫЙ ХЕДЕР ПРОЕКТА — готовое решение узла Fractera (шаг 283-2). Мастер-копия:
// `kits/header/master/` узла; ставится командой `npm run header-kit:add -- <папка службы>`. Руками не
// править — правьте мастер и поставьте заново.
//
// Слово владельца 2026-09-24: «все сервисы используют одно и то же меню … оборачиваться самих себя в наши
// Хедер и в наши футер которые имеют нашу связь с этой панелью». Меню — настройка САЙТА: берётся у его
// двери `PROJECT_MENU_URL/<язык>` на сборке службы; ссылки ведут на `PROJECT_SITE_URL`. Оба адреса выдаёт
// установщик узла. Сайт не ответил — хедер рисует одно имя проекта, а не ломает страницу.

type Child = { slug: string; title: string; href?: string }
type Group = { slug: string; label: string; href?: string; inert?: boolean; children: Child[] }

// Имя проекта — поле `brand` той же двери (сайт v1.5.0+): своей копии имени у службы нет. Проп `brand` —
// запасной, на случай старого сайта или сайта, который не ответил.
async function loadMenu(lang: string): Promise<{ top: Group[]; brand: string }> {
  const none = { top: [], brand: "" }
  const base = process.env.PROJECT_MENU_URL
  if (!base) return none
  try {
    const res = await fetch(`${base.replace(/\/+$/, "")}/${lang}`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return none
    const data = (await res.json()) as { top?: Group[]; brand?: string }
    return { top: Array.isArray(data.top) ? data.top : [], brand: typeof data.brand === "string" ? data.brand : "" }
  } catch {
    return none
  }
}

const abs = (site: string, lang: string, path: string) => (/^https?:\/\//.test(path) ? path : `${site}/${lang}${path}`)

export async function ProjectHeader({ lang, brand: fallback = "" }: { lang: string; brand?: string }) {
  const site = (process.env.PROJECT_SITE_URL ?? "").replace(/\/+$/, "")
  const { top: groups, brand: fromSite } = await loadMenu(lang)
  const brand = fromSite || fallback
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-sm" data-project-header>
      <div className="flex h-14 w-full items-center gap-4 px-6 md:px-8">
        {brand && (
          <a href={site ? `${site}/${lang}` : "/"} className="shrink-0 font-semibold text-foreground">
            {brand}
          </a>
        )}
        <nav className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
          {groups.map((g) => {
            if (g.inert) {
              return (
                <span key={g.slug} aria-disabled="true" className="cursor-default rounded-md px-3 py-1.5 text-muted-foreground opacity-60">
                  {g.label}
                </span>
              )
            }
            const href = abs(site, lang, g.href ?? `/${g.slug}`)
            if (g.children.length === 0) {
              return (
                <a key={g.slug} href={href} className="rounded-md px-3 py-1.5 text-foreground hover:bg-muted">
                  {g.label}
                </a>
              )
            }
            // Второй уровень — без JavaScript: <details> раскрывается браузером.
            return (
              <details key={g.slug} className="relative">
                <summary className="cursor-pointer list-none rounded-md px-3 py-1.5 text-foreground hover:bg-muted">{g.label}</summary>
                <div className="absolute left-0 top-full z-50 mt-1 flex min-w-48 flex-col rounded-[var(--radius)] border border-border bg-background p-1 shadow-sm">
                  {g.children.map((c) => (
                    <a key={c.slug} href={abs(site, lang, c.href ?? `${g.href ?? `/${g.slug}`}/${c.slug}`)} className="rounded-md px-3 py-1.5 hover:bg-muted">
                      {c.title}
                    </a>
                  ))}
                </div>
              </details>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
