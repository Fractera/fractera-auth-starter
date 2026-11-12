// THE SECOND COPY STOPS THE BUILD (node step 725-7). The owner, 2026-11-11: «гораздо важнее иметь технологию для того чтобы из того
// процесса в котором ты находишься в процессе строительства понять что именно сейчас ты создаёшь инструмент этот инструмент который будет
// нужен тебе в будущем». ✗ 722-8: the row «state dot + element name» was written by hand three times in one step and extracted only after
// the owner's verdict — search would not have caught it, there was nothing to find yet.
// 🔒 The tell («the same long className sprayed everywhere — that is a missing component», the craft of interface design): one long class string
// (MIN classes or more, order and repeats ignored) in .tsx files of two or more folders → red at the SECOND copy, naming both files and
// asking for one part (`// @part <id>` + its card in the folder's parts.json) — model-free, no guessing.
// 🔒 The copies that already exist are a frozen debt (`lib/parts/dup-debt.json`, `--freeze` writes it) listed for the sweep 725-6; a
// frozen group that gains another file is red too. Not counted: shadcn sources (components/ui, ai-elements) and the agent-kit copies
// (`_agent-kit/`, byte copies of one master held by check:agent-kits).
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const DEBT = join(ROOT, "lib", "parts", "dup-debt.json")
export const MIN = 8

export function duplicates() {
  const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "components", "app", "_tools", "sections"], { cwd: ROOT, encoding: "utf8" })
    .split("\n").filter((f) => f.endsWith(".tsx") && existsSync(join(ROOT, f)) && !/^components\/(ui|ai-elements)\//.test(f) && !/\/_agent-kit\//.test(f))
  const groups = new Map()
  for (const f of files) {
    const src = readFileSync(join(ROOT, f), "utf8")
    for (const m of src.matchAll(/className=(?:"([^"]+)"|\{`([^`$]+)`\}|\{cn\(\s*"([^"]+)")/g)) {
      const toks = (m[1] ?? m[2] ?? m[3]).trim().split(/\s+/).filter(Boolean)
      if (toks.length < MIN) continue
      const key = [...new Set(toks)].sort().join(" ")
      if (!groups.has(key)) groups.set(key, new Set())
      groups.get(key).add(f)
    }
  }
  const out = {}
  for (const [key, set] of [...groups].sort((a, b) => a[0].localeCompare(b[0])))
    if (new Set([...set].map((f) => dirname(f))).size >= 2) out[key] = [...set].sort()
  return out
}

const found = duplicates()
if (process.argv.includes("--freeze")) {
  writeFileSync(DEBT, JSON.stringify({ _: "Frozen second copies of long class strings (725-7); the sweep 725-6 extracts them. Written by node scripts/check-parts-dup.mjs --freeze.", groups: found }, null, 2) + "\n")
  console.log(`===PARTS_DUP_FROZEN=== ${Object.keys(found).length} groups`)
  process.exit(0)
}
const debt = existsSync(DEBT) ? JSON.parse(readFileSync(DEBT, "utf8")).groups ?? {} : {}
const bad = []
for (const [key, files] of Object.entries(found)) {
  const known = new Set(debt[key] ?? [])
  const fresh = files.filter((f) => !known.has(f))
  if (fresh.length) bad.push(`the same classes «${key.slice(0, 80)}${key.length > 80 ? "…" : ""}» in ${files.join(" and ")} — ` +
    `a second copy is a part being born: extract it once (// @part <id> on its first line + its card in parts.json) and import it from both`)
}
if (bad.length) {
  for (const b of bad) console.error(`  ✗ ${b}`)
  console.error(`===PARTS_DUP_FAILED=== ${bad.length}`)
  process.exit(1)
}
console.log(`===PARTS_DUP_OK=== no new second copy (frozen debt: ${Object.keys(debt).length} groups for 725-6)`)
