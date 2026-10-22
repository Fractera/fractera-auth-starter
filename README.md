# Fractera Auth — the service that hands out entry

The node's sign-in service: sign-in, sessions and roles for one Fractera node, and nothing else. Every element of the node asks it
who came; no other element signs people in. Since **v2.0.0** (node step 549-5) it is built on the Fractera native element template;
its doors, forms and storage did not change (the forms were moved byte for byte — the proven sign-in canon is not improved in passing).

**Two services handing out entry on one machine equal no authentication at all.** There is exactly one of these per node.

## In the Fractera project

The node's only sign-in service. Every element and the core ask it who came and with which roles, and the tab Users of this element in the core shows and changes every account of the node. Without it nobody signs in anywhere on the node.

You can change it. The code is open under the MIT license and the copy on your node is yours. The node installs this element from
this repository by the tag written in `WEB4-ITEMS-REGISTRY/web4-items.json` of the core; the core does not let you delete a built-in
element or move its address.

To change it, open it in the core (left menu, Native items, Authorization), go to Build and tell its agent in the terminal what you need.
The agent edits the element folder `WEB4-ITEMS/core/auth` and commits. The sign-in forms, the adapter and the registration are a proven canon: change them on purpose only, and prove the change on a copy of the database first. A person is deleted only by anonymization.

The change goes live when you press Deploy in Build, Deployments: the element is rebuilt beside the running one and switched over in
seconds. Other elements call its doors by address, request and answer, so a change to a door breaks every element that uses it;
that is a decision for the node owner, while a change inside the element is ordinary work. To keep your version when the node is
reinstalled, save the element to your own GitHub repository in Build, GitHub. A newer Fractera version arrives through Update, which
merges it with your commits, and the element's agent resolves a conflict.

## What it gives

| Door | Answers |
|---|---|
| `GET /api/session` | the current session, or `401` — every element asks it |
| `GET /api/session/verify` | verification of a session token, for another service |
| `GET|POST /api/auth/[...nextauth]` | the NextAuth pipeline: providers, callbacks, session, sign-out |
| `GET /api/auth/methods` | which sign-in methods this installation offers — also the node watcher's health door |
| `GET /api/auth/guest` · `POST /api/auth/guest/leave` | a guest session · its end (loopback only) |
| `GET /api/auth/architect` | a session for the architect layer, by `ARCHITECT_TOKEN` |
| `GET /api/auth/sso` · `POST /api/auth/exchange` · `GET /api/auth/ticket` | single sign-on for an element on its own domain: a one-time code, its exchange for a ticket, the ticket check |
| `GET /api/admin/users` · `PATCH|DELETE /api/admin/users/<id>` | the user list and its changes, admin only |
| `GET /api/user-count` | how many accounts exist — used to decide first run |
| `/login` · `/register` · `/signout` · `/guest-login` · `/logout` | the pages a person sees |
| `/` | the signed-in card; without a session cookie `307` to `/<default language>` |
| `/en`, `/ru` | the public home page of the element (catalog blocks, `app/[lang]/(publicLayer)/_data`) |
| `GET|PATCH /api/settings/design` · `POST /api/settings/changed` | the template doors of the own DESIGN-CONFIG and the design/settings signal (key `X-Settings-Key`) |

Where it lives: the forms and their root layout — `app/(auth)/`; sign-out — `app/logout/`; the doors — `app/api/{auth,session,user-count,admin}/`;
the server logic — `lib/auth/*` (NextAuth config, SQLite adapter, registration, roles), `lib/auth/db/` (the database), `lib/sso.ts`,
`lib/guest-guard.ts`, `lib/i18n/auth-strings.ts`. `proxy.ts` answers the sign-in service's own paths first (its template part would
send /login to the auth host — itself — and ask itself who came on every /api request), then hands the rest to the template proxy.
The passport is `OWN-SERVICE-PROPS/`, the node contract `NODE-CONTRACT.json`.

🛑 Single sign-on codes and tickets live in the memory of the process: a restart of this element ends them, and a person on an
element's own domain signs in again (as before v2.0.0).

## 82 languages, and they are not negotiable

`lib/i18n/auth-strings.ts` carries all 82 languages of the sign-in surface, baked into the bundle at
build time. There is no per-user request and no runtime generation: the browser language picks an
entry. Adding a language means adding one entry to `STRINGS`.

**Do not reduce this set.** A node under construction may well ship two languages; this service is
finished, and trimming a finished product is damage, not tidying.

## Storage

SQLite, one file — `DATABASE_URL` (the node gives `<node>/data/services/auth/auth.db`; without it `data/auth.db` here). The schema is executed at start — there are no migrations, and
`data/` never enters git. `better-sqlite3` is a native module: it is loaded lazily, so a machine
without a build toolchain fails at the data layer and not at startup.

## Guests: made on demand, bounded (node step 331)

`/api/auth/guest` makes a user with the role `guest` (and so does the single sign-in centre with `/api/auth/sso?…&guest=1`,
for an element on its own domain). Measured before the limits: one bare GET without a cookie added a record — a request
generator would grow the database without end. Two layers now (`lib/guest-guard.ts`):

- **Per address, in memory, before the database** — at most `ipLimit` guests from one address per `ipWindowSec` (the
  address is `cf-connecting-ip`: from outside the node is reached only through the Cloudflare tunnel). Over the limit
  no record is made: a browser with `redirectUrl` goes back without a session, a bare request gets 429. A botnet with
  many addresses passes this layer; the second one holds anyway.
- **A ceiling on guest records** — `max`; the guest who was inactive the longest is evicted in the same transaction
  that creates the new one, and their sign-in tickets end. Activity = `last_login_at`, refreshed at most every
  10 minutes when a guest's session is checked. An evicted guest's cookie no longer counts: `/api/session`, the ticket
  door and the centre check the record exists, so the visitor simply becomes a new guest.

Settings — `guest-limits.json` next to the database (`<node>/data/services/auth/`), read on the fly, no restart:

```json
{ "max": 5000, "ipLimit": 5, "ipWindowSec": 3600 }
```

No file or field — these defaults (owner's choices 2026-09-28: ceiling 5000, evict the longest inactive, the setting lives
in this service). A card for them in the core's «Authorization» section — later, by the owner's word.

`/api/auth/guest/leave` (loopback only) deletes a guest on the element's request — «Delete my account and leave».
Data an element kept for an evicted or deleted guest is not cleaned here: an element treats an unknown user id as gone.

## Applications of an app factory: one sign-in, own people per application (node step 554)

On a node of type `factory` (registry `nodeType`) every custom element born there is an **application** with its own people. The
owner's words (2026-10-21/22): «таблица пользователей должна быть для каждого приложения своя»; the choice «своя запись в каждом
приложении»; the sign-in stays one — this element. On a `project` node nothing below happens: there is one application, `node`.

| What | How |
|---|---|
| the application | an organization with `element` = the element id (`organizations.element`, unique). The factory birth creates it: `POST /api/node-users/apps { element }` (architect key, loopback), called by the core's `scripts/item-birth.mjs`. Its name in this database is the element id; the core shows the element's `short_name` (APP-CONFIG) at read time |
| an account | `users.app` — the element id, or `node` (the core, built-in elements, a single project, everybody before step 554). The same email in two applications is two accounts; inside one it is unique (`users_app_email`). A Google account — the same (`accounts.app`, `accounts_app_provider`). Membership in the application's organization is written by a database trigger (`users_554_app_member`) |
| which application a sign-in is in | the site in the final return address (`lib/auth/apps.ts`, `lib/auth/app-hosts.ts`): password — `callbackUrl` the form sends; registration — `referer` of the page; Google and email link — `callbackUrl` of the request or the `authjs.callback-url` cookie (`withRequestApp` in `/api/auth/[...nextauth]`). An element without an application organization — `node` |
| the return | `proxy.ts`: on the factory `/login` and `/register` with a return to an element site go through `/api/auth/sso` — the person comes back to the same page of that site with a **ticket** on it, never to the project's home page |
| who is admitted where | `/api/session` and `verify` (the zone cookie every element asks) admit only `node` accounts; an application person lives by the ticket of their site. `/api/auth/sso` gives a code to a site only for its own people, a `node` architect (over all applications) or a `node` guest |
| the first architect | only the first `node` account; the first person of an application is a plain `user` |

Not built: an owner of an application managing their own people, moving people between applications, guests of an application (a guest
stays `node`). Proof — `/code` `completed-steps/554-*.md`.

## Where it came from

Moved out of `ai-workspace/services/auth` on 2026-09-20 (step 257-1). Ported onto the native element template
`fractera-native-item-starter` v0.1.15 on 2026-10-21 (node step 549-5): same doors, same forms, same database, same 82 languages.

---

# fractera-native-item-starter

The reference starter template of a Fractera native element. Native elements are the root elements of a node: they stand on
every node, they come only from the Fractera repository, and they are never sold and never join an outside network. They serve
the person and the other elements of their own node. Custom elements are born from `fractera-custom-item-starter` by the node's
button «Create WEB4 ITEM»; native ones are added from here.

The template is the custom reference template without the network parts: no showcase or Nostr fields in the passport
(`visibility: node`, `messengers: { h2a: true, h2h: false, a2a: false }`), no messenger between people, no work for outside agents
and no order summaries. The home page shows one line, «Reference native template», and the yellow starter sign.

## The contract a replacement must keep

- `OWN-SERVICE-PROPS/` — the passport, the element's main door (`GET /api/own-service-props`); `NODE-CONTRACT.json` — what the node needs to install it.
- The port comes from the `PORT` environment variable.
- `GET /api/health` answers 200 without a session.
- Sign-in only through the node's auth element; stored data only through the node's data element.
- Public pages stay static.

A repository that does not keep this contract is refused; the node does not bend to it.

## Run on its own

```
npm install
npm run build
PORT=24683 node .next/standalone/server.js
```

License: MIT.
