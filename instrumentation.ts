// ЗАПУСК СЕРВЕРА — настройки блоков из CONFIG и подписка на его сигнал (узел, шаг 308). Элемента CONFIG нет
// (`CONFIG_SERVICE_URL` пуст) — служба живёт своим DESIGN-CONFIG. Таймеров нет: дальше — только по сигналу.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  if (!process.env.CONFIG_SERVICE_URL?.trim()) return
  const { pullBlockSettings, subscribeToConfig } = await import("./lib/block-settings")
  const r = await pullBlockSettings()
  if (r.ok) console.log(`[settings] настройки блоков: ${r.changed ? "получены" : "актуальны"}`)
  else console.warn(`[settings] настройки блоков не получены: ${r.reason} — работаю по своему DESIGN-CONFIG`)
  const s = await subscribeToConfig("auth")
  if (s.ok) console.log(`[settings] подписан на сигнал CONFIG: ${s.url}`)
  else console.warn(`[settings] подписка на сигнал CONFIG не удалась: ${s.reason}`)
}
