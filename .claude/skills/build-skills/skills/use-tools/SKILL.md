---
name: use-tools
description: >
  Builder skill. The ready capabilities in `_tools/` — voice input, image crop, video trim, code view, translations, socials by
  AI, a chat, a draft from free words. Load it before building anything that records, transcribes, crops, trims, chats or calls a
  model, when the person asks for «voice», «dictation», «upload and crop», «a chat on the page», «translate these fields», and
  before copying such code.
---

<!-- PROOF · PROVEN 2026-10-07: loaded for voice in a widget; tool used only inside a dynamic widget · report: development-docs/proofs/2026-10-07-page-skills.md -->

# use-tools

> Informational, not binding: know a better way for the case in front of you — do it your way and say so.

**Process: build** — this skill changes the element as a thing: code, commit, rebuild; confirm with the three lines of `.claude/modes/build.md` («Confirm the request first»).

## The cycle — one command per act (node step 735)

1. **Find** — `parts_find` (or `npm run parts -- <words>`): yours, then the core's, then your neighbours'.
2. **Take** — found elsewhere: `npm run tool:take -- <id> [--from <element>]` (`--dry` first). Already yours: use it.
3. **Change** — extend it in your own file beside it; or `npm run tool:own -- <id> [--as <new id>]`: the copy becomes yours
   (`origin` keeps where it came from, v1.0.0), then edit it — every later change of its body raises its version.
4. **Create** — nothing fits: `npm run tool:new -- <name> "<the task in one sentence>"` bears `_tools/tool-<name>/` with a complete
   card and an empty entry; it refuses when a close tool exists (read it; `--new-anyway` after). Your neighbours find it at once.

## First look — the tool may already exist, here or in the node

This element is born with an empty `_tools/` (node step 733-6): the tools live in the core and in the elements that bore them.
`parts_find` answers in this order — **yours** (this repository), then **the core's** tools any element may take, then **your
neighbours'** on a single-project node — and every answer says where it lives. Found elsewhere: **take a copy, never build it again**
— `npm run tool:take -- <tool id> [--from <element>]` (`--dry` first shows what would come): the core copies the tool and the parts of
its recipe you lack, each with its `source`; you rebuild the maps and commit. A refusal writes nothing and says why (a panel tool, a
requirement you lack, a path you hold with something else). A copy keeps its source's folder name (`_tools/image-crop/`) and its
body is never edited — add your own files beside it; a changed body is a fork with a name of its own. Your map holds it: a copy whose
body moved from its `source.bodyHash` is red (undo the edit, or `npm run tool:own -- <id>`). An unedited copy is judged by its source
(`check:shadcn-parts` leaves its debt to it); a copy made yours is your code — clean it like any file you touch. When `parts_find` says
**a newer version is in the core**, `npm run tool:take -- <id> --update` (after `--dry`) replaces the copy and the parts of its recipe
— only while they are unedited; rebuild the maps, check the pages that use it, commit (node step 733-9).

## What a tool is — decided at its birth (node step 733)

The owner of the node, 2026-11-12:
«Инструмент это то что решает задачу и используют для этого визуальный интерфейс. Один инструмент может быть частью другого»

**A tool solves a task and shows its own interface for it**, and it does not know which page it stands on: its material comes from
outside, its result goes back out — the caller passes the door and takes the result. **Tools nest**: an image-editing form is a modal
window; inside it the crop, the voice input that turns speech into text and the call to the image technology — four tools, and the form
is a tool too. **A combination is kept as a recipe**: its own glue and its parts by id and version, never copies of the parts inside it.

Not a tool: a shadcn primitive (a button solves no task by itself), a section (how a page's content looks), a widget (code of one page —
it reads that page's data and holds tools). A server job without a screen of its own (transcription, a model call) is a part of the tool
whose interface calls it.

**Three questions, in this order, before a new interface piece** — each a yes or a no, no guessing about the future:

1. How a page's content looks (a hero, prices, questions)? → a **section**.
2. Bound to this page — reads its data, knows where it stands? → a **widget** (skill `build-widget`); the tools inside it are taken or
   born as tools, never written into it.
3. A task with its own interface, its material from outside? → a **tool** in `_tools/<id>/`, its card `tool.json` first (the task, the
   interface, its parts), even when one place needs it today. Made of other tools — find each with `parts_find` or bear it first, from
   the inside out.

The node's gate holds it: a new interface file is asked these questions, and a file under `_tools/<id>/` is born only after its card.

## Using a tool

- **Only from inside a widget** — directly, or through another tool it is made of (its recipe `parts`). A page never names `tool-*` in its sequence (`check:page-sequence` refuses it), and sections
  never use tools: a section is static and drawn with no client code, a tool is client code.
- **Words come from the server.** A tool takes its strings as a prop (`strings`), chosen by the server for the page's
  language; it never imports a dictionary into the browser.
- **Its door** is at element level, because every route may use it: `app/api/tools/tool-<name>/route.ts` — checks the
  caller's role, puts the key in, calls the tool's `server/`. A door whose schema belongs to one page (the field list of
  `tool-fact-draft`) is that page's door, inside its branch.

## What a tool is made of

Only shadcn components and typography — no raw control (skill `use-shadcn`) — and every container of it has a `data-block`
(`npm run widgets:ids` covers `_tools/`; skill `use-highlight`).

## Adding a tool

`npm run tool:new -- <name> "<task>"` does steps 1–2 below for you (the folder, a complete card, an empty entry that declares itself,
both maps). By hand, the shape is:

```
_tools/tool-<name>/
├── tool.json    ← id = folder name · entry · version (x.y.z) · parts [{ id, version }] — the tools it is made of · scope «any»
│                  (an element's tool) · needs (browser · https · openai-key · ffmpeg) · npmDeps · en/ru title · what · how · value
├── client/      ← browser half (the entry)
├── server/      ← when it calls a model or a service
└── types/       ← its types and its words
```

1. The folder and the card; its door if any, plus a line in `ALLOWED` of `scripts/check-routes.mjs` and `/api/tools` stays in
   the A2A card's `private`.
2. `npm run build:tools-map` — the map, and with it the passport's `tools`, follow the cards. Never a list by hand.
3. Commit the map with the tool.

## How you know it worked

`npm run check:tools-map` → `===TOOLS_MAP_OK===`; `npm run check:parts-map` holds the recipe against your code (a tool used and
not in `parts`, or named and not used, is red); the passport's `tools` has the new name after a rebuild; `npm run prebuild` passes.
