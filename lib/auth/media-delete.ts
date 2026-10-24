import { dataUrl } from "@/lib/microservices/urls"

// Файл аватарки в хранилище узла удаляется после записи (обезличивание, замена): слой данных пересылает `/media/*` хранилищу.
// Одно место для обеих дверей людей — вкладки ядра (`/api/node-users`, 559) и таблицы приложения (`/api/app-users`, 580).
// Ответ человеку не ждёт удаления: отказ — строка в журнале службы.
export function deleteMediaLater(ids: string[]): void {
  void deleteMedia(ids)
}

async function deleteMedia(ids: string[]): Promise<void> {
  const base = dataUrl()
  const key = process.env.DATA_SECRET || process.env.DATA_API_KEY || ""
  if (!ids.length || !base || !key) return
  for (const id of ids) {
    try {
      const r = await fetch(`${base}/media/${encodeURIComponent(id)}`, { method: "DELETE", headers: { "X-Data-Secret": key }, signal: AbortSignal.timeout(10_000) })
      if (!r.ok) console.warn(`[users] файл ${id} не удалён: ${r.status}`)
    } catch (e) {
      console.warn(`[users] файл ${id} не удалён: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
}
