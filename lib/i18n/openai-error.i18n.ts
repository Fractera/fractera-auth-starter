import words from "./openai-error.i18n.json"

// THE PERSON'S WORDS FOR EVERY REFUSAL OF OPENAI (step 726-0) — one dictionary for every screen of the node: the voice field, the
// translations dialog, the fact draft, the social links. The reasons are read by ONE reader, `lib/openai-error.cjs`, from OpenAI's
// own error-codes guide; a screen never names a reason of its own, so the same refusal reads the same everywhere.
//
// The reader speaks in kebab-case reasons (`no-funds`); the dictionary's keys are their camelCase (`noFunds`) because the guard
// `check:i18n` reads identifiers. Two languages, like every dictionary of the core since step 255; a third arrives through
// `npm run i18n:export openai-error` / `i18n:import`, never written by an agent.

export type OpenAiReason =
  | "no-key" | "bad-key" | "ip-blocked" | "region" | "no-funds" | "spend-limit" | "usage-limit" | "rate-limit"
  | "overloaded" | "server" | "not-found" | "forbidden" | "bad-request" | "unreachable" | "timeout" | "upstream"

export type OpenAiErrorUi = {
  noKey: string
  badKey: string
  ipBlocked: string
  region: string
  noFunds: string
  spendLimit: string
  usageLimit: string
  rateLimit: string
  overloaded: string
  server: string
  notFound: string
  forbidden: string
  badRequest: string
  unreachable: string
  timeout: string
  upstream: string
  /** The label of the link to OpenAI's own page where the person acts (billing, limits, keys). */
  open: string
}

const UI = words as Record<string, Partial<OpenAiErrorUi>>

const keyOf = (reason: string) => reason.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()) as keyof OpenAiErrorUi

/** Words on the page's language, falling back to English key by key. */
export function openAiErrorUi(lang: string): OpenAiErrorUi {
  const en = UI.en as OpenAiErrorUi
  const own = UI[lang] ?? UI[lang.slice(0, 2)] ?? {}
  return { ...en, ...own }
}

/** The sentence for one reason; an unknown reason reads as `upstream`, never as nothing. */
export function openAiErrorWords(lang: string, reason: string | null | undefined): string {
  const ui = openAiErrorUi(lang)
  const key = keyOf(reason ?? "")
  return key !== "open" && typeof ui[key] === "string" ? ui[key] : ui.upstream
}

export function isOpenAiReason(reason: unknown): reason is OpenAiReason {
  return typeof reason === "string" && keyOf(reason) !== "open" && keyOf(reason) in (UI.en as object)
}

/**
 * What a door puts into its refusal for the screen — chosen on the SERVER (`check:lang-delivery`: a client never imports a
 * dictionary, it would carry every language to the browser): the sentence, OpenAI's page to act on and its label.
 */
export function openAiRefusal(lang: string, reason: string, link: string | null | undefined) {
  return { words: openAiErrorWords(lang, reason), link: link ?? null, linkLabel: link ? openAiErrorUi(lang).open : null }
}
