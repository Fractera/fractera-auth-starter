import type Database from "better-sqlite3";
import { nanoid } from "nanoid";
import { ALL_ROLES } from "@/lib/auth/roles";
import { withActor } from "@/lib/auth/users-journal";

// ПОЛЬЗОВАТЕЛИ УЗЛА ДЛЯ ВКЛАДКИ ЯДРА (узел, шаг 559-3). Дверь — `app/api/node-users/[[...path]]/route.ts`; здесь работа.
//
// 🎯 Владелец 2026-10-21: «стандартную таблицу с pagina нацией и серверными запросами а также с поиском контрагента по имени …
// фильтрацию по компаниям, и по ролям … сортировки по дате вверх и вниз … Любое действие пакетное для экономии ресурсов после
// дополнительного подтверждения. Удаление пользователя возможно только таким образом чтобы удалялись имя, фамилии, аватарка, способ
// авторизации, но сохранялся бы идентификатор псевдоним и логи»; выбор «Email и кошелёк» — стираются тоже.
// 🔒 Правила прежней двери `/api/admin/users/[id]` перенесены и стали строже: свою запись не правит никто; запись АРХИТЕКТОРА (и его
// роль) меняет только архитектор — администратор не может её ни заблокировать, ни обезличить; обезличивает только архитектор.
// 🔒 Пакет — одна транзакция: всё, что можно, сделано; что нельзя — названо с причиной (`skipped`), отказ одного не отменяет других.
// 🔒 «Разрешить рассылки» — только одному человеку за раз: согласие даёт сам человек, пакетом его не выдают (решение 559, владелец вправе снять).
// История и журнал пишутся триггерами базы (`db/users-schema.ts`); кто действует — `withActor`.

export type Actor = { id: string; roles: string[] };
export type UserStatus = "active" | "blocked" | "anonymized";

const PER_PAGE = [10, 25, 50, 100] as const;
const LIKE_ESCAPE = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const parseRoles = (raw: string): string[] => {
  try {
    const r = JSON.parse(raw);
    return Array.isArray(r) ? r.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

// Поиск без учёта регистра и для кириллицы: `LIKE` SQLite складывает регистр только у латиницы.
const withFns = new WeakSet<Database.Database>();
function fns(db: Database.Database): Database.Database {
  if (!withFns.has(db)) {
    db.function("ulower", { deterministic: true }, (s: unknown) => (typeof s === "string" ? s.toLowerCase() : s));
    withFns.add(db);
  }
  return db;
}

const pageOf = (page: unknown, perPage: unknown) => {
  const per = PER_PAGE.includes(Number(perPage) as (typeof PER_PAGE)[number]) ? Number(perPage) : PER_PAGE[0];
  const p = Math.max(1, Math.floor(Number(page)) || 1);
  return { page: p, perPage: per, offset: (p - 1) * per };
};

const inList = (n: number) => Array(n).fill("?").join(",");

type UserRow = {
  id: string; email: string; nickname: string | null; first_name: string | null; last_name: string | null; avatar_url: string | null;
  roles: string; provider: string; is_active: number; deleted_at: string | null; wallet: string | null; created_at: string; last_login_at: string | null;
};
const USER_COLS = "u.id, u.email, u.nickname, u.first_name, u.last_name, u.avatar_url, u.roles, u.provider, u.is_active, u.deleted_at, u.wallet, u.created_at, u.last_login_at";

const statusOf = (r: { is_active: number; deleted_at: string | null }): UserStatus =>
  r.deleted_at ? "anonymized" : r.is_active === 1 ? "active" : "blocked";

/** Страница пользователей: поиск, фильтры организации и роли, сортировка по дате регистрации. */
export function listUsers(dbIn: Database.Database, q: { q?: string | null; org?: string | null; role?: string | null; sort?: string | null; page?: unknown; perPage?: unknown; app?: string | null }) {
  const db = fns(dbIn);
  const where: string[] = [];
  const args: unknown[] = [];
  // 580: люди одного приложения (`users.app`) — для таблицы на сайте элемента; вкладка ядра зовёт без `app` и видит всех.
  if (q.app) {
    where.push("u.app = ?");
    args.push(q.app);
  }
  const text = (q.q ?? "").trim().slice(0, 100);
  if (text) {
    const like = `%${LIKE_ESCAPE(text.toLowerCase())}%`;
    where.push(`(ulower(u.nickname) LIKE ? ESCAPE '\\' OR ulower(u.first_name) LIKE ? ESCAPE '\\' OR ulower(u.last_name) LIKE ? ESCAPE '\\'
      OR ulower(u.email) LIKE ? ESCAPE '\\' OR ulower(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) LIKE ? ESCAPE '\\')`);
    args.push(like, like, like, like, like);
  }
  if (q.org) {
    where.push("EXISTS (SELECT 1 FROM user_organizations uo WHERE uo.user_id = u.id AND uo.org_id = ?)");
    args.push(q.org);
  }
  if (q.role) {
    where.push("json_valid(u.roles) AND EXISTS (SELECT 1 FROM json_each(u.roles) j WHERE j.value = ?)");
    args.push(q.role);
  }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const dir = q.sort === "created_asc" ? "ASC" : "DESC";
  const { page, perPage, offset } = pageOf(q.page, q.perPage);
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM users u ${w}`).get(...args) as { n: number }).n;
  const rows = db.prepare(`SELECT ${USER_COLS} FROM users u ${w} ORDER BY u.created_at ${dir}, u.rowid ${dir} LIMIT ? OFFSET ?`).all(...args, perPage, offset) as UserRow[];

  const ids = rows.map((r) => r.id);
  const orgs = new Map<string, { id: string; name: string; element: string | null }[]>();
  const methods = new Map<string, string[]>();
  const consents = new Map<string, Record<string, { granted: boolean; at: string }>>();
  const messenger = new Map<string, number>();
  if (ids.length) {
    for (const o of db.prepare(`SELECT uo.user_id, o.id, o.name, o.element FROM user_organizations uo JOIN organizations o ON o.id = uo.org_id WHERE uo.user_id IN (${inList(ids.length)}) ORDER BY o.name COLLATE NOCASE`).all(...ids) as { user_id: string; id: string; name: string; element: string | null }[]) {
      orgs.set(o.user_id, [...(orgs.get(o.user_id) ?? []), { id: o.id, name: o.name, element: o.element }]);
    }
    for (const m of db.prepare(`SELECT user_id, method FROM user_auth_methods WHERE user_id IN (${inList(ids.length)}) ORDER BY first_at`).all(...ids) as { user_id: string; method: string }[]) {
      methods.set(m.user_id, [...(methods.get(m.user_id) ?? []), m.method]);
    }
    for (const c of db.prepare(`SELECT c.user_id, c.kind, c.granted, c.at FROM user_consents c WHERE c.user_id IN (${inList(ids.length)})
        AND c.id = (SELECT MAX(c2.id) FROM user_consents c2 WHERE c2.user_id = c.user_id AND c2.kind = c.kind)`).all(...ids) as { user_id: string; kind: string; granted: number; at: string }[]) {
      consents.set(c.user_id, { ...(consents.get(c.user_id) ?? {}), [c.kind]: { granted: c.granted === 1, at: c.at } });
    }
    for (const m of db.prepare(`SELECT user_id, COUNT(*) AS n FROM user_messenger_contacts WHERE user_id IN (${inList(ids.length)}) GROUP BY user_id`).all(...ids) as { user_id: string; n: number }[]) {
      messenger.set(m.user_id, m.n);
    }
  }
  return {
    total, page, perPage,
    rows: rows.map((r) => ({
      id: r.id, email: r.email, nickname: r.nickname, firstName: r.first_name, lastName: r.last_name, avatar: r.avatar_url,
      roles: parseRoles(r.roles), orgs: orgs.get(r.id) ?? [], methods: methods.get(r.id) ?? [], status: statusOf(r),
      createdAt: r.created_at, lastLoginAt: r.last_login_at, wallet: r.wallet, guest: r.provider === "guest",
      marketing: consents.get(r.id)?.marketing ?? null, tracking: consents.get(r.id)?.tracking ?? null, messengerCount: messenger.get(r.id) ?? 0,
    })),
  };
}

export const HISTORY_KINDS = ["roles", "methods", "marketing", "tracking", "log", "messenger"] as const;
export type HistoryKind = (typeof HISTORY_KINDS)[number];

/** История одного свойства человека — новые сверху; «кто» — псевдоним действующего (он переживает обезличивание). */
export function historyOf(db: Database.Database, id: string, kind: HistoryKind, page: unknown, perPage: unknown) {
  const { page: p, perPage: per, offset } = pageOf(page, perPage);
  const actorName = "COALESCE((SELECT a.nickname FROM users a WHERE a.id = h.actor), h.actor) AS actor";
  const q: Record<HistoryKind, { count: string; rows: string; args: unknown[] }> = {
    roles: { count: "SELECT COUNT(*) AS n FROM user_role_history WHERE user_id = ?", rows: `SELECT h.id, h.roles_before AS before, h.roles_after AS after, h.source, h.at, ${actorName} FROM user_role_history h WHERE h.user_id = ? ORDER BY h.id DESC LIMIT ? OFFSET ?`, args: [id] },
    methods: { count: "SELECT COUNT(*) AS n FROM user_auth_methods WHERE user_id = ?", rows: "SELECT method, first_at AS firstAt, last_at AS lastAt FROM user_auth_methods WHERE user_id = ? ORDER BY first_at LIMIT ? OFFSET ?", args: [id] },
    marketing: { count: "SELECT COUNT(*) AS n FROM user_consents WHERE user_id = ? AND kind = 'marketing'", rows: `SELECT h.id, h.granted, h.source, h.at, ${actorName} FROM user_consents h WHERE h.user_id = ? AND h.kind = 'marketing' ORDER BY h.id DESC LIMIT ? OFFSET ?`, args: [id] },
    tracking: { count: "SELECT COUNT(*) AS n FROM user_consents WHERE user_id = ? AND kind = 'tracking'", rows: `SELECT h.id, h.granted, h.source, h.at, ${actorName} FROM user_consents h WHERE h.user_id = ? AND h.kind = 'tracking' ORDER BY h.id DESC LIMIT ? OFFSET ?`, args: [id] },
    log: { count: "SELECT COUNT(*) AS n FROM user_log WHERE user_id = ?", rows: `SELECT h.id, h.action, h.details, h.at, ${actorName} FROM user_log h WHERE h.user_id = ? ORDER BY h.id DESC LIMIT ? OFFSET ?`, args: [id] },
    messenger: { count: "SELECT COUNT(*) AS n FROM user_messenger_contacts WHERE user_id = ?", rows: "SELECT id, shared_at AS sharedAt, paid_amount AS amount, currency, note FROM user_messenger_contacts WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?", args: [id] },
  };
  const k = q[kind];
  const total = (db.prepare(k.count).get(...k.args) as { n: number }).n;
  const rows = db.prepare(k.rows).all(...k.args, per, offset);
  return { total, page: p, perPage: per, rows };
}

/** Организации узла с числом участников. */
export function listOrgs(db: Database.Database) {
  return db.prepare("SELECT o.id, o.name, o.element, (SELECT COUNT(*) FROM user_organizations uo WHERE uo.org_id = o.id) AS members FROM organizations o ORDER BY o.name COLLATE NOCASE").all() as { id: string; name: string; element: string | null; members: number }[];
}

/** Организация-приложение элемента завода (554-1): есть — вернуть, нет — создать. Имя строки — id элемента; человеку ядро
 *  показывает `short_name` из настроек элемента. Повторный вызов дубля не даёт (уникальный индекс `organizations_element`). */
export function appOrg(db: Database.Database, rawElement: unknown): { id: string; name: string; element: string; created: boolean } | { error: string } {
  const element = typeof rawElement === "string" ? rawElement.trim() : "";
  if (!/^[a-z][a-z0-9-]{1,39}$/.test(element)) return { error: "bad-element" };
  const found = db.prepare("SELECT id, name, element FROM organizations WHERE element = ?").get(element) as { id: string; name: string; element: string } | undefined;
  if (found) return { ...found, created: false };
  if (db.prepare("SELECT 1 FROM organizations WHERE name = ? COLLATE NOCASE").get(element)) return { error: "name-taken" };
  const id = nanoid(10);
  db.prepare("INSERT INTO organizations (id, name, element) VALUES (?, ?, ?)").run(id, element, element);
  return { id, name: element, element, created: true };
}

/** Создать организацию; такое имя уже есть (без учёта регистра) — вернуть её. */
export function createOrg(db: Database.Database, rawName: unknown): { id: string; name: string } | { error: string } {
  const name = typeof rawName === "string" ? rawName.trim().replace(/\s+/g, " ") : "";
  if (!name || name.length > 80) return { error: "name-1-80" };
  const found = db.prepare("SELECT id, name FROM organizations WHERE name = ? COLLATE NOCASE").get(name) as { id: string; name: string } | undefined;
  if (found) return found;
  const id = nanoid(10);
  db.prepare("INSERT INTO organizations (id, name) VALUES (?, ?)").run(id, name);
  return { id, name };
}

export const ACTIONS = ["update", "block", "unblock", "addRole", "removeRole", "addOrg", "removeOrg", "marketing", "tracking", "anonymize"] as const;
export type Action = (typeof ACTIONS)[number];
export type Patch = {
  nickname?: string | null; firstName?: string | null; lastName?: string | null; email?: string; avatar?: string | null; wallet?: string | null;
  roles?: string[]; orgs?: string[]; blocked?: boolean; marketing?: boolean; tracking?: boolean;
};
export type BatchResult = { done: string[]; skipped: { id: string; reason: string }[]; revoke: string[]; mediaToDelete: string[] };

const WALLET = /^0x[0-9a-fA-F]{40}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
/** Файл хранилища этого узла (`…/api/media/<id>/file`) — его id; ссылка Google — не наша. */
export const mediaIdOf = (url: string | null): string | null => (url ? (url.match(/\/api\/media\/([A-Za-z0-9_-]+)\/file\b/)?.[1] ?? null) : null);

/** Пакетное действие одной транзакцией. Возвращает сделанное, пропущенное с причиной и то, что гасить после записи. */
export function runBatch(db: Database.Database, actor: Actor, action: Action, ids: string[], value: unknown): BatchResult | { error: string } {
  if (!ACTIONS.includes(action)) return { error: "unknown-action" };
  const list = [...new Set(ids.filter((x) => typeof x === "string" && x))];
  if (list.length === 0 || list.length > 500) return { error: "ids-1-500" };
  if (action === "update" && list.length !== 1) return { error: "update-is-one-person" };
  if (action === "marketing" && value === true && list.length !== 1) return { error: "consent-is-personal" };
  if ((action === "addRole" || action === "removeRole") && !(typeof value === "string" && (ALL_ROLES as readonly string[]).includes(value))) return { error: "unknown-role" };
  if ((action === "addOrg" || action === "removeOrg") && !(typeof value === "string" && db.prepare("SELECT 1 FROM organizations WHERE id = ?").get(value))) return { error: "unknown-org" };
  if ((action === "marketing" || action === "tracking") && typeof value !== "boolean") return { error: "value-boolean" };
  const callerArchitect = actor.roles.includes("architect");
  if (action === "anonymize" && !callerArchitect) return { error: "only-architect" };

  const out: BatchResult = { done: [], skipped: [], revoke: [], mediaToDelete: [] };
  withActor(db, actor.id, "users-tab", () => {
    for (const id of list) {
      const row = db.prepare("SELECT id, email, roles, is_active, deleted_at, avatar_url FROM users WHERE id = ?").get(id) as
        | { id: string; email: string; roles: string; is_active: number; deleted_at: string | null; avatar_url: string | null } | undefined;
      const skip = (reason: string) => out.skipped.push({ id, reason });
      if (!row) { skip("not-found"); continue; }
      if (id === actor.id) { skip("self"); continue; }
      if (row.deleted_at) { skip("anonymized"); continue; }
      const roles = parseRoles(row.roles);
      if (roles.includes("architect") && !callerArchitect) { skip("only-architect"); continue; }
      const setRoles = (next: string[]) => db.prepare("UPDATE users SET roles = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(next), id);
      const consent = (kind: "marketing" | "tracking", granted: boolean) => {
        const last = db.prepare("SELECT granted FROM user_consents WHERE user_id = ? AND kind = ? ORDER BY id DESC LIMIT 1").get(id, kind) as { granted: number } | undefined;
        if (last && (last.granted === 1) === granted) return false;
        db.prepare("INSERT INTO user_consents (user_id, kind, granted, actor, source) VALUES (?, ?, ?, ?, 'users-tab')").run(id, kind, granted ? 1 : 0, actor.id);
        return true;
      };
      switch (action) {
        case "block":
          if (row.is_active !== 1) { skip("already"); continue; }
          db.prepare("UPDATE users SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
          out.revoke.push(id);
          break;
        case "unblock":
          if (row.is_active === 1) { skip("already"); continue; }
          db.prepare("UPDATE users SET is_active = 1, updated_at = datetime('now') WHERE id = ?").run(id);
          break;
        case "addRole": {
          if (value === "architect" && !callerArchitect) { skip("only-architect"); continue; }
          if (roles.includes(value as string)) { skip("already"); continue; }
          setRoles([...roles, value as string]);
          break;
        }
        case "removeRole": {
          if (value === "architect" && !callerArchitect) { skip("only-architect"); continue; }
          if (!roles.includes(value as string)) { skip("already"); continue; }
          const next = roles.filter((r) => r !== value);
          if (next.length === 0) { skip("last-role"); continue; }
          setRoles(next);
          break;
        }
        case "addOrg":
          if (!db.prepare("INSERT OR IGNORE INTO user_organizations (user_id, org_id) VALUES (?, ?)").run(id, value).changes) { skip("already"); continue; }
          break;
        case "removeOrg":
          if (!db.prepare("DELETE FROM user_organizations WHERE user_id = ? AND org_id = ?").run(id, value).changes) { skip("already"); continue; }
          break;
        case "marketing":
        case "tracking":
          if (!consent(action, value as boolean)) { skip("already"); continue; }
          break;
        case "anonymize": {
          const media = mediaIdOf(row.avatar_url);
          if (media) out.mediaToDelete.push(media);
          db.prepare(`UPDATE users SET first_name = NULL, last_name = NULL, avatar_url = NULL, password = NULL, email = ?, wallet = NULL, bio = NULL,
            provider = 'deleted', is_active = 0, deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).run(`deleted-${id}@invalid`, id);
          db.prepare("DELETE FROM accounts WHERE user_id = ?").run(id);
          db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
          db.prepare("DELETE FROM user_auth_methods WHERE user_id = ?").run(id);
          db.prepare("DELETE FROM verification_tokens WHERE identifier = ?").run(row.email);
          out.revoke.push(id);
          break;
        }
        case "update": {
          // Сначала проверяется ВСЁ, потом пишется: отказ по одному полю не оставляет половины правки (и не удаляет файл аватарки).
          const p = (value ?? {}) as Patch;
          const wallet = "wallet" in p ? clean(p.wallet, 42) : undefined;
          if (wallet && !WALLET.test(wallet)) { skip("bad-wallet"); continue; }
          const email = "email" in p ? clean(p.email, 254)?.toLowerCase() ?? "" : undefined;
          if (email !== undefined && !EMAIL.test(email)) { skip("bad-email"); continue; }
          if (email !== undefined && email !== row.email && db.prepare("SELECT 1 FROM users WHERE email = ? AND id != ? AND app = (SELECT app FROM users WHERE id = ?)").get(email, id, id)) { skip("email-taken"); continue; }
          let nextRoles: string[] | undefined;
          if ("roles" in p) {
            nextRoles = [...new Set((p.roles ?? []).filter((r) => (ALL_ROLES as readonly string[]).includes(r)))];
            if (nextRoles.length === 0 || nextRoles.length !== new Set(p.roles ?? []).size) { skip("bad-roles"); continue; }
            if (nextRoles.includes("architect") !== roles.includes("architect") && !callerArchitect) { skip("only-architect"); continue; }
          }
          const wantOrgs = "orgs" in p ? [...new Set((p.orgs ?? []).filter((o) => typeof o === "string"))] : undefined;
          if (wantOrgs?.some((o) => !db.prepare("SELECT 1 FROM organizations WHERE id = ?").get(o))) { skip("unknown-org"); continue; }

          const sets: string[] = [];
          const vals: unknown[] = [];
          const put = (col: string, v: unknown) => { sets.push(`${col} = ?`); vals.push(v); };
          if ("nickname" in p) put("nickname", clean(p.nickname, 80));
          if ("firstName" in p) put("first_name", clean(p.firstName, 80));
          if ("lastName" in p) put("last_name", clean(p.lastName, 80));
          if ("avatar" in p) {
            const next = clean(p.avatar, 500);
            if (next !== row.avatar_url) { const old = mediaIdOf(row.avatar_url); if (old) out.mediaToDelete.push(old); }
            put("avatar_url", next);
          }
          if (wallet !== undefined) put("wallet", wallet);
          if (email !== undefined) put("email", email);
          if (nextRoles && JSON.stringify(nextRoles) !== JSON.stringify(roles)) put("roles", JSON.stringify(nextRoles));
          if ("blocked" in p) {
            const active = p.blocked ? 0 : 1;
            if (active !== row.is_active) { put("is_active", active); if (!active) out.revoke.push(id); }
          }
          if (sets.length) db.prepare(`UPDATE users SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?`).run(...vals, id);
          if (wantOrgs) {
            const have = (db.prepare("SELECT org_id FROM user_organizations WHERE user_id = ?").all(id) as { org_id: string }[]).map((r) => r.org_id);
            for (const o of have.filter((o) => !wantOrgs.includes(o))) db.prepare("DELETE FROM user_organizations WHERE user_id = ? AND org_id = ?").run(id, o);
            for (const o of wantOrgs.filter((o) => !have.includes(o))) db.prepare("INSERT OR IGNORE INTO user_organizations (user_id, org_id) VALUES (?, ?)").run(id, o);
          }
          if (typeof p.marketing === "boolean") consent("marketing", p.marketing);
          if (typeof p.tracking === "boolean") consent("tracking", p.tracking);
          break;
        }
      }
      out.done.push(id);
    }
  });
  return out;
}
