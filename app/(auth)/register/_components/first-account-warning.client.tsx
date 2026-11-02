"use client";

import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { AuthStrings } from "@/lib/i18n/auth-strings";

// 🔒 ПРЕДУПРЕЖДЕНИЕ ДО ПАРОЛЯ, А НЕ ПОСЛЕ. Слово владельца 2026-11-02: первая учётная запись остаётся администратором, её «никак и ни в
// коем случае нельзя потерять так как восстановление в принципе невозможно» — об этом на странице, в Danger-стиле. Окно после
// регистрации (`AdministratorConfirmModal`) говорило это, когда пароль уже придуман; здесь — пока человек его только выбирает.
// Пользователей нет — значит, эта регистрация первая (тот же признак, что у формы входа: `/api/user-count`). Тексты — те же, что в окне:
// переведены на все языки службы.
export function FirstAccountWarning({ s }: { s: AuthStrings }) {
  const [first, setFirst] = useState(false);
  useEffect(() => {
    fetch("/api/user-count", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { count?: number }) => setFirst(d?.count === 0))
      .catch(() => {});
  }, []);
  if (!first) return null;
  return (
    <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
      <TriangleAlert />
      <AlertTitle>{s.importantLabel}</AlertTitle>
      <AlertDescription>{s.adminImportantBody}</AlertDescription>
    </Alert>
  );
}
