# Anti-patterns

Dead ends already paid for. One entry per cause: symptom · cause · cure. Newest on top.

| Symptom | Cause | Cure |
|---|---|---|
| The build stops on the shadcn guard `no-manual-dark` after minutes of work | a status colour written from the palette with a manual `dark:` pair (`bg-emerald-500/15 text-emerald-700 dark:text-emerald-300`): a palette colour fits one theme and breaks the other | take a theme token that already knows both themes (`--primary`, `--accent`, `--destructive`, the `tone-*` tokens where the theme has them); before a long build run `npm run prebuild` alone — every guard in seconds |
| A Google or e-mail-link user is signed in through the password form with any password (node step 559-1, measured on a copy of the base) | the credentials provider let a record without a password in by e-mail alone — a branch meant for guests, whose records have no password | password-less sign-in only for `provider = guest`; prove a sign-in change on a copy of the base with the real `authorize` before and after |
| A probe of this element on a spare port moves the live element's CONFIG and Design subscription to the probe port | the subscription takes the process PORT and keeps one record per name | start a probe with CONFIG_SERVICE_URL and DESIGN_SERVICE_URL empty |
| A search over the docs finds nothing, yet the record exists | the record was written in Russian: one word has six case forms, and a literal search matches one | write documents in English; the person's words only inside quotes |
