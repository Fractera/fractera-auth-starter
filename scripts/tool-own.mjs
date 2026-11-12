// npm run tool:own -- <tool id> [--as <new id>] — A TAKEN COPY BECOMES THIS ELEMENT'S OWN TOOL (node step 735 B2).
//
// The owner of the node, 2026-11-12: «Иногда когда приходит задача они получают инструменты и других элементов. А потом иногда они их
// улучшают под себя». A copy taken with `npm run tool:take` is never edited (its body is its source's — 733-9); to change it, it becomes
// yours: `source` leaves its card, `origin` { from, id, version } stays as its lineage, its version starts at 1.0.0, the recipes of
// this element that hold it move to it, and both maps are rebuilt. After it the body is yours to edit — every later change raises its
// version (the map holds it), its look is judged by this element's guards like any of your code, and `tool:take --update` no longer
// touches it. Model-free; you commit what it changed.
// `--as <new id>`: a new name. A tool of `_tools/` moves to `_tools/<new id>/` (the name starts with `tool-`) and the imports of your
// own files follow it — refused while an unedited taken copy imports it (that copy's body cannot change; make it yours first). A
// component tool changes the id of its card; its files stay where they are.
import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname, join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const args = process.argv.slice(2)
const ai = args.indexOf("--as")
const as = ai >= 0 ? args[ai + 1] : undefined
const id = args.filter((a, i) => !a.startsWith("--") && (ai < 0 || i !== ai + 1))[0]
const fail = (msg) => { console.log(`===TOOL_OWN_REFUSED=== ${msg}`); process.exit(1) }
if (!id) fail("npm run tool:own -- <tool id from your map> [--as <new id>]")
if (as !== undefined && !/^[a-z0-9][a-z0-9-]*$/.test(as ?? "")) fail(`--as «${as}»: a new id is kebab-case`)

const readJson = (f) => JSON.parse(readFileSync(f, "utf8").replace(/\r\n/g, "\n"))
const mapFile = join(ROOT, "lib", "parts", "PARTS.json")
if (!existsSync(mapFile)) fail("no parts map here (lib/parts/PARTS.json) — npm run build:tools-map && npm run build:parts-map")
const map = readJson(mapFile)
const part = (map.parts ?? []).find((p) => p.kind === "tool" && p.id === id)
if (!part) fail(`no tool «${id}» in your map — the id is the one npm run parts or parts_find names (rebuild the maps after a take)`)
if (!part.source) fail(`«${id}» is already this element's own tool (no source) — edit it and raise its version`)
const newId = as ?? id
if (as && (map.parts ?? []).some((p) => p.id === as)) fail(`«${as}» is already taken by another part of this element`)

// Every card file of this element: the tools' tool.json and the composites' parts.json.
const cardFiles = []
const walk = (d) => { if (!existsSync(d)) return; for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name === "parts.json") cardFiles.push(p) } }
walk(join(ROOT, "components"))
if (existsSync(join(ROOT, "_tools"))) for (const e of readdirSync(join(ROOT, "_tools"), { withFileTypes: true })) if (e.isDirectory() && existsSync(join(ROOT, "_tools", e.name, "tool.json"))) cardFiles.push(join(ROOT, "_tools", e.name, "tool.json"))
const rel = (f) => relative(ROOT, f).split(sep).join("/")
const changed = new Set()
const origin = { from: part.source.from, id: part.source.tool, version: part.source.version }

if (part.dir) {
  // A tool of `_tools/<dir>/`: its card is tool.json, its id is the folder's name.
  let dir = part.dir
  if (as) {
    if (!/^tool-[a-z0-9][a-z0-9-]*$/.test(as)) fail(`--as «${as}»: a tool folder of this element is named tool-<name>`)
    if (existsSync(join(ROOT, "_tools", as))) fail(`_tools/${as} already exists`)
    const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter((f) => /\.(tsx?|jsx?|mjs|cjs)$/.test(f) && !f.startsWith(`${dir}/`) && existsSync(join(ROOT, f)))
    const users = files.filter((f) => readFileSync(join(ROOT, f), "utf8").includes(`@/${dir}/`))
    const lockedCopies = (map.parts ?? []).filter((p) => p.source && p.id !== id && Array.isArray(p.body) && p.body.some((f) => users.includes(f)))
    if (lockedCopies.length) fail(`${lockedCopies.map((p) => `«${p.id}»`).join(", ")} — a taken copy imports ${dir}/ and its body cannot change; npm run tool:own -- ${lockedCopies[0].id} first, or keep the name`)
    renameSync(join(ROOT, dir), join(ROOT, "_tools", as))
    for (const f of users) { writeFileSync(join(ROOT, f), readFileSync(join(ROOT, f), "utf8").split(`@/${dir}/`).join(`@/_tools/${as}/`)); changed.add(f) }
    changed.add(`${dir}/ → _tools/${as}/`)
    dir = `_tools/${as}`
  }
  const file = join(ROOT, dir, "tool.json")
  const card = readJson(file)
  delete card.source
  if (as) card.id = as
  card.version = "1.0.0"
  card.origin = origin
  writeFileSync(file, JSON.stringify(card, null, 2) + "\n")
  changed.add(rel(file))
} else {
  // A component tool: its card lives in its folder's parts.json.
  const file = cardFiles.find((f) => f.endsWith("parts.json") && (readJson(f).parts ?? []).some((p) => p.id === id))
  if (!file) fail(`the card of «${id}» was not found in components/**/parts.json — rebuild the maps`)
  const data = readJson(file)
  data.parts = (data.parts ?? []).map((p) => {
    if (p.id !== id) return p
    const { source, ...rest } = p
    return { ...rest, id: newId, version: "1.0.0", origin }
  })
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n")
  changed.add(rel(file))
}

// The recipes of this element that hold the copy move to the own tool (a recipe is a card field, never a body file).
for (const f of cardFiles) {
  if (!existsSync(f)) continue
  const t = readFileSync(f, "utf8")
  const re = new RegExp(`("id":\\s*")${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(",\\s*"version":\\s*")[^"]+(")`, "g")
  const u = t.replace(re, (_, a, b, c) => `${a}${newId}${b}1.0.0${c}`)
  if (u !== t) { writeFileSync(f, u); changed.add(rel(f)) }
}

// The map forgets the copy's fingerprint (a new own tool starts its history here), then both maps are built again.
map.parts = (map.parts ?? []).filter((p) => p.id !== id)
writeFileSync(mapFile, JSON.stringify(map, null, 2) + "\n")
for (const s of ["build-tools-map.mjs", "build-parts-map.mjs"]) {
  try { execFileSync(process.execPath, [join(ROOT, "scripts", s)], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] }) } catch (e) {
    console.log(String(e.stdout || "") + String(e.stderr || ""))
    fail(`${s} did not pass after the change — read it above; nothing else was undone`)
  }
}
changed.add("_tools/TOOLS.json")
changed.add("lib/parts/PARTS.json")
console.log(`===TOOL_OWN_OK=== «${newId}» v1.0.0 is this element's own tool (from ${origin.from} «${origin.id}» v${origin.version})`)
console.log(`  changed: ${[...changed].join(", ")}`)
// It is this element's code now: its look is judged like any of yours (the owner's law of the touched file, 730-1) — said at once.
if (existsSync(join(ROOT, "scripts", "check-shadcn-parts.mjs"))) {
  try { execFileSync(process.execPath, [join(ROOT, "scripts", "check-shadcn-parts.mjs")], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] }) } catch (e) {
    const n = (String(e.stderr || "").match(/✗/g) ?? []).length
    console.log(`  ⚠ check:shadcn-parts judges it as your code now: ${n} finding(s) — move its raw controls onto shadcn (skill use-shadcn) before your build`)
  }
}
console.log("Next: edit it freely — every later change of its body raises its version; it is judged by your guards now (shadcn, words); commit.")
