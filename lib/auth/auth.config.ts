import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { Resend as ResendClient } from "resend";
import { compare } from "bcrypt-ts";
import { getDb } from "@/lib/auth/db";
import { revokeUser } from "@/lib/sso";
import { recordSignIn } from "@/lib/auth/users-journal";
import { appOfReturn, NODE_APP } from "@/lib/auth/apps";

function buildProviders(): NextAuthConfig["providers"] {
  const providers: NextAuthConfig["providers"] = [];

  if (process.env.ARCHITECT_TOKEN) {
    providers.push(
      Credentials({
        id: "architect",
        credentials: {
          token: { label: "Admin Token", type: "password" },
        },
        async authorize(credentials) {
          const token = credentials?.token as string | undefined;
          if (!token || token !== process.env.ARCHITECT_TOKEN) return null;
          return {
            id: "virtual-admin",
            email: "admin@local",
            name: "Administrator",
            roles: ["architect"] as string[],
          };
        },
      })
    );
  }

  providers.push(
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const rawEmail = credentials?.email as string | undefined;
        const email = rawEmail?.trim().toLowerCase();
        const password = credentials?.password as string | undefined;

        if (!email) return null;

        // 🔒 554-3: ЧЕЛОВЕК ИЩЕТСЯ В ПРИЛОЖЕНИИ, КУДА ОН ВОЗВРАЩАЕТСЯ. Форма шлёт `callbackUrl` — адрес страницы входа, внутри
        // которого адрес сайта (`lib/auth/apps.ts`). Своей записи в приложении нет — подходят ещё две записи узла: гость (его
        // заводит `/api/auth/guest`, он живёт в `node`) и архитектор узла (он признаётся во всех приложениях). Своя запись всегда
        // первая.
        const app = appOfReturn((credentials as Record<string, unknown> | undefined)?.callbackUrl as string | undefined);
        const db = getDb();
        const user = db
          .prepare(`SELECT id, email, nickname, password, roles, provider, is_active, app FROM users WHERE email = ?
            AND (app = ? OR (app = 'node' AND (provider = 'guest' OR roles LIKE '%"architect"%')))
            ORDER BY app = ? DESC LIMIT 1`)
          .get(email, app, app) as {
          id: string;
          email: string;
          nickname: string | null;
          password: string | null;
          roles: string;
          provider: string;
          is_active: number;
          app: string;
        } | undefined;

        if (!user) return null;

        // 559-1 (правка канона по слову владельца 2026-10-21: «Три правки + новый ключ»): заблокированный не входит.
        if (user.is_active !== 1) return null;

        const roles = JSON.parse(user.roles) as string[];

        if (!user.password) {
          // 559-1: вход БЕЗ пароля — только у гостя (`/api/auth/guest` зовёт signIn("credentials", { email })). ✗ Измерено на копии
          // базы: прежде эта ветка пускала по одному email любую запись без пароля — пользователей Google и письма, в том числе
          // архитектора, с любым паролем в форме.
          if (user.provider !== "guest") return null;
          return { id: user.id, email: user.email, name: user.nickname, roles, app: user.app };
        }

        if (!password) return null;

        const valid = await compare(password, user.password);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.nickname, roles, app: user.app };
      },
    })
  );

  // Google OAuth — only active when BOTH credentials are present. An empty
  // credential (the default seeded by bootstrap) means "provider off", which
  // keeps the /api/auth/methods flag false and hides the button on /login.
  // Credentials are settable only in secure mode (Admin → Login methods).
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        // The owner's workspace is single-tenant: linking a Google sign-in to a
        // pre-existing same-email account is the desired behaviour (Google has
        // verified ownership of the address).
        allowDangerousEmailAccountLinking: true,
      })
    );
  }

  // Magic-link (Resend) — only active when an API key is present (empty = off).
  // sendVerificationRequest mirrors FES (fractera-easy-starter/lib/auth.ts).
  if (process.env.RESEND_API_KEY) {
    const from = process.env.AUTH_RESEND_FROM || "noreply@localhost";
    providers.push(
      Resend({
        apiKey: process.env.RESEND_API_KEY,
        from,
        sendVerificationRequest: async ({ identifier: email, url }) => {
          const client = new ResendClient(process.env.RESEND_API_KEY!);
          await client.emails.send({
            from,
            to: email,
            subject: "Sign in to your workspace",
            html: `
              <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
                <h2 style="margin:0 0 16px;font-size:20px">Sign in to your workspace</h2>
                <p style="margin:0 0 24px;color:#555">Click the button below to sign in. This link expires in 24 hours.</p>
                <a href="${url}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">Sign in &rarr;</a>
                <p style="margin:24px 0 0;color:#999;font-size:12px">If you did not request this email you can safely ignore it.</p>
              </div>
            `,
          });
        },
      })
    );
  }

  return providers;
}

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
    signOut: "/signout",
  },
  providers: buildProviders(),
  cookies: {
    sessionToken: {
      name: process.env.COOKIE_SECURE === "true"
        ? "__Secure-authjs.session-token"
        : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: process.env.COOKIE_SECURE === "true",
        domain: process.env.COOKIE_DOMAIN,
      },
    },
  },
  // 328-2: выход в центре гасит билеты единого входа этого человека на всех доменах элементов.
  events: {
    signOut(message) {
      const token = "token" in message ? message.token : null
      if (token?.id) revokeUser(String(token.id))
    },
    // 559-2: вход состоялся — способ и время в таблицах пользователей (`lib/auth/users-journal.ts`). Событие, а не проверка: на сам
    // вход не влияет, его отказ входа не отменяет.
    signIn({ user, account, profile }) {
      try {
        recordSignIn(user?.id ?? undefined, account?.provider, (profile ?? null) as Record<string, unknown> | null)
      } catch (e) {
        console.warn(`[users] вход не записан в журнал: ${e instanceof Error ? e.message : String(e)}`)
      }
    },
  },
  callbacks: {
    // 559-1: заблокированный не входит и через Google или письмо. Своей записи ещё нет (первый вход) — вход как прежде.
    // Пароль и гость проверяются в `authorize` выше, токен архитектора — своим провайдером.
    signIn({ user, account }) {
      if (!account || account.type === "credentials") return true;
      const db = getDb();
      const byId = user?.id ? (db.prepare("SELECT is_active FROM users WHERE id = ?").get(user.id) as { is_active: number } | undefined) : undefined;
      const mail = user?.email?.trim().toLowerCase();
      // 554-3: запись по email — в приложении этого входа (адаптер кладёт его в `user.app`).
      const app = (user as { app?: string } | undefined)?.app ?? NODE_APP;
      const row = byId ?? (mail ? (db.prepare("SELECT is_active FROM users WHERE email = ? AND app = ?").get(mail, app) as { is_active: number } | undefined) : undefined);
      return !row || row.is_active === 1;
    },
    // OAuth / magic-link complete on the auth host (auth.<domain>) but usually
    // need to land back on a sibling subdomain (the Shell or Admin). The default
    // NextAuth redirect callback only allows same-origin, which would drop a
    // cross-subdomain callbackUrl to baseUrl. Allow the configured cookie-domain
    // family (set in secure mode, e.g. ".aifa.dev") plus same-origin.
    redirect({ url, baseUrl }) {
      try {
        const target = new URL(url, baseUrl);
        const cookieDomain = process.env.COOKIE_DOMAIN;
        if (cookieDomain && cookieDomain.startsWith(".")) {
          const root = cookieDomain.slice(1);
          if (target.hostname === root || target.hostname.endsWith(`.${root}`)) {
            return target.toString();
          }
        }
        if (target.origin === baseUrl) return target.toString();
      } catch {
        // fall through to baseUrl
      }
      return baseUrl;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.roles = (user as { roles?: string[] }).roles ?? ["user"];
        // 554-3: приложение записи — по нему `/api/session` и единый вход решают, где человека признают.
        token.app = (user as { app?: string }).app ?? NODE_APP;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { roles?: string[] }).roles = token.roles as string[];
        (session.user as { app?: string }).app = (token.app as string | undefined) ?? NODE_APP;
      }
      return session;
    },
  },
};
