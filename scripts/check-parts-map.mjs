// GUARD OF THE PARTS MAP (node step 725-1). Three different troubles, named by their words: a shared component nobody carded (a part an
// agent cannot find — the defect of 722-4), a card that lies (a missing file, a short text, a card outside its folder), a stale map
// (`npm run build:parts-map`). Why the map exists — `lib/parts/parts-map.mjs`.
import { existsSync, readFileSync } from "node:fs"
import { collect, render, TARGET } from "../lib/parts/parts-map.mjs"

const { parts, problems } = collect()
const bad = [...problems]
if (!existsSync(TARGET)) bad.push("lib/parts/PARTS.json is missing — npm run build:parts-map")
else if (!problems.length && readFileSync(TARGET, "utf8").replace(/\r\n/g, "\n") !== render(parts))
  bad.push("lib/parts/PARTS.json is stale — npm run build:parts-map, then commit it")
if (bad.length) {
  for (const b of bad) console.error(`  ✗ ${b}`)
  console.error(`===PARTS_MAP_FAILED=== ${bad.length}`)
  process.exit(1)
}
const counts = {}
for (const p of parts) counts[p.kind] = (counts[p.kind] ?? 0) + 1
console.log(`===PARTS_MAP_OK=== ${Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(", ")}`)
