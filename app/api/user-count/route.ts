import { NextResponse, connection } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  // 295: число пользователей — на каждый запрос, не со сборки (Cache Components иначе предрендерит обработчик).
  await connection();
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as cnt FROM users").get() as { cnt: number };
  return NextResponse.json({ count: row.cnt });
}
