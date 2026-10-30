# Anti-patterns

Dead ends this element has already paid for. One entry per measured failure, newest on top: the symptom, the cause, the cure — and in
the cure, the sign that warns before the same failure comes again. An entry is written after a failure was measured, never as a
precaution: the template hands every new element this table empty.

| Symptom | Cause | Cure |
|---|---|---|
| A Google or e-mail-link user is signed in through the password form with any password (node step 559-1, measured on a copy of the base) | the credentials provider let a record without a password in by e-mail alone — a branch meant for guests, whose records have no password | password-less sign-in only for `provider = guest`; prove a sign-in change on a copy of the base with the real `authorize` before and after |
| A probe of this element on a spare port moves the live element's CONFIG and Design subscription to the probe port | the subscription takes the process PORT and keeps one record per name | start a probe with CONFIG_SERVICE_URL and DESIGN_SERVICE_URL empty |
