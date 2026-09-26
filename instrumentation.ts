// ЗАПУСК СЕРВЕРА — оформление проекта из элемента «Дизайн» и подписка на его сигнал (узел, шаги 308–309). Элемента нет
// (`DESIGN_SERVICE_URL` пуст) — служба живёт своим DESIGN-CONFIG. Таймеров нет: дальше — только по сигналу.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  if (!process.env.DESIGN_SERVICE_URL?.trim()) return
  const { pullDesign, subscribeToDesign } = await import("./lib/design-follow")
  const r = await pullDesign()
  if (r.ok) console.log(`[design] оформление: ${r.changed ? "получено" : "актуально"}`)
  else console.warn(`[design] оформление не получено: ${r.reason} — работаю по своему DESIGN-CONFIG`)
  const s = await subscribeToDesign("auth")
  if (s.ok) console.log(`[design] подписан на сигнал элемента «Дизайн»: ${s.url}`)
  else console.warn(`[design] подписка не удалась: ${s.reason}`)
}
