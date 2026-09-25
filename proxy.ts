import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PRESENTATION_LANGS, DEFAULT_PRESENTATION_LANG } from "@/lib/presentation-langs";

// 295: корень `/` с Cache Components читает сессию внутри <Suspense>, и его собственное перенаправление приходит уже
// потоком (200 + meta refresh). Чтобы не вошедший получал прежний настоящий 307 на /login, наличие куки сессии
// проверяется здесь. Имена куки — те же, что в lib/auth/auth.config.ts; просроченную куку ловит сама страница.
const SESSION_COOKIES = ["__Secure-authjs.session-token", "authjs.session-token"];

// 🔒 300 (слово владельца 2026-09-25): КОРЕНЬ ВХОДА — ЕГО ГЛАВНАЯ, А НЕ ФОРМА. Ссылки на элементы строятся как
// `https://<элемент>.<зона>/<язык>`; при одном языке без префикса ссылка стала бы `auth.<зона>/` и приводила бы в форму
// входа вместо страницы службы. Форма живёт на `/login` — туда и так ведут все кнопки «Войти» узла (проверено поиском).
// Вошедший на `/` по-прежнему видит свою страницу (`app/page.tsx`).
//
// 🔒 НЕЗНАКОМЫЙ ЯЗЫК — НА ЯЗЫК ПО УМОЛЧАНИЮ, НО ТОЛЬКО ДВУХБУКВЕННЫЙ СЕГМЕНТ. `app/[lang]` — ЖАДНЫЙ сегмент: он ловит любой
// однословный адрес, не занятый статическим. Сайт может говорить на языке, которого у входа нет (`/de` давал 404).
// Переадресуется лишь то, что похоже на код языка (`^[a-z]{2}import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 295: корень `/` с Cache Components читает сессию внутри <Suspense>, и его собственное перенаправление приходит уже
// потоком (200 + meta refresh). Чтобы не вошедший получал прежний настоящий 307 на /login, наличие куки сессии
// проверяется здесь. Имена куки — те же, что в lib/auth/auth.config.ts; просроченную куку ловит сама страница.
const SESSION_COOKIES = ["__Secure-authjs.session-token", "authjs.session-token"];

): `/nope` остаётся честным 404, а статические
// `/login`, `/register`, `/logout`, `/signout`, `/guest-login` длиннее двух букв, `/api/*` исключён сопоставителем.
const LANG_SEGMENT = /^\/([a-z]{2})(\/.*)?$/

export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname
  if (path === "/" && !SESSION_COOKIES.some((n) => req.cookies.has(n))) {
    return NextResponse.redirect(new URL(`/${DEFAULT_PRESENTATION_LANG}`, req.url), 307);
  }
  const lang = LANG_SEGMENT.exec(path)
  if (lang && !(PRESENTATION_LANGS as readonly string[]).includes(lang[1])) {
    return NextResponse.redirect(new URL(`/${DEFAULT_PRESENTATION_LANG}${lang[2] ?? ""}`, req.url), 307);
  }
  const res = NextResponse.next();
  // Allow this auth page to be embedded as an iframe by:
  //  - same origin (self)
  //  - any fractera.ai subdomain over HTTPS (legacy 4th-level)
  //  - any host on the local *.fractera.local dev domain
  //  - any host that shares this auth host's hostname (IP-mode: admin on
  //    :3002, app on :3000 — all same host, different ports). We can't
  //    enumerate ports in CSP, so we widen to the request host itself.
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const hostname = host.split(":")[0];
  const sameHostHttp  = hostname ? `http://${hostname}:* http://${hostname}` : "";
  const sameHostHttps = hostname ? `https://${hostname}:* https://${hostname}` : "";
  // Узел Fractera (280-10): ядро показывает страницы входа во фрейме своей страницы Preview — на
  // `architect.<зона>` или на петле машины. Вход живёт на `auth.<зона>`, значит зона — хвост имени.
  const zone = hostname.startsWith("auth.") ? hostname.slice(5) : "";
  const nodeAncestors = [zone ? `https://${zone} https://*.${zone}` : "", "http://localhost:* http://127.0.0.1:*"];
  res.headers.set(
    "Content-Security-Policy",
    [
      "frame-ancestors 'self'",
      sameHostHttp,
      sameHostHttps,
      ...nodeAncestors,
      "https://*.fractera.ai",
      "http://*.fractera.local:3000",
      "http://*.fractera.local:3002",
    ].filter(Boolean).join(" ")
  );
  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
