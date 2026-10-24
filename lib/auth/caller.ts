import type { NextRequest } from "next/server"
import { getDb } from "@/lib/auth/db"
import { appOfUser, NODE_APP } from "@/lib/auth/apps"
import { fromLoopback, whoByTicket } from "@/lib/sso"
import { liveUser } from "@/lib/guest-guard"

// КТО СПРАШИВАЕТ И ЧТО ЕМУ МОЖНО В ПРИЛОЖЕНИИ (узел, шаг 580).
//
// 🎯 Владелец 2026-10-24: «архитектор это супер пользователь который имеет покрытие вообще над всем узлом в то время как администратор
// это уже роль также как и любая другая которая может быть связана только с той организации через которую пользователь
// зарегистрировался». Приложение записи — `users.app` (554): `node` или id элемента завода.
//
// 🔒 ДВА СПОСОБА УЗНАТЬ ЧЕЛОВЕКА. Кука сессии этой службы — на домене узла; на собственном домене элемента её нет, там живёт билет
// единого входа (328-3). ✗ 580-1: дверь элемента пересылала сюда только куку, и на lagrix.dev архитектор получал 401 — «Не удалось
// загрузить записи». Билет принимается заголовком `x-fractera-ticket` и только с петли машины: снаружи заголовок не значит ничего.
// Роли — из базы (`liveUser`): заблокированный и обезличенный — не вошедший, как у `/api/session`.

export const TICKET_HEADER = "x-fractera-ticket"
export const ELEMENT_HEADER = "x-fractera-element"

export type Caller = { id: string; roles: string[]; app: string }

type WithAuth = NextRequest & { auth?: { user?: { id?: string | null } | null } | null }

export function callerOf(req: WithAuth): Caller | null {
  let id = req.auth?.user?.id ?? null
  if (!id && fromLoopback(req)) {
    const ticket = req.headers.get(TICKET_HEADER)?.trim()
    if (ticket) id = whoByTicket(ticket)?.userId ?? null
  }
  if (!id) return null
  const live = liveUser(id)
  if (!live) return null
  return { id, roles: live.roles, app: appOfUser(id) }
}

/** Приложение элемента: у элемента есть организация-приложение (рождён на заводе) — его id, иначе `node`. */
export function appOfElement(raw: string | null | undefined): string {
  const element = (raw ?? "").trim()
  if (!element || element === NODE_APP) return NODE_APP
  const org = getDb().prepare("SELECT 1 FROM organizations WHERE element = ?").get(element)
  return org ? element : NODE_APP
}

/** Архитектор узла — запись `node` с ролью `architect`: над всеми приложениями. */
export const isNodeArchitect = (c: Caller) => c.app === NODE_APP && c.roles.includes("architect")

/** Может ли человек администрировать людей приложения `app`: архитектор узла — любое; администратор (и архитектор записи
 *  приложения) — только приложение своей записи. Любая другая роль — нет. */
export function mayAdminister(c: Caller, app: string): boolean {
  if (isNodeArchitect(c)) return true
  return c.app === app && (c.roles.includes("admin") || c.roles.includes("architect"))
}

/** Роли, с которыми человек действует в пакете: роль `architect` весит только у архитектора узла. Архитектор записи приложения
 *  действует как администратор — не трогает записи архитекторов и роль архитектора. */
export const actingRoles = (c: Caller): string[] => (isNodeArchitect(c) ? c.roles : c.roles.filter((r) => r !== "architect"))
