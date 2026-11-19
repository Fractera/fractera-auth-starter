// 803-1: the words of the choice page — ru and en from the core's task verbatim; every other language falls back to English.
export const CONTINUE_AS_WORDS = {
  ru: { title: "Вы вошли как {email}", go: "Продолжить как {email}", other: "Войти другим аккаунтом" },
  en: { title: "You are signed in as {email}", go: "Continue as {email}", other: "Sign in with another account" },
} as const

export type ContinueAsWords = (typeof CONTINUE_AS_WORDS)[keyof typeof CONTINUE_AS_WORDS]

/** The visitor's first language from `Accept-Language`: Russian → ru, anything else → en. */
export function continueAsWords(acceptLanguage: string | null): ContinueAsWords {
  const first = (acceptLanguage ?? "").split(",")[0]?.trim().toLowerCase() ?? ""
  return first === "ru" || first.startsWith("ru-") ? CONTINUE_AS_WORDS.ru : CONTINUE_AS_WORDS.en
}

export const fillEmail = (text: string, email: string) => text.replace("{email}", email)
