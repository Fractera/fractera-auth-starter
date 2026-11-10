// ЗАПУСК СЕРВЕРА — ЭЛЕМЕНТ ЗАБИРАЕТ НАСТРОЙКИ ПРОЕКТА У CONFIG (шаг 299-6) И ПОДПИСЫВАЕТСЯ НА ЕГО СИГНАЛ (шаг 306).
//
// При запуске элемент спрашивает версию и, если она сменилась, забирает настройки (копия пишется до первых запросов). После
// сохранения архитектором CONFIG пришлёт «версия сменилась» на `/api/settings/changed`, и элемент заберёт новое сам. CONFIG нет у
// узла (переменная пуста) — элемент живёт своими файлами. Оформление — собственный DESIGN-CONFIG элемента, его пишет сам элемент.
// 🔒 Сигнал — решение владельца 2026-09-26. Действие только в ответ на сохранение человеком. 🪦 Опрос раз в минуту отменён
// владельцем 2026-09-25 и остаётся отменённым: опроса CONFIG здесь нет.
// 551-1 (владелец 2026-10-20: у нативного элемента нет рабочего процесса) сняло здесь расписание; 558 (2026-10-21) вернуло его четырём
// элементам памяти — для резервного копирования; 636 (владелец 2026-11-03, «Да, оба (Рекомендую)»: часы и календарь всем нативным
// элементам) — каждому. Единственный таймер элемента — его `OWN-SERVICE-PROPS/CRON.json` и `data/cron.json`, проверка раз в минуту
// (`lib/cron/runner.ts`); новых процессов нет; пропуск при выключенном компьютере не догоняется. Рабочего процесса по-прежнему нет:
// будильник будит сессию строительства (`lib/cron/wake.ts`).
// 314-2: имя подписчика — из паспорта элемента (`lib/own-id.ts`), а не "root": у источника одна запись на имя.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { ownId } = await import("./lib/own-id")
  const who = ownId()
  if (!who) console.warn("[settings] у элемента нет имени (паспорт OWN-SERVICE-PROPS/ → id или ITEM_ID) — на сигналы не подписываюсь")
  if (process.env.CONFIG_SERVICE_URL?.trim()) {
    const { pullProjectSettings } = await import("./lib/project-settings")
    const r = await pullProjectSettings()
    if (r.ok) console.log(`[settings] настройки проекта: ${r.changed ? "получена новая копия" : "копия актуальна"} (${r.version})`)
    else console.warn(`[settings] элемент настроек не ответил: ${r.reason} — работаю по прежней копии`)
    const { subscribeToConfig } = await import("./lib/settings-listener")
    const s = who ? await subscribeToConfig(who) : { ok: false as const, reason: "no-id" }
    if (s.ok) console.log(`[settings] подписан на сигнал CONFIG: ${s.url}`)
    else console.warn(`[settings] подписка на сигнал CONFIG не удалась: ${s.reason}${"detail" in s && s.detail ? ` (${s.detail})` : ""} — правки дойдут при следующем запуске`)
  }
  const { startCron } = await import("./lib/cron/runner")
  startCron()
}
