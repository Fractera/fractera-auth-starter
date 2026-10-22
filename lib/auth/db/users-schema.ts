import type Database from "better-sqlite3";

// ПОЛЬЗОВАТЕЛИ УЗЛА: СВОЙСТВА И ИСТОРИИ (узел, шаг 559-2).
//
// 🎯 Владелец 2026-10-21: «все таблицы должны существовать и первые пользователи уже должен быть в них записан»; выбор «С первого
// запуска». Схема идёт при первом обращении к базе у КАЖДОГО узла — нового и уже работающего (`runMigrations`), а засев ниже даёт
// каждому существующему человеку начальные записи. Новый человек записывается в момент вставки — триггером, каким бы путём он ни
// пришёл: регистрация, Google, письмо, гость.
//
// 🔒 ИСТОРИЮ ПИШУТ ТРИГГЕРЫ БАЗЫ, А НЕ КОД. Писателей у `users` много (регистрация, адаптер NextAuth, гость, повышение гостя, прежние
// двери админа), и это канон входа, который не правится попутно. Триггер видит их всех и ни одного не трогает. Текущее значение
// ролей и блокировки остаётся полем `users` (его читает канон), а история — строки, которые пишет тот же триггер в той же транзакции:
// разойтись им не с чего.
// 🔒 КТО ДЕЙСТВУЕТ — строка `audit_actor` (id = 1): дверь вкладки «Пользователи» ставит её в начале своей транзакции и снимает в
// конце; вне транзакции двери строки нет, и триггер пишет `system`. Транзакции better-sqlite3 синхронны в одном процессе — чужая
// запись в эту строку посреди транзакции невозможна. При старте строка снимается.
// 🔒 СОГЛАСИЯ — ТОЛЬКО ИСТОРИЕЙ: текущее = последняя строка по `id`; строки нет — «не указано», а не «нет».
// 🔒 В ЖУРНАЛЕ — ИМЕНА ПОЛЕЙ, А НЕ ЗНАЧЕНИЯ ЛИЧНЫХ ПОЛЕЙ (email, имя, кошелёк, пароль): журнал переживает обезличивание.
// 🛑 Триггеры на удаление пишут в журнал, только пока человек есть: вытеснение гостя удаляет запись каскадом, и строка журнала о
// удалённом нарушила бы внешний ключ — удаление упало бы.

const ACTOR = "COALESCE((SELECT actor FROM audit_actor WHERE id = 1), 'system')";
const SOURCE = "COALESCE((SELECT source FROM audit_actor WHERE id = 1), 'direct')";

/** Способ входа по имени провайдера: пароль, гость, Google, ссылка письмом. */
export const METHOD_SQL = (col: string) =>
  `CASE ${col} WHEN 'credentials' THEN 'password' WHEN 'guest' THEN 'guest' WHEN 'email' THEN 'email-link' WHEN 'resend' THEN 'email-link' ELSE ${col} END`;

export function migrateUsersJournal(db: Database.Database) {
  const userCols = (db.prepare("PRAGMA table_info(users)").all() as { name: string }[]).map((c) => c.name);
  for (const col of ["first_name", "last_name", "wallet", "deleted_at"]) {
    if (!userCols.includes(col)) db.exec(`ALTER TABLE users ADD COLUMN ${col} TEXT`);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_organizations (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, org_id)
    );
    CREATE INDEX IF NOT EXISTS user_organizations_org ON user_organizations(org_id);

    CREATE TABLE IF NOT EXISTS user_role_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      roles_before TEXT,
      roles_after TEXT NOT NULL,
      actor TEXT NOT NULL,
      source TEXT NOT NULL,
      at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS user_role_history_user ON user_role_history(user_id, id);

    CREATE TABLE IF NOT EXISTS user_consents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('marketing', 'tracking')),
      granted INTEGER NOT NULL CHECK (granted IN (0, 1)),
      actor TEXT NOT NULL,
      source TEXT NOT NULL,
      at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS user_consents_user ON user_consents(user_id, kind, id);

    CREATE TABLE IF NOT EXISTS user_auth_methods (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      method TEXT NOT NULL,
      first_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_at TEXT,
      PRIMARY KEY (user_id, method)
    );

    CREATE TABLE IF NOT EXISTS user_messenger_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      shared_at TEXT NOT NULL,
      paid_amount TEXT,
      currency TEXT,
      note TEXT
    );
    CREATE INDEX IF NOT EXISTS user_messenger_contacts_user ON user_messenger_contacts(user_id, id);

    CREATE TABLE IF NOT EXISTS user_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      details TEXT,
      actor TEXT NOT NULL,
      at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS user_log_user ON user_log(user_id, id);

    CREATE TABLE IF NOT EXISTS audit_actor (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      actor TEXT NOT NULL,
      source TEXT NOT NULL
    );
    DELETE FROM audit_actor;

    CREATE TRIGGER IF NOT EXISTS users_559_created AFTER INSERT ON users BEGIN
      INSERT INTO user_role_history (user_id, roles_before, roles_after, actor, source, at)
        VALUES (NEW.id, NULL, NEW.roles, ${ACTOR}, 'created', NEW.created_at);
      INSERT INTO user_log (user_id, action, details, actor, at)
        VALUES (NEW.id, 'created', json_object('provider', NEW.provider), ${ACTOR}, NEW.created_at);
      INSERT OR IGNORE INTO user_auth_methods (user_id, method, first_at)
        SELECT NEW.id, ${METHOD_SQL("NEW.provider")}, NEW.created_at WHERE NEW.provider IN ('credentials', 'guest');
    END;

    CREATE TRIGGER IF NOT EXISTS users_559_roles AFTER UPDATE OF roles ON users WHEN OLD.roles IS NOT NEW.roles BEGIN
      INSERT INTO user_role_history (user_id, roles_before, roles_after, actor, source)
        VALUES (NEW.id, OLD.roles, NEW.roles, ${ACTOR}, ${SOURCE});
      INSERT INTO user_log (user_id, action, details, actor)
        VALUES (NEW.id, 'roles_changed', json_object('before', OLD.roles, 'after', NEW.roles), ${ACTOR});
    END;

    CREATE TRIGGER IF NOT EXISTS users_559_active AFTER UPDATE OF is_active ON users WHEN OLD.is_active IS NOT NEW.is_active BEGIN
      INSERT INTO user_log (user_id, action, details, actor)
        VALUES (NEW.id, CASE NEW.is_active WHEN 1 THEN 'unblocked' ELSE 'blocked' END, NULL, ${ACTOR});
    END;

    CREATE TRIGGER IF NOT EXISTS users_559_anonymized AFTER UPDATE OF deleted_at ON users
      WHEN OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL BEGIN
      INSERT INTO user_log (user_id, action, details, actor) VALUES (NEW.id, 'anonymized', NULL, ${ACTOR});
    END;

    CREATE TRIGGER IF NOT EXISTS users_559_profile AFTER UPDATE ON users
      WHEN OLD.email IS NOT NEW.email OR OLD.nickname IS NOT NEW.nickname OR OLD.first_name IS NOT NEW.first_name
        OR OLD.last_name IS NOT NEW.last_name OR OLD.avatar_url IS NOT NEW.avatar_url OR OLD.wallet IS NOT NEW.wallet
        OR OLD.password IS NOT NEW.password BEGIN
      INSERT INTO user_log (user_id, action, details, actor)
        VALUES (NEW.id, 'profile_changed', (SELECT json_group_array(f) FROM (
          SELECT 'email' AS f WHERE OLD.email IS NOT NEW.email
          UNION ALL SELECT 'nickname' WHERE OLD.nickname IS NOT NEW.nickname
          UNION ALL SELECT 'first_name' WHERE OLD.first_name IS NOT NEW.first_name
          UNION ALL SELECT 'last_name' WHERE OLD.last_name IS NOT NEW.last_name
          UNION ALL SELECT 'avatar' WHERE OLD.avatar_url IS NOT NEW.avatar_url
          UNION ALL SELECT 'wallet' WHERE OLD.wallet IS NOT NEW.wallet
          UNION ALL SELECT 'password' WHERE OLD.password IS NOT NEW.password)), ${ACTOR});
    END;

    CREATE TRIGGER IF NOT EXISTS users_559_provider AFTER UPDATE OF provider ON users
      WHEN OLD.provider IS NOT NEW.provider AND NEW.provider IN ('credentials', 'guest') BEGIN
      INSERT OR IGNORE INTO user_auth_methods (user_id, method) VALUES (NEW.id, ${METHOD_SQL("NEW.provider")});
    END;

    CREATE TRIGGER IF NOT EXISTS accounts_559_method AFTER INSERT ON accounts BEGIN
      INSERT OR IGNORE INTO user_auth_methods (user_id, method) VALUES (NEW.user_id, ${METHOD_SQL("NEW.provider")});
      INSERT INTO user_log (user_id, action, details, actor)
        VALUES (NEW.user_id, 'method_linked', json_object('method', ${METHOD_SQL("NEW.provider")}), ${ACTOR});
    END;

    CREATE TRIGGER IF NOT EXISTS user_organizations_559_added AFTER INSERT ON user_organizations BEGIN
      INSERT INTO user_log (user_id, action, details, actor)
        VALUES (NEW.user_id, 'org_added', json_object('org', NEW.org_id), ${ACTOR});
    END;

    CREATE TRIGGER IF NOT EXISTS user_organizations_559_removed AFTER DELETE ON user_organizations BEGIN
      INSERT INTO user_log (user_id, action, details, actor)
        SELECT OLD.user_id, 'org_removed', json_object('org', OLD.org_id), ${ACTOR}
        WHERE EXISTS (SELECT 1 FROM users WHERE id = OLD.user_id);
    END;

    CREATE TRIGGER IF NOT EXISTS user_consents_559_log AFTER INSERT ON user_consents BEGIN
      INSERT INTO user_log (user_id, action, details, actor, at)
        VALUES (NEW.user_id, 'consent_changed', json_object('kind', NEW.kind, 'granted', NEW.granted), NEW.actor, NEW.at);
    END;

    CREATE TRIGGER IF NOT EXISTS user_messenger_contacts_559_log AFTER INSERT ON user_messenger_contacts BEGIN
      INSERT INTO user_log (user_id, action, details, actor, at)
        VALUES (NEW.user_id, 'messenger_contact', json_object('amount', NEW.paid_amount, 'currency', NEW.currency), ${ACTOR}, NEW.shared_at);
    END;
  `);

  // Засев (идемпотентный): у каждого, кого история ещё не знает, — начальные строки. Второй запуск ничего не добавляет.
  db.exec(`
    INSERT INTO user_role_history (user_id, roles_before, roles_after, actor, source, at)
      SELECT u.id, NULL, u.roles, 'system', 'initial', u.created_at FROM users u
      WHERE NOT EXISTS (SELECT 1 FROM user_role_history h WHERE h.user_id = u.id);
    INSERT INTO user_log (user_id, action, details, actor, at)
      SELECT u.id, 'created', json_object('provider', u.provider, 'initial', 1), 'system', u.created_at FROM users u
      WHERE NOT EXISTS (SELECT 1 FROM user_log l WHERE l.user_id = u.id);
    INSERT OR IGNORE INTO user_auth_methods (user_id, method, first_at, last_at)
      SELECT u.id, ${METHOD_SQL("u.provider")}, u.created_at, u.last_login_at FROM users u
      WHERE u.provider IN ('credentials', 'guest', 'email');
    INSERT OR IGNORE INTO user_auth_methods (user_id, method, first_at)
      SELECT a.user_id, ${METHOD_SQL("a.provider")}, u.created_at FROM accounts a JOIN users u ON u.id = a.user_id;
  `);

  // ПРИЛОЖЕНИЯ ЗАВОДА (узел, шаг 554-1). Организация с `element` — приложение: её рождает кастомный элемент на узле-заводе
  // (`POST /api/node-users/apps`). Имя такой строки — id элемента (имена организаций уникальны, а у всех новорождённых оно
  // по умолчанию «Fractera»); человеку ядро показывает `short_name` из настроек элемента в момент показа.
  const orgCols = (db.prepare("PRAGMA table_info(organizations)").all() as { name: string }[]).map((c) => c.name);
  if (!orgCols.includes("element")) db.exec("ALTER TABLE organizations ADD COLUMN element TEXT");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS organizations_element ON organizations(element) WHERE element IS NOT NULL");
}
