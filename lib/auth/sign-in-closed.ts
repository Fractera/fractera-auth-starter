// SIGN-IN IS NOT SWITCHED ON YET — SAID, NEVER SENT TO A LOOPBACK ADDRESS (node step 739-2). ✗ 2026-11-14, aifa.dev on its server: the
// domain's names answered before the domain was switched on, this element's `NEXTAUTH_URL` was still the machine's loopback, and Auth.js
// sent the visitor to «http://127.0.0.1:24681/api/auth/error» — the visitor's OWN computer. The owner: «можешь её запланировать как
// отдельный шаг». While `NEXTAUTH_URL` names a loopback address (or nothing), a request that came by a public name gets one honest page
// (503) — the switch-on (`applyDomainToAuth` in the core) gives this element its public address, and the page is gone by itself.
// Edge-safe: no Node modules, the proxy calls it before anything else.

const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "[::1]"])
const hostOf = (s: string) => s.split(",")[0].trim().replace(/:\d+$/, "").toLowerCase()

/** Is sign-in closed for this request: it came by a public name while this element still lives on loopback? */
export function signInClosedFor(requestHost: string, nextauthUrl: string | undefined): boolean {
  const host = hostOf(requestHost)
  if (!host || LOOPBACK.has(host) || host.startsWith("127.")) return false
  let base = ""
  try { base = nextauthUrl ? new URL(nextauthUrl).hostname.toLowerCase() : "" } catch { base = "" }
  return !base || LOOPBACK.has(base) || base.startsWith("127.")
}

const WORDS = {
  ru: { title: "Вход ещё не включён", text: "Домен этого узла пока не включён: вход заработает здесь, когда архитектор включит домен на последнем шаге «Активации выделенного сервера» или на вкладке «Активация домена»." },
  en: { title: "Sign-in is not switched on yet", text: "This node's domain is not switched on yet: sign-in works here once the architect switches the domain on, on the last step of «Dedicated server activation» or the tab «Activate domain»." },
}

export function signInClosedPage(acceptLanguage: string | null): string {
  const w = /^ru\b|,\s*ru\b/i.test(acceptLanguage ?? "") ? WORDS.ru : WORDS.en
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${w.title}</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:560px;margin:15vh auto;padding:0 20px;color:#111;background:#fff}@media (prefers-color-scheme:dark){body{color:#eee;background:#111}}</style></head>
<body data-block="sign-in-closed"><h1 style="font-size:22px">${w.title}</h1><p>${w.text}</p></body></html>`
}
