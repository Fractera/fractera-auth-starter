# Fractera Auth — the service that hands out entry

A replaceable microservice. It owns sign-in, sessions and roles for one Fractera node, and nothing
else. The node never imports its code: it knows one address and one contract.

**Two services handing out entry on one machine equal no authentication at all.** There is exactly one
of these per node.

## What it gives

| Door | Answers |
|---|---|
| `GET /api/session` | the current session, or `401` |
| `POST /api/session/verify` | verification of a session token, for another service |
| `ANY /api/auth/[...nextauth]` | the NextAuth pipeline: providers, callbacks, sign-out |
| `GET /api/auth/methods` | which sign-in methods this installation actually offers |
| `POST /api/auth/guest` | a guest session |
| `POST /api/auth/architect` | a session for the architect layer, by `ARCHITECT_TOKEN` |
| `GET|POST /api/admin/users` | the user list and user creation, admin only |
| `GET /api/user-count` | how many accounts exist — used to decide first run |
| `/login` · `/register` · `/logout` | the pages a person sees |

The full passport is `OWN-SERVICE-PROPS.json`. It is written by the author of this service and read —
never edited — by whoever installs it.

## 82 languages, and they are not negotiable

`lib/i18n/auth-strings.ts` carries all 82 languages of the sign-in surface, baked into the bundle at
build time. There is no per-user request and no runtime generation: the browser language picks an
entry. Adding a language means adding one entry to `STRINGS`.

**Do not reduce this set.** A node under construction may well ship two languages; this service is
finished, and trimming a finished product is damage, not tidying.

## Installed by the node, not by hand

The normal way in is the node's one command:

```
npm run services:install
```

It clones this repository at the version pinned in the node's `MICROSERVICES.json`, assigns a port
from the block `24680–24699`, reads `.env.example`, and writes `.env.local` here.

🛑 **`.env.local` is a generated file.** Editing it by hand works until the next install and then
disappears without a word. Change the node's registry instead.

## Running it alone (for developing this service)

```
npm ci
cp .env.example .env.local     # then fill the values in by hand
npm run build
npm run start
```

The port is whatever `npm run start` is told; nothing inside this repository remembers a port number.

## Storage

SQLite, one file, `data/auth.db`. The schema is executed at start — there are no migrations, and
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

## Where it came from

Moved out of `ai-workspace/services/auth` on 2026-09-20 (step 257-1), unchanged: same code, same
dependencies, same 82 languages. What was added at the move: this README, the passport, the marked
`.env.example`, and the empty `architect-pages/` folder.
