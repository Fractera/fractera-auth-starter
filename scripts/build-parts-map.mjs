// GENERATE THE PARTS MAP `lib/parts/PARTS.json` (node step 725-1) — tools, sections, composites and primitives in one map, `usedBy`
// measured from the imports. A command, not a build step: the build only checks freshness (`check-parts-map.mjs`). Why — `lib/parts/parts-map.mjs`.
import { writeFileSync } from "node:fs"
import { collect, render, TARGET } from "../lib/parts/parts-map.mjs"

const { parts, problems } = collect()
for (const p of problems) console.error(`  ✗ ${p}`)
writeFileSync(TARGET, render(parts))
const counts = {}
for (const p of parts) counts[p.kind] = (counts[p.kind] ?? 0) + 1
console.log(`${problems.length ? "===PARTS_MAP_WRITTEN_WITH_PROBLEMS===" : "===PARTS_MAP_WRITTEN==="} ${Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(", ")}`)
process.exit(problems.length ? 1 : 0)
