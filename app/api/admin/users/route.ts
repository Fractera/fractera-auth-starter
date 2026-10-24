// @api list user accounts of one application for its admin
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/auth/db";
import { appOfElement, callerOf, ELEMENT_HEADER, mayAdminister } from "@/lib/auth/caller";

// 🔒 СПИСОК ВИДЯТ АДМИНИСТРАТОР И АРХИТЕКТОР (решение владельца 2026-08-21) — и С ШАГА 580 ТОЛЬКО ЛЮДИ ОДНОГО ПРИЛОЖЕНИЯ.
//
// Владелец 2026-10-24: «администратор … может быть связан только с той организации через которую пользователь зарегистрировался …
// архитектор всегда по умолчанию имеет доступ в любое уровень». Приложение — то, чей сервер спрашивает (`x-fractera-element`, нет
// заголовка — `node`); архитектор узла видит любое, администратор — только приложение своей записи (`lib/auth/caller.ts`).
// ✗ До 580 дверь отдавала любому `admin` всех людей узла и узнавала человека только по куке — на собственном домене элемента
// (lagrix.dev) архитектор получал 401: там вместо куки билет единого входа.
//
// Полная таблица людей приложения (поиск, отбор, история, пакет) — `/api/app-users`; эта дверь осталась для элементов до шаблона 580.

export const GET = auth(function GET(req) {
  const caller = callerOf(req);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const app = appOfElement(req.headers.get(ELEMENT_HEADER));
  if (!mayAdminister(caller, app)) {
    return NextResponse.json({ error: "Forbidden", requires: ["admin", "architect"] }, { status: 403 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  // 🔒 РАЗМЕР СТРАНИЦЫ ЗАДАЁТ ВЫЗЫВАЮЩИЙ (2026-08-21), но из закрытого набора: чужой запрос не просит всю таблицу разом, а опечатка
  // становится ближайшим законным значением, а не отказом.
  const ALLOWED_PER_PAGE = [10, 20, 50, 100];
  const asked = parseInt(url.searchParams.get("perPage") ?? "", 10);
  const perPage = ALLOWED_PER_PAGE.includes(asked) ? asked : 100;
  const offset = (page - 1) * perPage;

  const db = getDb();
  const cols = "id, email, nickname, roles, is_active, provider, created_at, last_login_at";

  if (q) {
    const like = `%${q}%`;
    const total = (db.prepare(
      "SELECT COUNT(*) as cnt FROM users WHERE app = ? AND (email LIKE ? OR nickname LIKE ?)"
    ).get(app, like, like) as { cnt: number }).cnt;
    const users = db.prepare(
      `SELECT ${cols} FROM users WHERE app = ? AND (email LIKE ? OR nickname LIKE ?) ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(app, like, like, perPage, offset);
    return NextResponse.json({ users, total, page, perPage, app });
  }

  const total = (db.prepare("SELECT COUNT(*) as cnt FROM users WHERE app = ?").get(app) as { cnt: number }).cnt;
  const users = db.prepare(
    `SELECT ${cols} FROM users WHERE app = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(app, perPage, offset);

  return NextResponse.json({ users, total, page, perPage, app });
});
