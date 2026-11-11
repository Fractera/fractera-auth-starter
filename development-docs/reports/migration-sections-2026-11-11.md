# Migration «block → section» — 2026-11-11

Node step 717-2: one word, «section», for a designed part of a page; a section is one folder `components/sections/<kind>/`; a page's
list is `body`. «Block» keeps one meaning — the address of a container (`data-block`, `#block=`, `npm run blocks:ids`).
Script `scripts/migrate-sections.mjs`, map `scripts/migrate-sections.map.json`.

## Done (9)

- rewritten `.claude/skills/README.md`
- rewritten `app/[lang]/(publicLayer)/_data/en.json`
- rewritten `app/[lang]/(publicLayer)/_data/ru.json`
- rewritten `app/[lang]/(publicLayer)/_widgets/static/widget-static-auth-landing/README.md`
- `app/[lang]/(publicLayer)/_widgets/static/widget-static-auth-landing/index.tsx`: «blocks» → «body» 9× — the page's list; read the file if one of them meant something else
- rewritten `app/[lang]/(publicLayer)/_widgets/static/widget-static-auth-landing/markdown.ts`
- `app/[lang]/(publicLayer)/_widgets/static/widget-static-auth-landing/words.ts`: «blocks» → «body» 5× — the page's list; read the file if one of them meant something else
- rewritten `lib/content/blocks/types.ts`
- rewritten `scripts/check-shadcn-rules.mjs`

## For your eye (53)

Each line: change the sense «section» to «section» (in Russian «секция»), keep the address; a line that is right as it is stays.

- `lib/content/page-items.ts` — both lib/content/blocks/types.ts and lib/content/page-items.ts exist — merge by hand: «lib/content/page-items.ts»
- `lib/content/blocks/types.ts` — a file still lives in an old folder — move it where it belongs (a section → components/sections/<kind>/): «lib/content/blocks/types.ts»
- `.claude/skills/README.md:16` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «| 'use-page-tree' | ours, 'build-skills' | pages as data folders; a page is one sequence of section-* · text-* · widget-*; blocks from the registry | ✅ 2026-10-07 |»
- `.claude/skills/build-skills/skills/use-element-tree/tree-manifest.json:65` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «"app/[lang]/(protectedLayer)/admin/_components/element-blocks-pages.tsx",»
- `.claude/skills/build-skills/skills/use-element-tree/tree-manifest.json:70` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «"app/[lang]/(protectedLayer)/admin/_libs/element-blocks.ts",»
- `.claude/skills/build-skills/skills/use-element-tree/tree-manifest.json:75` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «"app/[lang]/(protectedLayer)/admin/_pages/blocks/README.md",»
- `.claude/skills/build-skills/skills/use-element-tree/tree-manifest.json:76` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «"app/[lang]/(protectedLayer)/admin/_pages/blocks/benefits/README.md",»
- `.claude/skills/build-skills/skills/use-element-tree/tree-manifest.json:77` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «"app/[lang]/(protectedLayer)/admin/_pages/blocks/charts/README.md",»
- `.claude/skills/build-skills/skills/use-element-tree/tree-manifest.json:78` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «"app/[lang]/(protectedLayer)/admin/_pages/blocks/comparison/README.md",»
- `.claude/skills/build-skills/skills/use-element-tree/tree-manifest.json:79` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «"app/[lang]/(protectedLayer)/admin/_pages/blocks/dialogs/README.md",»
- `.claude/skills/build-skills/skills/use-element-tree/tree-manifest.json:80` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «"app/[lang]/(protectedLayer)/admin/_pages/blocks/en.json",»
- `.claude/skills/build-skills/skills/use-element-tree/tree-manifest.json:81` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «"app/[lang]/(protectedLayer)/admin/_pages/blocks/hero/README.md",»
- `.claude/skills/build-skills/skills/use-element-tree/tree-manifest.json:82` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «"app/[lang]/(protectedLayer)/admin/_pages/blocks/how-it-works/README.md",»
- `.claude/skills/build-skills/skills/use-element-tree/tree-manifest.json:83` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «"app/[lang]/(protectedLayer)/admin/_pages/blocks/meta.json",»
- `.claude/skills/build-skills/skills/use-element-tree/tree-manifest.json:84` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «"app/[lang]/(protectedLayer)/admin/_pages/blocks/page-material/README.md",»
- `.claude/skills/build-skills/skills/use-element-tree/tree-manifest.json:85` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «"app/[lang]/(protectedLayer)/admin/_pages/blocks/pricing/README.md",»
- `.claude/skills/build-skills/skills/use-element-tree/tree-manifest.json:86` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «"app/[lang]/(protectedLayer)/admin/_pages/blocks/product-demo/README.md",»
- `.claude/skills/build-skills/skills/use-element-tree/tree-manifest.json:87` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «"app/[lang]/(protectedLayer)/admin/_pages/blocks/ru.json",»
- `.claude/skills/build-skills/skills/use-element-tree/tree-manifest.json:88` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «"app/[lang]/(protectedLayer)/admin/_pages/blocks/showcase/README.md",»
- `.claude/skills/build-skills/skills/use-element-tree/tree-manifest.json:89` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «"app/[lang]/(protectedLayer)/admin/_pages/blocks/testimonials/README.md",»
- `.claude/skills/build-skills/skills/use-element-tree/tree-manifest.json:90` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «"app/[lang]/(protectedLayer)/admin/_pages/blocks/trust/README.md",»
- `.claude/skills/build-skills/skills/use-element-tree/tree-manifest.json:91` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «"app/[lang]/(protectedLayer)/admin/_pages/blocks/use-cases/README.md",»
- `.claude/skills/build-skills/skills/use-element-tree/tree-manifest.json:92` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «"app/[lang]/(protectedLayer)/admin/_pages/blocks/workspace/README.md",»
- `.claude/skills/build-skills/skills/use-element-tree/tree-manifest.json:131` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «"app/[lang]/(protectedLayer)/admin/_widgets/static/widget-static-element-blocks/index.tsx",»
- `.claude/skills/build-skills/skills/use-element-tree/tree-manifest.json:132` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «"app/[lang]/(protectedLayer)/admin/_widgets/static/widget-static-element-blocks/pager.client.tsx",»
- `.claude/skills/build-skills/skills/use-element-tree/tree-manifest.json:133` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «"app/[lang]/(protectedLayer)/admin/_widgets/static/widget-static-element-blocks/table.client.tsx",»
- `.claude/skills/build-skills/skills/use-element-tree/tree-manifest.json:134` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «"app/[lang]/(protectedLayer)/admin/_widgets/static/widget-static-element-blocks/ui.i18n.ts",»
- `.claude/skills/build-skills/skills/use-element-tree/tree-manifest.json:136` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «"app/[lang]/(protectedLayer)/admin/blocks/[section]/[name]/page.tsx",»
- `.claude/skills/build-skills/skills/use-element-tree/tree-manifest.json:137` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «"app/[lang]/(protectedLayer)/admin/blocks/[section]/page.tsx",»
- `.claude/skills/build-skills/skills/use-element-tree/tree-manifest.json:280` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «"scripts/blocks.mjs"»
- `.claude/skills/build-skills/skills/use-element-tree/tree-manifest.json:287` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «"components/blocks",»
- `.claude/skills/build-skills/skills/use-element-tree/tree-manifest.json:312` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «"lib/blocks",»
- `.claude/skills/build-skills/skills/use-element-tree/tree-manifest.json:315` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «"lib/content/blocks",»
- `NODE-CONTRACT.json:8` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «"note": "A wish, not a decision. The node assigns the actual port from the block 24680-25679. Ask the node, never remember."»
- `README.md:41` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «| '/en', '/ru' | the public home page of the element (catalog blocks, 'app/[lang]/(publicLayer)/_data') |»
- `app/[lang]/(publicLayer)/_widgets/static/widget-static-auth-landing/README.md:4` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «'bare', this widget draws it from the page data blocks, a section is 'section-head' and the blocks up to the next, its view chosen»
- `app/[lang]/(publicLayer)/_widgets/static/widget-static-auth-landing/README.md:6` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «other 'id' — the general view). Words only in the data (en, ru, 'humanizer'); the machine copy comes from the items, 'markdown.ts'»
- `app/[lang]/(publicLayer)/_widgets/static/widget-static-auth-landing/index.tsx:16` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «// объектного хранилища (650-4) под своим именем: страница рисует себя из своих частей данных ('words.ts'); раздел —»
- `app/[lang]/(publicLayer)/_widgets/static/widget-static-auth-landing/index.tsx:17` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «// 'section-head' и блоки до следующего, вид раздела выбирается по его 'id', незнакомый 'id' — общим видом. Вид — токены»
- `app/[lang]/(publicLayer)/_widgets/static/widget-static-auth-landing/index.tsx:264` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «{/* 662-2: a section of only questions and answers — the section draws its own heading. */}»
- `app/[lang]/(publicLayer)/_widgets/static/widget-static-auth-landing/index.tsx:269` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «// 662-2: a section of the set (questions and answers, cards) is drawn by the set, as on the graph's landing.»
- `app/[lang]/(publicLayer)/_widgets/static/widget-static-auth-landing/index.tsx:306` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «/** Вопросы и ответы: две колонки на всю ширину; разметка FAQPage для поисковиков — как у секции набора. */»
- `app/[lang]/(publicLayer)/_widgets/static/widget-static-auth-landing/markdown.ts:1` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «// Текст виджета для машин. Своих слов у виджета нет: всё, что он рисует, — части данных главной, а они уже идут в markdown-копию»
- `app/[lang]/(publicLayer)/_widgets/static/widget-static-auth-landing/words.ts:4` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «// Слова лендинга элемента (служба входа узла) — части главной ('(publicLayer)/_data/<язык>.json'). Страница 'bare' (шаг 423): её части рисует этот виджет,»
- `app/[lang]/(publicLayer)/_widgets/static/widget-static-auth-landing/words.ts:15` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «/** Первый экран и разделы: раздел — 'section-head' и блоки до следующего; виджеты последовательности пропускаются. */»
- `app/api/admin/users/[id]/route.ts:28` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «//   1. A user can NEVER remove the architect role from themselves — we block»
- `app/api/admin/users/[id]/route.ts:31` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «//      the self-block below guarantees it's a different account.»
- `app/api/app-users/README.md:20` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «| 'POST /api/app-users/batch { action, ids[], value? }' | 'update', 'block', 'unblock', 'addRole', 'removeRole', 'marketing', 'tracking', 'anonymize' |»
- `app/api/node-users/README.md:16` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «| 'POST /api/node-users/batch { action, ids[], value? }' | 'update' (one person, a patch), 'block', 'unblock', 'addRole', 'removeRole', 'addOrg', 'removeOrg', 'marketing', 'tracking', 'anonymize' |»
- `app/api/node-users/README.md:30` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «installed build (registration through the real form action, sign-in events, block), the live door (401 without the key, 404 through»
- `lib/content/blocks/types.ts:11` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «* Постоянный адрес блока (317-1): буква + 4 знака base36, один на всех языках. По нему подсветка в Preview называет блок,»
- `lib/content/blocks/types.ts:20` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «// 423: типографика элемента ('lib/content/text-set.tsx') — третий вид рядом с блоками и виджетами.»
- `lib/content/blocks/types.ts:31` — «block» left — the sense «section» becomes «section»; the address (`data-block`) stays: «/** Вопрос и ответ раздела FAQ — рисует блок 'faq' из "Блоков", он же ставит разметку 'FAQPage'. */»

## Then

`npm run prebuild`, `npx tsc --noEmit`, the build, `npm run eyes` on a page with sections, one commit.
