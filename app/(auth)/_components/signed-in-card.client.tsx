"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getSession, signOut } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAuthStrings, detectBrowserLang, fill, DEFAULT_AUTH_LANG } from "@/lib/i18n/auth-strings";
import { pickRoleLabel } from "@/lib/auth/role-label";

// КАРТОЧКА ВОШЕДШЕГО ВМЕСТО ГОЛОЙ ФОРМЫ (шаг 260-2 узла AGI).
//
// ✗ ОПЛАЧЕНО 2026-09-21: владелец на телефоне уже вошёл, но снова и снова попадал
// на форму регистрации — «круг за кругом, и нет никакой возможности выйти».
// Голая форма у вошедшего читается как «вход не удался», человек регистрируется
// заново (в базе остались две его записи с разницей в минуту) и снова видит форму.
//
// 🔒 ОТСЮДА ПРАВИЛО: форма входа и регистрации показывается ТОЛЬКО тому, у кого
// нет сессии. Вошедший видит, кто он и с какой ролью, и одной кнопкой уходит на
// сайт; вторая кнопка — выйти и войти другим. Формы — дочерние элементы, и пока
// сессия спрашивается, их нет: иначе форма мигнула бы и её успели бы заполнить.

type Who = { who: string; roles: string[] };

/** Куда вернуть человека: на сайт, с которого он пришёл, но только в своей зоне. */
function returnTarget(callbackUrl: string | null): string {
  const { protocol, hostname } = window.location;
  const zone = hostname.replace(/^auth\./, "");
  if (callbackUrl) {
    try {
      const u = new URL(callbackUrl, window.location.href);
      // Чужое имя сюда не пускаем: иначе форма входа становится открытой
      // переадресацией на любой адрес из строки запроса.
      if (u.hostname === zone || u.hostname.endsWith(`.${zone}`)) return u.toString();
    } catch { /* кривой адрес — ниже корень сайта */ }
  }
  // На петле (`127.0.0.1:<порт>`) сайт живёт на другом порту, и угадать его
  // отсюда нельзя — корень самой службы честно показывает, куда идти дальше.
  if (zone === hostname) return "/";
  return `${protocol}//${zone}/`;
}

export function SignedInGate({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const requireRole = searchParams.get("requireRole");
  const [state, setState] = useState<"checking" | "anonymous" | Who>("checking");
  const [leaving, setLeaving] = useState(false);
  const [lang, setLang] = useState(DEFAULT_AUTH_LANG);
  useEffect(() => { setLang(detectBrowserLang()); }, []);
  const s = getAuthStrings(lang);

  useEffect(() => {
    getSession()
      .then((sess) => {
        if (!sess?.user) { setState("anonymous"); return; }
        setState({
          who: sess.user.name || sess.user.email || "",
          roles: (sess.user as { roles?: string[] }).roles ?? [],
        });
      })
      // Спросить не удалось — показываем форму: хуже не показать вход вовсе.
      .catch(() => setState("anonymous"));
  }, []);

  if (state === "anonymous") return <>{children}</>;

  if (state === "checking") {
    return (
      <div className="w-full max-w-sm p-8 rounded-xl border bg-background shadow-sm flex justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const role = pickRoleLabel(state.roles, requireRole);
  return (
    <div className="w-full max-w-sm flex flex-col gap-5 p-8 bg-background rounded-xl border shadow-sm">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{s.signedInTitle}</h1>
        <p className="text-sm text-muted-foreground">{fill(s.welcomeToast, { who: state.who, role })}</p>
      </div>
      <Button className="w-full" onClick={() => { window.location.href = returnTarget(searchParams.get("callbackUrl")); }}>
        {s.goToApp}
      </Button>
      <Button
        variant="outline"
        className="w-full"
        disabled={leaving}
        onClick={async () => {
          setLeaving(true);
          await signOut({ redirect: false });
          setLeaving(false);
          setState("anonymous");
        }}
      >
        {leaving ? <><Loader2 className="size-4 animate-spin" /> {s.signingOut}</> : s.signOut}
      </Button>
    </div>
  );
}
