// npm run tool:new -- <name> "<the task in one sentence>" [--new-anyway] — A NEW TOOL OF THIS ELEMENT, BORN WITH ITS CARD (node step 735 B2).
//
// The owner of the node, 2026-11-12: «Если подходящее инструментов не существуют, то они их создают». Before 735 a tool was born by
// hand and its card was learnt from three refusals of the guards (version, scope, parts). This command asks first — your map, the
// core's tools and your neighbours' (the same search as parts_find) — and refuses a name when a tool close to the task is already
// there (read it; take it with npm run tool:take, or pass --new-anyway). Then it writes `_tools/tool-<name>/` with a complete card
// (`tool.json`: id, entry, version 1.0.0, scope «any», parts [], the task in both languages) and an empty client entry that declares
// itself (`// @part tool-<name>`), and rebuilds both maps. Model-free: you build the interface, translate the card, commit.
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { findParts } from "../lib/parts/parts-find.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const args = process.argv.slice(2)
const anyway = args.includes("--new-anyway")
const [rawName, ...taskWords] = args.filter((a) => !a.startsWith("--"))
const fail = (msg) => { console.log(`===TOOL_NEW_REFUSED=== ${msg}`); process.exit(1) }
const name = String(rawName ?? "").replace(/^tool-/, "")
const task = taskWords.join(" ").trim()
if (!/^[a-z0-9][a-z0-9-]*$/.test(name) || task.length < 10) fail('npm run tool:new -- <name in kebab-case> "<the task in one sentence>" [--new-anyway]')
const id = `tool-${name}`
const dir = join(ROOT, "_tools", id)
if (existsSync(dir)) fail(`_tools/${id} already exists`)

console.log(`Three questions before a new interface piece (skill use-tools):
  1. How a page's content looks (a hero, prices, questions)? → a section, not a tool.
  2. Bound to this page — reads its data, knows where it stands? → a widget (skill build-widget), not a tool.
  3. A task with its own interface, its material from outside? → a tool. You are bearing one: «${task}».`)

// The node's tools — the core's «any» ones and the neighbours' — read by the core's own index, the one the parts_find of a build session
// uses. The core is found the way tool:take finds it (NODE_DOMAIN_FILE); outside a node only your own map is asked, and that is said.
function coreRoot() {
  let file = process.env.NODE_DOMAIN_FILE?.trim()
  if (!file) try { file = (readFileSync(join(ROOT, ".env.local"), "utf8").match(/^NODE_DOMAIN_FILE=(.*)$/m)?.[1] ?? "").trim() } catch { /* no file */ }
  const core = file ? dirname(dirname(file)) : null
  return core && existsSync(join(core, "lib", "parts", "node-index.mjs")) ? core : null
}
const core = coreRoot()
let node = []
if (core) {
  try { node = (await import(pathToFileURL(join(core, "lib", "parts", "node-index.mjs")).href)).nodeTools(core, ROOT) } catch { node = [] }
} else console.log("  (the node's core is not known here — only this element's own map was asked; parts_find in your session asks the node)")
const found = (await findParts(ROOT, { query: `${name.replace(/-/g, " ")} ${task}`, kinds: ["tool"], node })).parts
if (found.length && !anyway) {
  for (const p of found.slice(0, 3)) {
    const where = p.where?.owner === "self" ? "yours — it is in this repository" : `in ${p.where?.owner === "core" ? "the core" : `the element «${p.where?.owner}»`}: npm run tool:take -- ${p.toolId ?? p.id}${p.where?.owner && p.where.owner !== "core" ? ` --from ${p.where.owner}` : ""}`
    console.log(`  · ${p.toolId ?? p.id} v${p.version ?? "?"} — ${p.what?.en ?? ""} (${where})`)
  }
  fail("a tool close to this task already exists (above) — take it, or make a taken copy yours (npm run tool:own); bear a new one only after reading them: --new-anyway")
}

const words = name.replace(/-/g, " ")
const title = words.charAt(0).toUpperCase() + words.slice(1)
const entry = `client/${name}.client.tsx`
const card = {
  id, entry, version: "1.0.0", parts: [], scope: "any", needs: [], npmDeps: [], usedBy: [],
  en: { title, what: task, how: "Born by npm run tool:new — say here how a widget uses it (its props, its result) once it is built.", value: task },
  ru: { title, what: task, how: "Рождён командой npm run tool:new — напишите здесь, как виджет им пользуется (свойства, результат), когда он построен.", value: task },
  words: { en: [words, task], ru: [words, task] },
}
const pascal = name.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("")
mkdirSync(join(dir, "client"), { recursive: true })
writeFileSync(join(dir, "tool.json"), JSON.stringify(card, null, 2) + "\n")
writeFileSync(join(dir, entry), `"use client"
// @part ${id} — ${task.replace(/\n/g, " ")}
// Born by \`npm run tool:new\` (node step 735): its interface is yours to build — shadcn components and typography only, every container
// with its data-block, its words as a prop from the server (skill use-tools). Its card: ../tool.json — the task, the recipe, the version.

export default function ${/^[A-Z]/.test(pascal) ? pascal : `Tool${pascal}`}(): null {
  return null
}
`)
for (const s of ["build-tools-map.mjs", "build-parts-map.mjs"]) {
  try { execFileSync(process.execPath, [join(ROOT, "scripts", s)], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] }) } catch (e) {
    console.log(String(e.stdout || "") + String(e.stderr || ""))
    fail(`${s} did not pass after the birth — read it above; the folder _tools/${id} stays for you to fix`)
  }
}
console.log(`===TOOL_NEW_OK=== _tools/${id}/ — card tool.json (v1.0.0, scope any, parts []) and the empty entry ${entry}; maps rebuilt`)
console.log("Next: build its interface; its door if it calls a server (skill use-tools); write the card's en and ru texts in their languages; commit.")
