import { NextResponse } from "next/server";
import { signOut } from "@/lib/auth/auth";

// GET /logout?redirectUrl=<absolute-app-url> — sign-out endpoint for the app shell (step 169).
//
// The public app's account drawer links to a relative /logout on ITS host; the app's proxy
// (AUTH_FORM_PATHS) redirects that here with an absolute redirectUrl back to the site (this
// service cannot derive the app origin itself: a different port in IP mode, a different
// subdomain in Secure mode). We clear the NextAuth session (JWT strategy — clearing the
// session cookie IS the sign-out; signOut() handles the secure/insecure cookie names and the
// COOKIE_DOMAIN family) and redirect ourselves, deliberately NOT via signOut({redirectTo}):
// that path runs the NextAuth redirect callback, which only allows the COOKIE_DOMAIN family —
// unset in IP mode, where the app lives on another PORT of the same host and would be dropped.
//
// Plain GET navigation (no JS required — the drawer link works with JavaScript off), same
// pattern as the sibling /api/auth/guest route (signIn from a route handler).
// 🔒 300 (2026-09-25): ОСНОВА ОТНОСИТЕЛЬНОГО АДРЕСА — ПУБЛИЧНЫЙ АДРЕС ВХОДА, А НЕ `request.url`. За туннелем Cloudflare
// `request.url` — внутренний адрес службы (`localhost:<порт>`): выход вёл человека из интернета на петлю его же машины
// (измерено: /logout → 307 https://localhost:24681/login). Публичный адрес — NEXTAUTH_URL; нет его — адрес запроса.
// 🔒 И КУДА ВЕСТИ — ТОЛЬКО СВОИ: хост входа, хосты его зоны (`<элемент>.<зона>`, сама зона) и тот же хост на другом порту
// (режим по IP). Прежде `redirectUrl` принимал любой внешний адрес — открытая переадресация от имени входа.
function publicOrigin(request: Request): URL {
  try {
    if (process.env.NEXTAUTH_URL) return new URL(process.env.NEXTAUTH_URL);
  } catch { /* неверный адрес в окружении — берём адрес запроса */ }
  return new URL(request.url);
}

function isOwn(target: URL, origin: URL): boolean {
  const host = origin.hostname;
  const zone = host.startsWith("auth.") ? host.slice(5) : host;
  return target.hostname === host || target.hostname === zone || target.hostname.endsWith(`.${zone}`);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = publicOrigin(request);
  let target = new URL("/login", origin);
  const wanted = searchParams.get("redirectUrl");
  if (wanted) {
    try {
      const candidate = new URL(wanted, origin);
      if (isOwn(candidate, origin)) target = candidate;
    } catch { /* неразборчивый адрес — на форму входа */ }
  }

  await signOut({ redirect: false });
  return NextResponse.redirect(target);
}
