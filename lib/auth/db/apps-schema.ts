import type Database from "better-sqlite3";

// ПРИЛОЖЕНИЯ ЗАВОДА: УЧЁТНАЯ ЗАПИСЬ ПРИНАДЛЕЖИТ ПРИЛОЖЕНИЮ (узел, шаг 554-2).
//
// 🎯 Владелец 2026-10-21: «одна таблица эта таблица пользователей должна быть для каждого приложения своя»; 2026-10-22 выбор «своя
// запись в каждом приложении». `users.app` — id элемента-приложения или `node` (ядро, встроенные элементы, единый проект, все, кто
// был до шага). Тот же email в двух приложениях — две записи; внутри одного — одна (`users_app_email`). Аккаунт Google — так же
// (`accounts_app_provider`): `accounts.app` повторяет приложение своего человека.
// 🔒 Встроенный `email UNIQUE` и `UNIQUE(provider, provider_account_id)` в SQLite не снимаются ALTER-ом — таблицы пересоздаются
// процедурой из документации SQLite («Making Other Kinds Of Table Schema Changes»): внешние ключи выключены на время, новая таблица
// из того же текста схемы без встроенной уникальности, перенос строк, удаление, переименование, проверка `foreign_key_check`.
// Триггеры 559 на этих таблицах уходят вместе с ними и возвращаются `migrateUsersJournal` (они `IF NOT EXISTS`) — поэтому эта
// миграция идёт ДО неё. Один раз: признак — колонка `app`. Не узнан текст схемы — таблица не трогается, вход работает как раньше
// (второе приложение получит отказ уникальности, а не потерю данных).

const cols = (db: Database.Database, table: string) =>
  (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);

function schemaOf(db: Database.Database, table: string): string | null {
  return (db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) as { sql: string } | undefined)?.sql ?? null;
}

/** Пересоздать таблицу по изменённому тексту схемы, сохранив все строки. Вызывается внутри транзакции, внешние ключи выключены. */
function rebuild(db: Database.Database, table: string, newSql: string) {
  const tmp = `${table}_554`;
  const names = cols(db, table).map((c) => `"${c}"`).join(", ");
  db.exec(newSql.replace(new RegExp(`^CREATE TABLE\\s+"?${table}"?`, "i"), `CREATE TABLE ${tmp}`));
  db.exec(`INSERT INTO ${tmp} (${names}) SELECT ${names} FROM ${table}`);
  db.exec(`DROP TABLE ${table}`);
  db.exec(`ALTER TABLE ${tmp} RENAME TO ${table}`);
}

export function migrateApps(db: Database.Database) {
  if (!cols(db, "users").includes("app")) {
    const usersSql = schemaOf(db, "users");
    const accountsSql = schemaOf(db, "accounts");
    const usersNew = usersSql?.replace(/\bemail\s+TEXT\s+UNIQUE\s+NOT\s+NULL\b/i, "email TEXT NOT NULL");
    const accountsNew = accountsSql?.replace(/,\s*UNIQUE\s*\(\s*provider\s*,\s*provider_account_id\s*\)/i, "");
    if (!usersSql || !accountsSql || usersNew === usersSql || accountsNew === accountsSql) {
      console.error("[auth 554] schema of users/accounts not recognised — application accounts are NOT enabled; sign-in works as before");
      return;
    }
    db.pragma("foreign_keys = OFF");
    db.pragma("legacy_alter_table = ON");
    try {
      db.transaction(() => {
        rebuild(db, "users", usersNew!);
        rebuild(db, "accounts", accountsNew!);
        db.exec("ALTER TABLE users ADD COLUMN app TEXT NOT NULL DEFAULT 'node'");
        db.exec("ALTER TABLE accounts ADD COLUMN app TEXT NOT NULL DEFAULT 'node'");
        db.exec("UPDATE accounts SET app = COALESCE((SELECT u.app FROM users u WHERE u.id = accounts.user_id), 'node')");
        const broken = db.prepare("PRAGMA foreign_key_check").all();
        if (broken.length) throw new Error(`foreign_key_check: ${broken.length} rows`);
      })();
    } catch (e) {
      // Транзакция откатилась целиком — база как до шага, вход работает по-прежнему.
      console.error(`[auth 554] application accounts NOT enabled, rolled back: ${e instanceof Error ? e.message : String(e)}`);
      return;
    } finally {
      db.pragma("legacy_alter_table = OFF");
      db.pragma("foreign_keys = ON");
    }
  }
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_app_email ON users(app, email);
    CREATE UNIQUE INDEX IF NOT EXISTS accounts_app_provider ON accounts(app, provider, provider_account_id);
    CREATE INDEX IF NOT EXISTS users_app ON users(app);
  `);
}
