# /api/node-users — the users of the node for the core tab «Users» (node step 559)

**What it gives.** The core tab «Users» of the auth element (core: `app/api/node/users/[[...path]]/route.ts` → here) lists every
account of the node with server search, filters and sort, shows the history of each property, and changes people in batches.
The work is `lib/auth/node-users.ts`; this route only guards and dispatches.

**Lock.** The header `x-architect-token` equal to `ARCHITECT_TOKEN` — the secret only the core and this element hold (every other
element has `SETTINGS_SECRET`, so that key would let any element read and anonymize people). Only the machine loopback: a request
through the tunnel gets 404. The core passes who acts in `x-node-actor` (user id or `owner-at-machine`) and `x-node-actor-roles`.

| Door | What |
|---|---|
| `GET /api/node-users?q=&org=&role=&sort=created_desc\|created_asc&page=&perPage=10\|25\|50\|100` | a page of users; search by pseudonym, first and last name, email, case-insensitive for Cyrillic too |
| `GET /api/node-users/<id>/history/<roles\|methods\|marketing\|tracking\|log\|messenger>` | the history of one property, newest first |
| `GET /api/node-users/organizations`, `POST … { name }` | organizations with member counts; the same name (any case) is the same organization |
| `POST /api/node-users/batch { action, ids[], value? }` | `update` (one person, a patch), `block`, `unblock`, `addRole`, `removeRole`, `addOrg`, `removeOrg`, `marketing`, `tracking`, `anonymize` |

**Rules** (`runBatch`): one transaction; what cannot be done is returned in `skipped` with a reason, the rest is done. Nobody edits
their own record; the record of an architect is changed only by an architect; only an architect anonymizes; granting marketing
consent is one person at a time (consent comes from the person); `update` checks every field before writing anything.

**Anonymization** erases first and last name, avatar (and its stored file through the data layer), password, Google links and
sign-in methods, e-mail (→ `deleted-<id>@invalid`) and wallet; keeps the id, the pseudonym, the log and the histories. The person
can no longer sign in. The pseudonym of a Google user is their Google name — the core window says so before deleting.

**Not built.** The writer of `user_messenger_contacts` (the Web4 messenger); reading the tracking and marketing consents in
analytics and mailings; renaming and deleting organizations; users per application of an app factory (node step 554).

**Proven by** — node step 559: a harness on a copy of the live database (`lib/auth/node-users.ts` functions), an HTTP probe of the
installed build (registration through the real form action, sign-in events, block), the live door (401 without the key, 404 through
the tunnel), a stand of the core island in headless Chrome. Summaries — `/code/development-docs/development-steps/completed-steps/559-*.md`.
