import type Database from "better-sqlite3";
import { getDb } from "@/lib/auth/db";

// ЖУРНАЛ ПОЛЬЗОВАТЕЛЕЙ — ТО, ЧЕГО ТРИГГЕРЫ НЕ ВИДЯТ (узел, шаг 559). Вход с куками JWT базу не трогает, поэтому способ и время входа
// пишет событие NextAuth `signIn` (`auth.config.ts`); на сам вход событие не влияет. Остальную историю пишут триггеры
// (`db/users-schema.ts`).

/** Способ входа по провайдеру NextAuth; у записи-гостя вход паролевым провайдером — это «гость». */
export function methodOf(provider: string | undefined, rowProvider: string | undefined): string | null {
  if (!provider || provider === "architect") return null;
  if (provider === "credentials") return rowProvider === "guest" ? "guest" : "password";
  if (provider === "resend" || provider === "email") return "email-link";
  return provider;
}

/** Вход состоялся: способ (первый и последний раз), время последнего входа, строка журнала; имя и фамилия из Google, если пусты. */
export function recordSignIn(userId: string | undefined, provider: string | undefined, profile?: Record<string, unknown> | null): void {
  if (!userId) return;
  const db = getDb();
  const row = db.prepare("SELECT provider FROM users WHERE id = ?").get(userId) as { provider: string } | undefined;
  if (!row) return; // токен архитектора — запись не в базе
  const method = methodOf(provider, row.provider);
  if (!method) return;
  db.transaction(() => {
    db.prepare(
      `INSERT INTO user_auth_methods (user_id, method, first_at, last_at) VALUES (?, ?, datetime('now'), datetime('now'))
       ON CONFLICT(user_id, method) DO UPDATE SET last_at = excluded.last_at`,
    ).run(userId, method);
    db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(userId);
    db.prepare("INSERT INTO user_log (user_id, action, details, actor) VALUES (?, 'signed_in', json_object('method', ?), ?)").run(userId, method, userId);
    if (method === "google" && profile) {
      const given = typeof profile.given_name === "string" ? profile.given_name.trim() : "";
      const family = typeof profile.family_name === "string" ? profile.family_name.trim() : "";
      if (given || family) {
        db.prepare("UPDATE users SET first_name = COALESCE(first_name, ?), last_name = COALESCE(last_name, ?) WHERE id = ?").run(given || null, family || null, userId);
      }
    }
  })();
}

/**
 * Выполнить запись от имени действующего: строка `audit_actor` стоит только внутри этой транзакции, и триггеры подписывают ею историю.
 * Транзакции better-sqlite3 синхронны — посреди этой никто другой в базу не пишет.
 */
export function withActor<T>(db: Database.Database, actor: string, source: string, fn: () => T): T {
  return db.transaction(() => {
    db.prepare("INSERT OR REPLACE INTO audit_actor (id, actor, source) VALUES (1, ?, ?)").run(actor, source);
    try {
      return fn();
    } finally {
      db.prepare("DELETE FROM audit_actor WHERE id = 1").run();
    }
  })();
}
