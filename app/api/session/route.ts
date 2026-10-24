// @api return the current session of the visitor or answer 401
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { shouldBypassAuth } from "@/lib/auth-bypass";
import { liveUser } from "@/lib/guest-guard";
import { admittedTo, appOfUser, NODE_APP } from "@/lib/auth/apps";
import { appOfElement, ELEMENT_HEADER } from "@/lib/auth/caller";

const ALLOWED = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function corsHeaders(origin: string | null): HeadersInit {
  if (!origin || !ALLOWED.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
}

const DEMO_SESSION = {
  userId: "demo@local",
  email: "demo@local",
  roles: ["architect"],
};

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders(origin),
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "cookie, content-type",
    },
  });
}

// auth() wrapper reads cookie directly from the HTTP request,
// avoiding the React-context dependency of the standalone auth() call.
export const GET = auth(function GET(req) {
  const origin = req.headers.get("origin");

  if (shouldBypassAuth()) {
    return NextResponse.json(DEMO_SESSION, { headers: corsHeaders(origin) });
  }

  const session = req.auth;

  // 331-5: запись вытеснена (потолок гостей) или удалена — кука есть, человека нет. 559-1: заблокирована — так же.
  const live = session?.user ? liveUser(session.user.id) : null;
  // 🔒 554-4: ЧЕЛОВЕК ПРИЛОЖЕНИЯ ЗАВОДА ПО ОБЩЕЙ КУКЕ ЗОНЫ НЕ ПРИЗНАЁТСЯ. Эту дверь спрашивают ядро и все элементы зоны, и кука
  // доходит до каждого из них; человек приложения живёт билетом на сайте своего приложения (`/api/auth/sso` → `/api/auth/ticket`).
  // Записи узла — как прежде.
  if (!session?.user || !live || appOfUser(session.user.id) !== NODE_APP) {
    return NextResponse.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders(origin),
    });
  }
  // 🔒 580: САЙТ ПРИЛОЖЕНИЯ ЗАВОДА ПРИЗНАЁТ ЗАПИСЬ УЗЛА ТОЛЬКО У АРХИТЕКТОРА И ГОСТЯ — то же правило, что у единого входа (`admittedTo`).
  // Владелец 2026-10-24: администратор «может быть связан только с той организации через которую пользователь зарегистрировался».
  // ✗ Без этого администратор узла по общей куке зоны был бы администратором каждого приложения завода. Сервер элемента называет себя
  // (`x-fractera-element`); не назвал (элементы до 580) или элемент — не приложение завода — как прежде.
  const element = req.headers.get(ELEMENT_HEADER);
  if (element && !admittedTo(appOfElement(element), session.user.id, live.roles)) {
    return NextResponse.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders(origin),
    });
  }

  // 559-1: роли — из базы, а не из куки входа: смена роли действует со следующего запроса. Форма ответа прежняя.
  return NextResponse.json(
    {
      userId: session.user.id,
      email: session.user.email,
      roles: live.roles,
    },
    { headers: corsHeaders(origin) }
  );
});
