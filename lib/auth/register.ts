"use server";

import { hash } from "bcrypt-ts";
import { getDb } from "@/lib/auth/db";
import { nanoid } from "nanoid";
import { auth } from "./auth";
import { ALL_ROLES } from "./roles";
import { headers } from "next/headers";
import { appOfReturn } from "./apps";

type RegisterResult =
  | { success: true; roles: string[] }
  | { success: false; error: string };

export async function register(email: string, password: string): Promise<RegisterResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const db = getDb();
  // 🔒 554-3: РЕГИСТРАЦИЯ — В ПРИЛОЖЕНИИ, КУДА ЧЕЛОВЕК ВЕРНЁТСЯ. Форма зовёт это действие со страницы
  // `/register?callbackUrl=…`; её адрес приходит заголовком `referer` (`lib/auth/apps.ts` разворачивает его до сайта).
  const app = appOfReturn((await headers()).get("referer"));

  const existing = db
    .prepare("SELECT id FROM users WHERE email = ? AND app = ?")
    .get(normalizedEmail, app);

  if (existing) {
    return { success: false, error: "This email is already registered" };
  }

  const hashedPassword = await hash(password, 10);
  const nickname = normalizedEmail.split("@")[0];

  // Guest promotion (HOW-USE-AUTH.md / auth-architecture §13): if the caller is
  // currently signed in as a GUEST, promote that SAME row in place — set the real
  // email/password, switch roles to ["user"], keep provider="credentials" — instead
  // of inserting a new user. Because user.id is unchanged, every record the guest
  // produced (cart, chat, drafts) stays attached. No data migration.
  // Default (non-guest) registration is byte-identical to before.
  const session = await auth().catch(() => null);
  const sessRoles = (session?.user as { roles?: string[] } | undefined)?.roles ?? [];
  const sessUserId = (session?.user as { id?: string } | undefined)?.id;
  if (sessUserId && sessRoles.includes("guest")) {
    const guest = db
      .prepare("SELECT id, provider FROM users WHERE id = ?")
      .get(sessUserId) as { id: string; provider: string } | undefined;
    if (guest && guest.provider === "guest") {
      db.prepare(
        "UPDATE users SET email = ?, nickname = ?, password = ?, roles = ?, provider = 'credentials', app = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(normalizedEmail, nickname, hashedPassword, JSON.stringify(["user"]), app, guest.id);
      return { success: true, roles: ["user"] };
    }
  }

  // Первый зарегистрировавшийся — владелец развёртывания, и он получает роль в
  // КАЖДОМ из четырёх слоёв прав приложения (решение владельца 2026-08-11):
  //
  //   architect — сам проект, верхний тир платформы
  //   admin     — административный слой `(admin)`
  //   finance   — денежный слой `(finance)`
  //   user      — личный слой `(account)`, где человек видит своё
  //
  // 🔒 ЭТО НЕ ПРО ОБЪЁМ ПРАВ, А ПРО ЧЕСТНОСТЬ СПИСКА. `architect` и так входит во
  // все четыре группы (`PROTECTED_GROUP_ROLES` в приложении), поэтому доступ от
  // этой строки не меняется ни на страницу. Меняется то, что человек видит сам:
  // ящик аккаунта разбит по слоям прав и показывает роли владельца ему самому —
  // и владелец должен читать там четыре слоя своего проекта, а не догадываться о
  // них по тому, что ему всё открыто.
  //
  // Роли пишутся в базу ОДИН РАЗ, при регистрации: правка этой строки меняет
  // только будущие развёртывания. Уже созданному пользователю роли выдаются
  // отдельно — и НЕ им самим: `/api/admin/users/<id>` намеренно отказывает в
  // правке собственной учётной записи (единственный владелец не может изменить
  // свои роли вообще — известное ограничение, ждёт отдельного решения).
  // 🔒 ВСЕ РОЛИ, А НЕ ЧЕТЫРЕ (владелец 2026-08-13, по итогам аудита).
  //
  // Четырёх ролей хватало, чтобы ОТКРЫТЬ страницы: `architect` входит в каждую
  // группу прав. Но не хватало, чтобы ПРОВЕРИТЬ продукт: владелец не мог увидеть
  // сайт глазами покупателя с подпиской, менеджера доставки или редактора —
  // ровно тех, ради кого роли и заведены. Свой сервер он поднимает, чтобы
  // попробовать всё, и обязан иметь всё.
  //
  // Список НЕ дублируется здесь строкой: он читается из словаря ролей, поэтому
  // новая роль появляется у владельца сама, а не после того, как кто-то вспомнит
  // про этот файл. `guest` исключён намеренно — это состояние «не вошёл», а не
  // право, и в учётной записи ему делать нечего.
  // 554-3: «первый» — только в узле; первый человек приложения завода — обычный пользователь этого приложения.
  const isFirst = app === "node" && !db.prepare("SELECT id FROM users WHERE app = 'node' LIMIT 1").get();
  const roles: string[] = isFirst ? ALL_ROLES.filter((r) => r !== "guest") : ["user"];

  db.prepare(
    "INSERT INTO users (id, email, nickname, password, roles, provider, app) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(nanoid(), normalizedEmail, nickname, hashedPassword, JSON.stringify(roles), "credentials", app);

  return { success: true, roles };
}
