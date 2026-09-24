import { NextResponse, connection } from "next/server";
import { signIn } from "@/lib/auth/auth";

export async function GET(request: Request) {
  // 295: ответ зависит от окружения и запроса — только на каждый запрос. Без этой строки сборка без ARCHITECT_TOKEN
  // предрендерила отказ, и он отвечал бы вечно.
  await connection();
  if (!process.env.ARCHITECT_TOKEN) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const redirectTo = searchParams.get("redirectTo") || "/";

  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  return signIn("architect", { token, redirectTo });
}
