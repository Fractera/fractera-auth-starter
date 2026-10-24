# /api/app-users — the people of one application for its own site (node step 580)

**What it gives.** The table «Accounts» on `/<lang>/admin/users` of a custom element: the same search, role filter, sort, pages,
property histories and batch changes as the core tab «Users» (`/api/node-users`, step 559) — but only for the people of this element's
application, and without organizations. The work is the same code, `lib/auth/node-users.ts`.

**Who may.** The person, not the element's key (`lib/auth/caller.ts`):
- the person is known by the session cookie of this service, or — from the machine loopback only — by the single sign-on ticket in the
  header `x-fractera-ticket` (on an element's own domain there is no cookie of this service, only the ticket, step 328-3);
- the application is the one the element's server names in `x-fractera-element` (it has an organization-application — its id;
  otherwise `node`, which is every element of a single project);
- the node architect (a `node` record with `architect`) may administer any application; an `admin` — only the application of their
  own record (`users.app`, step 554). Owner 2026-10-24: «архитектор это супер пользователь который имеет покрытие вообще над всем узлом в
  то время как администратор … может быть связана только с той организации через которую пользователь зарегистрировался».

| Door | What |
|---|---|
| `GET /api/app-users?q=&role=&sort=created_desc\|created_asc&page=&perPage=10\|25\|50\|100` | a page of people of the application; `app`, `me`, `nodeArchitect` for the window |
| `GET /api/app-users/<id>/history/<roles\|methods\|marketing\|tracking\|log\|messenger>` | the history of one property; a person of another application — 404 |
| `POST /api/app-users/batch { action, ids[], value? }` | `update`, `block`, `unblock`, `addRole`, `removeRole`, `marketing`, `tracking`, `anonymize` |

**Rules** (on top of `runBatch` of step 559): `addOrg`, `removeOrg` and `orgs` in `update` — `org-locked`; a person of another
application in the batch — `skipped: not-in-app`; the role `architect` weighs only for the node architect — anyone else cannot grant or
remove it, cannot change an architect's record and cannot anonymize.

**How an element calls it** — from its server, never from the browser:

```ts
const res = await fetch(`${authUrl()}/api/app-users?${params}`, {
  headers: { cookie, "x-fractera-ticket": ticketFrom(cookie) ?? "", "x-fractera-element": ownId() ?? "" },
  cache: "no-store",
})
```

**Not built.** Moving a person to another application; the owner of an application inviting people; a guest of an application.

**Proven by** — node step 580-2: a stand on a copy of the live database (two applications, an admin of each, the node architect) and the
live door through an element (`/code/development-docs/development-steps/completed-steps/580-*.md`).
