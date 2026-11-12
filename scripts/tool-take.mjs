// TAKE A TOOL FROM THE CORE OR A NEIGHBOUR (node step 733-5). `npm run tool:take -- <tool id> [--from <element>] [--dry] [--update]`.
// 733-9-2: `--update` replaces an older copy with its source's newer version — only while the copy is still its source's body (an
// edited copy is a fork: refused, nothing written). `parts_find` names the command when the source is newer.
//
// The owner of the node, 2026-11-12: «Да, рецепт со ссылками» — a tool is kept once; this element takes a COPY of it, with the parts of
// its recipe it lacks, each with its provenance (`source` in its card), and never builds again what the node already has. The tool id
// comes from `parts_find` (its answer names the command). The core does the copy, without a model; this element's agent commits it.
// 🔒 THE ELEMENT'S OWN KEY (`ELEMENT_KEY`, written by the installer) names the receiver: the core writes only into this folder.
// 🔒 A REFUSAL WRITES NOTHING: a panel tool, a requirement this element lacks, a path it already holds with something else — the reason is
// printed; decide first, then take again. Tools never come from another node.
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"

const root = process.cwd()
function envFile() {
  const out = {}
  try {
    for (const line of readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (m) out[m[1]] = m[2].trim()
    }
  } catch { /* no file — the process environment only */ }
  return out
}
const env = { ...envFile(), ...process.env }

function coreUrl() {
  const domainFile = env.NODE_DOMAIN_FILE?.trim()
  if (domainFile) {
    try {
      const rt = JSON.parse(readFileSync(join(dirname(dirname(domainFile)), "logs", "runtime.json"), "utf8"))
      if (Number.isInteger(rt.port)) return `http://${typeof rt.hostname === "string" && rt.hostname ? rt.hostname : "localhost"}:${rt.port}`
    } catch { /* the node did not say its port */ }
  }
  const a = env.ARCHITECT_URL?.trim()
  return a && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(a) ? a.replace(/\/+$/, "") : null
}

const args = process.argv.slice(2)
const fi = args.indexOf("--from")
const from = fi >= 0 ? args[fi + 1] : undefined
const dry = args.includes("--dry")
const update = args.includes("--update")
// 735 (D12): with no --from, `fi + 1` was 0 and the tool id itself was dropped — `npm run tool:take -- <id>` never worked.
const tool = args.filter((a, i) => !a.startsWith("--") && (fi < 0 || i !== fi + 1))[0]
if (!tool) { console.error("npm run tool:take -- <tool id from parts_find> [--from <element>] [--dry] [--update]"); process.exit(1) }
const key = env.ELEMENT_KEY?.trim()
const core = coreUrl()
if (!key) { console.error("TAKE_FAILED: no ELEMENT_KEY here — the node installer writes it; without it the core cannot know who asks"); process.exit(1) }
if (!core) { console.error("TAKE_FAILED: the node core address is unknown here (NODE_DOMAIN_FILE → logs/runtime.json)"); process.exit(1) }

let r
try {
  r = await fetch(`${core}/api/node/tools/take`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Element-Key": key },
    body: JSON.stringify({ tool, ...(from ? { from } : {}), dry, ...(update ? { update: true } : {}) }),
    signal: AbortSignal.timeout(30000),
  })
} catch (e) {
  console.error(`TAKE_FAILED: the core did not answer (${e instanceof Error ? e.message : e})`)
  process.exit(1)
}
const b = await r.json().catch(() => ({}))
for (const s of b.skipped ?? []) console.log(`  · ${s}`)
for (const c of b.copies ?? []) console.log(`  + ${c.id} v${c.version}${c.replaces ? ` (was v${c.replaces})` : ""}`)
for (const f of b.refused ?? []) console.log(`  ✗ ${f}`)
if (!b.ok) { console.log(`===TAKE_REFUSED=== ${b.error ?? "nothing was written"}`); process.exit(1) }
if (dry) { console.log("===TAKE_DRY=== nothing written; run again without --dry"); process.exit(0) }
console.log(`===TAKE_OK=== written: ${(b.written ?? []).join(", ")}`)
console.log("Next: npm run build:tools-map && npm run build:parts-map, then commit these files — the copy's body is not edited (733-9).")
