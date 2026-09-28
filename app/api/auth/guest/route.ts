import { NextResponse } from "next/server";
import { auth, signIn } from "@/lib/auth/auth";
import { nanoid } from "nanoid";
import crypto from "crypto";
import { clientIp, createGuest, takeGuestSlot, userAlive } from "@/lib/guest-guard";

// 331-4/331-5: гость создаётся только в пределах лимита по IP (в памяти, до базы) и под потолком гостевых записей
// (`lib/guest-guard.ts`). Сверх лимита запись не создаётся: браузер с адресом возврата уходит туда без сессии (замок
// элемента скажет об отказе и не повторит), голый запрос получает 429.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const redirectUrl = searchParams.get("redirectUrl") || "/";

  const session = await auth();
  if (session?.user && userAlive(session.user.id)) {
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  }

  if (!takeGuestSlot(clientIp(request.headers))) {
    if (searchParams.get("redirectUrl")) return NextResponse.redirect(new URL(redirectUrl, process.env.NEXTAUTH_URL ?? request.url));
    return NextResponse.json({ error: "too-many-guests-from-this-address" }, { status: 429 });
  }

  const guestEmail = `guest_${crypto.randomUUID()}@fractera.guest`;
  createGuest(nanoid(), guestEmail);

  return signIn("credentials", { email: guestEmail, redirectTo: redirectUrl });
}
