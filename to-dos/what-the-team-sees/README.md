---
name: "What the team sees: every email a user could get, as one person's week"
number: 60
group: ready
status: asked and mocked up 2026-09-29 (draft 2 picked) · PR 1 shipped v2.4142 (the inventory, the tab, the guard, 11 live samples, 4 real previews) · lifts 1–10 of 14 shipped — Money waiting v2.4161, Crew day v2.4163, Payment forecast v2.4164, Billed awaiting v2.4167, Weekly money v2.4170, Weekly movement v2.4172, Paid job + Ready to bill v2.4173, Schedule day v2.4177, Schedule share v2.4178, Job activity report v2.4179 (22 live)
summary: >
  The customer-facing emails have Settings → What customers see; the other 25 — the digests,
  the notices, sign-in, invitations — had no place a dev could see them with sample data. A
  dev-only tab beside it shows every email the team receives as one person's week: when it
  lands, who gets it, the From, the subject with sample values filled in, and the email itself
  where the app can build one. Fourteen digests build their HTML inside their edge functions;
  each is lifted into a kernel in its own PR and its row turns from "next release" to live.
next: lift 11 — Field report (`send-report-email` builds its HTML inline; lift it into `_shared/fieldReportEmail.ts`); then Check returned (`mercury-webhook`), CT roster audit (`ct-roster-audit`).
size: M (PR 1, shipped) + S–M per digest × 14
blocker: None.
opinion: build on, one digest at a time — every lift also gives a digest the unit test it never had
mockup: mockup.html (draft 1, the questions asked of it, draft 2)
---

# What the team sees: every email a user could get, as one person's week

## The ask

> "I would like to add to the settings in the right location for devs all the emails a user could see and the subject lines for those emails with the ability to see them with sample information" — owner, 2026-09-29

Then: *"build a mockup and then ask yourself is this the best we can do and then present to me the revised mockups"* → `mockup.html`; *"I like draft 2, please build it."*

## The decision

- **One person's week, not role strips.** Draft 1 mirrored What customers see with seven role strips; the same digest appeared on three of them. Draft 2 picks *whose week* — a role chip, or a real person — and shows each email once, at its hour: every morning · when something happens · every week · once.
- **A person reads the real recipient settings.** The streams whose recipients are a list on Emails & reports (Paid job, Ready to bill, Signed agreements, Portal requests, Job reports) are read from `app_settings` / `get_global_email_schedule`; the rest follow the sender's role gate.
- **Subjects are filled in** from the sample company and today's date — no `{{vars}}`.
- **Three honest states per row**: *renders live* (a builder the browser runs), *shows the real one* (the function's own preview mode, live rows, for your eyes only, plus *Email me the real one*), *next release* (built inside the function; names it).
- **Nothing edits here.** *Change who gets it →* lands on the stream's card on Emails & reports or on Email templates.
- **Dev-only** for now; the owner may open it to masters like What customers see.

## Where it plugs in

| Piece | Exists | New in PR 1 |
|---|---|---|
| `src/lib/emailCatalog.ts` | 43 rows, `audience`, `sender` | — (the guard reads it) |
| `src/lib/teamEmails.ts` | — | the 25-row inventory + kernels (`teamEmailsForRole/Person`, `groupTeamEmailsByWhen`, coverage) |
| `src/lib/teamSampleEmails.ts` | builders: `signedAgreementEmail`, `gcWordAsk.wordAskEmail`, `contractSigningEmail`, `emailWording.renderEmailWording` | the eleven sample builds; `_shared/bidRoomActivityStaffEmail.ts` and `_shared/portalRequestStaffEmail.ts` (lifted from their functions) |
| digest previews | `fetchCrewDayPreview`, `fetchMoneyWaitingPreview`, `fetchPaymentForecastPreview`, `fetchBilledReportPreview` (+ `send*Test`) | wired to *Show the real one* / *Email me the real one* |
| `SettingsWhatTheTeamSeesTab.tsx` | — | the tab; `settings-what-the-team-sees` group (dev), search entry |
| recipient lists | `app_settings` keys (paid job, ready to bill, signed agreements, portal requests), `get_global_email_schedule` | read for *A person* |

## The plan (PR train)

1. **The inventory, the tab, the guard** — shipped v2.4142.
2. → 15. **One digest per PR**, most-read first: Money waiting · Crew day · Payment forecast · Weekly money movement · Paid job + Ready to bill (one builder, two kinds) · Billed awaiting · Weekly movement · Schedule day · Schedule share · Job activity report · Field report · Check returned · CT roster audit. Each: `_shared/<name>Email.ts` (data in → subject/html/text out) with a unit test; the function calls it; a before/after HTML diff of one real dispatch proves the lift verbatim; a fixture in `teamSampleEmails.ts`; the row's render becomes `sample`; redeploy.
3. Optional: *Email me this sample* on the live rows (a small function that sends a built sample to the viewer).

## How to verify

- `npx vitest run src/lib/teamEmails.test.ts src/lib/teamSampleEmails.test.ts src/components/settings/SettingsWhatTheTeamSeesTab.render.test.tsx`.
- Dev server, as a dev: Settings → What the team sees. Controller → *Every morning* = Crew day, Money waiting, Payment forecast; open Money waiting → *Show the real one* builds today's; Helper → only the once-and-event rows; *A person* → Malachi → the Paid job row follows the list on Emails & reports.
- After a digest PR: the before/after diff on one real send is in the PR; `check:edge-drift` clean after deploy.
