import Link from "next/link"

// Первый экран по центру (узел, шаги 303–304; образец владельца 2026-09-26): зарево фирменного цвета → бейдж →
// заголовок не длиннее двух строк → описание → кнопки → полоса из трёх шагов. Вид тот же, что у блока реестра
// «Блоков» `components/blocks/hero-centered`; здесь он собран без примитивов типографики, которых у этого элемента нет.
// 🔒 ВСЁ ИЗ ДИЗАЙН-СИСТЕМЫ ПРОЕКТА: цвета — токены темы, шрифт заголовка — `--font-heading`, размеры —
// `--fs-hero-one*`, зарево `.hero-ignite*`, появление `.hero-appear`, каёмка `.pill-ai` — классы app/globals.css.
type Step = { title: string; text: string }
type Action = { href: string; label: string }
export type HeroCenteredProps = {
  pill?: string
  title: string
  description: string
  cta?: Action & { secondary?: Action }
  steps?: readonly Step[]
}

const TITLE =
  "mx-auto max-w-4xl line-clamp-2 text-balance font-[family-name:var(--font-heading)] font-bold tracking-tight text-foreground text-[length:var(--fs-hero-one,1.95rem)] md:text-[length:var(--fs-hero-one-md,2.4375rem)] lg:text-[length:var(--fs-hero-one-lg,2.925rem)] leading-tight"

export function HeroCentered({ pill, title, description, cta, steps }: HeroCenteredProps) {
  return (
    <section aria-labelledby="hero-t" className="relative isolate mx-auto mb-6 flex w-full max-w-5xl flex-col px-6 pt-10 pb-4 text-center">
      {/* Зарево начинается от верха страницы, а не от края секции: обрезанное, оно давало прямую кромку под шапкой. */}
      <div aria-hidden className="hero-ignite pointer-events-none absolute inset-x-0 -top-28 bottom-0 -z-10" />
      <div aria-hidden className="hero-ignite-inner pointer-events-none absolute inset-x-[15%] -top-28 bottom-0 -z-10" />
      {pill && (
        <div className="hero-appear mb-6 flex justify-center [animation-delay:0.3s]">
          <span className="pill-ai inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm text-foreground/85">
            <span aria-hidden className="text-base leading-none text-primary">✦</span>
            {pill}
          </span>
        </div>
      )}
      <h1 id="hero-t" className={`hero-appear [animation-delay:0.5s] ${TITLE}`}>{title}</h1>
      <p className="hero-appear mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground [animation-delay:0.65s]">{description}</p>
      {cta && (
        <div className="hero-appear mt-8 flex flex-wrap items-center justify-center gap-3 [animation-delay:0.75s]">
          <Link href={cta.href} className="inline-flex w-fit items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90">
            {cta.label}
            <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
          {cta.secondary && (
            <Link href={cta.secondary.href} className="inline-flex w-fit items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-bold text-foreground hover:bg-muted">
              {cta.secondary.label}
            </Link>
          )}
        </div>
      )}
      {steps && (
        // Телефон — столбик строк с разделителями; с планшета — ряд из трёх колонок с разделителями между ними.
        <ol className="hero-appear mx-auto mt-12 grid w-full max-w-3xl list-none divide-y divide-border/60 overflow-hidden rounded-3xl border border-border/60 bg-card/40 p-0 text-left backdrop-blur-md [animation-delay:0.8s] md:grid-cols-3 md:divide-x md:divide-y-0 md:text-center">
          {steps.map((s, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3.5 md:flex-col md:gap-2 md:px-6 md:py-5">
              <span className="font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
              <span className="flex flex-col gap-1">
                <span className="text-sm font-semibold uppercase tracking-wide text-foreground">{s.title}</span>
                <span className="text-sm leading-normal text-muted-foreground">{s.text}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
