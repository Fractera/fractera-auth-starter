// СТАНДАРТНЫЙ ФУТЕР ПРОЕКТА — готовое решение узла Fractera (шаг 283-3). Мастер-копия:
// `kits/footer/master/` узла; ставится командой `npm run footer-kit:add -- <папка службы>`. Руками не
// править — правьте мастер и поставьте заново.
//
// Слово владельца 2026-09-24: «футер это значит весь футер который в том числе может получить страницы
// подвала если архитектор их активирует в панели … эти страницы публичные а значит они требуют регулирования
// в соответствии с законодательством не хуже и не лучше чем обычный сайт». Страницы подвала — настройка
// САЙТА: список берётся у его двери `PROJECT_MENU_URL/<язык>` (поле `footer`, пусто, пока они не включены),
// ссылки ведут на страницы сайта по `PROJECT_SITE_URL`. Правовой текст один — у сайта; служба его не копирует.

type Group = { slug: string; label: string; href?: string }

const WORDS: Record<string, { pages: string; rights: string }> = {
  en: { pages: "Footer pages", rights: "All rights reserved." },
  ru: { pages: "Страницы футера", rights: "Все права защищены." },
}

// Имя проекта — поле `brand` той же двери (сайт v1.5.0+): своей копии имени у службы нет. Проп `brand` —
// запасной, на случай старого сайта или сайта, который не ответил.
async function loadFooter(lang: string): Promise<{ footer: Group[]; brand: string }> {
  const none = { footer: [], brand: "" }
  const base = process.env.PROJECT_MENU_URL
  if (!base) return none
  try {
    const res = await fetch(`${base.replace(/\/+$/, "")}/${lang}`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return none
    const data = (await res.json()) as { footer?: Group[]; brand?: string }
    return { footer: Array.isArray(data.footer) ? data.footer : [], brand: typeof data.brand === "string" ? data.brand : "" }
  } catch {
    return none
  }
}

const abs = (site: string, lang: string, path: string) => (/^https?:\/\//.test(path) ? path : `${site}/${lang}${path}`)

export async function ProjectFooter({ lang, brand: fallback = "" }: { lang: string; brand?: string }) {
  const site = (process.env.PROJECT_SITE_URL ?? "").replace(/\/+$/, "")
  const { footer: groups, brand: fromSite } = await loadFooter(lang)
  const brand = fromSite || fallback
  const w = WORDS[lang] ?? WORDS.en
  return (
    <footer className="mt-auto w-full border-t border-border bg-background text-foreground" data-project-footer>
      <div className="flex flex-col gap-6 px-6 py-6">
        {groups.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">{w.pages}</p>
            <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
              {groups.map((g) => (
                <a key={g.slug} href={abs(site, lang, g.href ?? `/${g.slug}`)} className="hover:text-primary">
                  {g.label}
                </a>
              ))}
            </nav>
          </div>
        )}
        <p className="truncate text-sm">
          © {new Date().getFullYear()}{brand ? ` ${brand}` : ""}. {w.rights}
        </p>
      </div>
    </footer>
  )
}
