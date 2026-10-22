import { getDb } from "@/lib/auth/db"
import { elementOfHost, finalReturn } from "@/lib/auth/app-hosts"

// В КАКОМ ПРИЛОЖЕНИИ ВХОД (узел, шаг 554-3). Владелец 2026-10-22: «пользователь который зашёл через кастомный элемент при переходе
// на авторизацию в параметрах строки передаст в том числе и название сайта на которые нужно вернуться». Приложение — id элемента,
// чей сайт стоит в итоговом адресе возврата, если у элемента есть организация-приложение (рождён на заводе, 554-1); иначе `node` —
// ядро, встроенные элементы, единый проект и всё, что было до шага. Формы входа не меняются: адрес возврата берётся из того, что они
// и так присылают (тело `signIn`, `referer` страницы, `callbackUrl` и кука потока Google).

export const NODE_APP = "node"

const BASE = () => process.env.NEXTAUTH_URL || "http://localhost"

/** Приложение по адресу возврата (любой вложенности). */
export function appOfReturn(raw: string | null | undefined): string {
  if (!raw) return NODE_APP
  const u = finalReturn(raw, BASE())
  const element = u ? elementOfHost(u.host) : null
  if (!element) return NODE_APP
  const org = getDb().prepare("SELECT 1 FROM organizations WHERE element = ?").get(element)
  return org ? element : NODE_APP
}

const CALLBACK_COOKIES = ["__Secure-authjs.callback-url", "authjs.callback-url"]

/** Приложение запроса к NextAuth: `callbackUrl` запроса (письмо, начало потока) или кука потока (возврат от Google). */
export function appOfRequest(req: Request | undefined): string {
  if (!req) return NODE_APP
  let fromQuery: string | null = null
  try { fromQuery = new URL(req.url).searchParams.get("callbackUrl") } catch { /* не адрес */ }
  if (fromQuery) return appOfReturn(fromQuery)
  const cookie = req.headers.get("cookie") ?? ""
  for (const name of CALLBACK_COOKIES) {
    const m = cookie.match(new RegExp(`(?:^|;\\s*)${name.replace(/[.]/g, "\\.")}=([^;]+)`))
    if (m) return appOfReturn(decodeURIComponent(m[1]))
  }
  return NODE_APP
}
