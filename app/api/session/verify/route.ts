// @api verify a session token presented by another service of the node
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { shouldBypassAuth } from "@/lib/auth-bypass";
import { userAlive } from "@/lib/guest-guard";

// Lightweight session-validity endpoint, designed for nginx `auth_request`.
//
// Returns HTTP 204 No Content when the caller has a valid Fractera session
// cookie (`authjs.session-token` / `__Secure-authjs.session-token`).
// Returns HTTP 401 Unauthorized otherwise.
//
// No body — nginx discards the body for `auth_request` subrequests, so we
// minimise bytes-on-the-wire. This route is hit on every `/chat/` request
// (including static assets) and must stay fast.
//
// Wiring (in nginx, see lib/bootstrap.sh):
//   location = /auth-verify {
//     internal;
//     proxy_pass http://127.0.0.1:3001/api/session/verify;
//     proxy_pass_request_body off;
//     proxy_set_header Content-Length "";
//   }
//   location /chat/ {
//     auth_request /auth-verify;
//     error_page 401 = @login_redirect;
//     ...
//   }
export const GET = auth(function GET(req) {
  if (shouldBypassAuth()) {
    return new NextResponse(null, { status: 204 });
  }
  // 559-1: этой дверью узнают посетителя элементы из своего репозитория (FRACTERA.md) — заблокированный и удалённый здесь тоже 401.
  if (!req.auth?.user || !userAlive(req.auth.user.id)) {
    return new NextResponse(null, { status: 401 });
  }
  return new NextResponse(null, { status: 204 });
});
