import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoggedInView } from "./_components/logged-in-view.client";

// 295: Cache Components — сессия читается из запроса, поэтому эта часть страницы живёт в <Suspense> и приходит потоком;
// всё вокруг предрендерено. Страница и раньше была единственной динамической у входа (снимок ДО).
export default function AuthRoot() {
  return (
    <Suspense fallback={null}>
      <AuthRootForRequest />
    </Suspense>
  );
}

async function AuthRootForRequest() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const nextauthUrl = process.env.NEXTAUTH_URL ?? "";
  const appUrl   = nextauthUrl.replace("://auth.", "://");
  // 🔒 THE ARCHITECT'S PANEL OF A NODE IS architect.<apex> (step 797, the owner 2026-11-18 on fractera.ai):
  // admin.<apex> does not exist on a node — no name, no certificate, a dead screen after sign-in.
  const adminUrl = nextauthUrl.replace("://auth.", "://architect.");
  // 🔒 АДРЕС ПАМЯТИ СЧИТАЕТСЯ ТЕМ ЖЕ ПРИЁМОМ, ЧТО ДВА СОСЕДНИХ (2026-09-10,
  // правка владельца: «после авторизации предлагается в числе прочих открыть
  // память»). Своя формула здесь разошлась бы с ними в тот день, когда сменится
  // домен, — и разошлась бы МОЛЧА, потому что заметить это можно только войдя.
  const memoryUrl = nextauthUrl.replace("://auth.", "://memory.");
  const roles: string[] = (session.user as { roles?: string[] }).roles ?? [];

  return (
    <LoggedInView
      email={session.user.email ?? ""}
      appUrl={appUrl}
      adminUrl={adminUrl}
      memoryUrl={memoryUrl}
      roles={roles}
    />
  );
}
