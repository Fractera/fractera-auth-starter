// THE SEARCH OF READY PARTS KEEPS FINDING THEM IN THIS ELEMENT (node step 725-5). Words only — the build has no vectors. A card edited so
// that the voice control, the one modal or the chat stop being found makes the build red; the negative control keeps «nothing» honest.
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { findParts } from "../lib/parts/parts-find.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
process.env.DATA_SECRET = ""
const CASES = [
  // 733-6: the element is born without tools — the voice and the chat are the core's, found through the node's index in a session.
  ["многострочное текстовое поле", ["ui-textarea"], 1],
  ["modal window", ["app-dialog"], 1],
  ["окно переписки с моделью", ["messenger-shell", "ai-elements"], 2],
  ["шапка сайта", ["project-header"], 2],
  ["faq questions", ["section-faq"], 2],
  ["всплывающая подсказка", ["ui-tooltip"], 1],
]
const bad = []
for (const [q, want, top] of CASES) {
  const ids = (await findParts(ROOT, { query: q })).parts.slice(0, top).map((p) => p.id)
  if (!want.some((w) => ids.includes(w))) bad.push(`«${q}» → ${ids.join(", ") || "nothing"}; expected ${want.join(" or ")} in the first ${top}`)
}
const none = (await findParts(ROOT, { query: "бронирование столика" })).parts
if (none.length) bad.push(`«бронирование столика» must find nothing, found ${none.map((p) => p.id).join(", ")}`)
if (bad.length) {
  for (const b of bad) console.error(`  ✗ ${b}`)
  console.error(`===PARTS_FIND_FAILED=== ${bad.length}`)
  process.exit(1)
}
console.log(`===PARTS_FIND_OK=== ${CASES.length} queries find their part, the negative control finds nothing`)
