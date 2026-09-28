import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { shouldBypassAuth } from "@/lib/auth-bypass";
import { userAlive } from "@/lib/guest-guard";

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

  // 331-5: запись вытеснена (потолок гостей) или удалена — кука есть, человека нет.
  if (!session?.user || !userAlive(session.user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders(origin),
    });
  }

  return NextResponse.json(
    {
      userId: session.user.id,
      email: session.user.email,
      roles: (session.user as { roles?: string[] }).roles ?? ["user"],
    },
    { headers: corsHeaders(origin) }
  );
});
