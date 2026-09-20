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

## Where it came from

Moved out of `ai-workspace/services/auth` on 2026-09-20 (step 257-1), unchanged: same code, same
dependencies, same 82 languages. What was added at the move: this README, the passport, the marked
`.env.example`, and the empty `architect-pages/` folder.
