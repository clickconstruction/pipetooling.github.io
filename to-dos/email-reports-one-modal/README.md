---
name: Email reports, one modal
group: ready
status: not started · mock-up liked by the owner 2026-09-16 · Option A vs B still open (PR 1 is the same either way)
summary: >
  **Email reports, one modal**: fold Jobs → Reports' two buttons — *Recurring Email Reports*
  (digests on a schedule) and *Report email recipients* (one email per report, as filed) — into
  one **Email reports** button and modal. Option A keeps both bodies under two tabs; Option B
  shows one row per person with a Digest chip and an Every-report chip. Client-only, no
  migration. Mock-up in the folder.
next: >
  PR 1 — the one button and the tabbed modal shell (Option A), the Dashboard mail button opening
  it on Every report, the Settings "managed from" strings. PR 2–3 only if the owner picks Option B.
size: S (A) · M (B)
blocker: None for PR 1. Option B's PRs wait on the owner's pick.
ver: mock-up 09-16
---

# Email reports, one modal — the two report-email doors become one

## The ask, in the owner's words

"I would like to combine these two into the same modal. Could you help me come up with a mock up of what that could look like. Show me the before and after." (2026-09-16, with a screenshot of the two toolbar buttons.) Then, on the mock-up: "I like this, can you please save it to the apps docs as a to do with all this information so someone else can build it."

Context: the per-report stream (*Report email recipients*) gained a team-lead scope and a second door on Jobs → Reports on 2026-09-15 (v2.3472, v2.3480, v2.3486). That put two report-email buttons side by side, each opening its own modal with its own layout, for one question: *who gets report email, and what?*

## The decision

**One button, one modal.** The toolbar's *Recurring Email Reports* and *Report email recipients* become a single **Email reports** button (phone: one **Email reports** link where there are two today). The Dashboard's Recent Reports mail button opens the same modal, landing on the per-report side.

The modal's intro names the two kinds in one sentence: a **digest** bundles a window of job activity on a schedule; **every report** sends each report the moment it is filed.

Two ways to lay out the body were drawn. **Still open — the owner's pick** (logged in [`owner-decisions-pending.md`](../owner-decisions-pending.md)):

| | Option A — two tabs | Option B — one list, by person |
|---|---|---|
| Shape | Tabs *Digests* · *Every report*, each holding today's body | One table: Person · Digest · Every report · Edit |
| Digests side | Schedules list first; the preview/test toolbar folds under *Preview or send a test* | Schedules become a small line under the table (names are links, *New…*) |
| Every-report side | Today's recipient cards, unchanged | Folded into each person's row editor |
| Tradeoff | Smallest change; a person on both kinds shows in two places | The real "who gets what" view; bigger rebuild |
| Size | S, one PR | M, three PRs (PR 1 is A's shell) |

**Recommendation: build A now.** It removes the second button at low risk, and its shell is the first PR of B anyway, so choosing B later wastes nothing.

Rejected: a third tab for previews (the preview is a digest tool, it stays with digests); merging the two tables into one (the streams have different sends, dispatchers and dedupe ledgers — this is a UI merge only); letting outside addresses receive digests (the digest recipient is a user FK and the payload is per-recipient; B shows a dash in that column for an outside address).

## The mock-up

[`mockup.html`](./mockup.html) — a static copy of the design canvas *Email Reports, One Modal* ([artifact](https://claude.ai/artifact/VbdxwqAKxgkzsEXAFMUSa3)). Seven boards:

1. **Before — the toolbar**: ＋ New report · search · *Recurring Email Reports* · *Report email recipients* · Templates.
2. **Before — Recurring Email Reports** (as built): Close button; the preview toolbar (Org · Recipient · Scope · Filter · Include costs · Preview HTML · Send test email); *Schedules* with *New schedule*; one card per schedule with Edit / Delete.
3. **Before — Report email recipients** (as built): × close; the intro paragraph; one card per recipient (App user / External email, Recipient, Which reports, Auto-send, Enabled, Save · Send now · Remove); *+ Add recipient*.
4. **After — the toolbar**: ＋ New report · search · **Email reports** · Templates.
5. **Option A — Digests tab**: title *Email reports*, the two-kinds intro, tabs with a one-line subtitle each (*a bundle on a schedule* · *one email per report, as filed*), the schedules list first, *Preview or send a test* as a disclosure below.
6. **Option A — Every report tab**: the same header and tabs, today's recipient cards.
7. **Option B — one list by person**: legend chips (blue *Digest*, amber *Every report*), a table with one row per recipient — the digest chip reads *Yesterday recap · jobs yesterday · all users*, the every-report chip reads *all reports* / *everyone Abraham leads* / *from Darren, Paige* — an Edit per row, *+ Add person*, and *Schedules: Last week recap · Yesterday recap · New…*. Malachi's row and the two schedules are real; the other rows are examples.

Every board uses the dark theme values from `src/index.css` (surface `#1f2937`, border `#374151`, muted text `#9ca3af`, link `#60a5fa`, blue-tint chip `#1e3358`/`#93c5fd`, amber-tint chip `#3a2f11`/`#fcd34d`). Build with the CSS variables, never these hexes — the theme check fails raw neutrals.

## Where it plugs in

Both sides already admit the same people: the client gates are dev · master · assistant-like (assistant + controller), and the tables' RLS is `is_office_staff()` for the digest tables (one-company sweep, `20260907050000`) and `can_manage_report_email_subscriptions()` for the per-report ones. **No migration, no edge function.**

| Exists | Change |
|---|---|
| [`JobsReportsTab.tsx`](../../src/components/jobs/JobsReportsTab.tsx) — desktop buttons *Recurring Email Reports* and *Report email recipients*; phone links *Email reports* and *Recipients*; mounts both modals behind `canManageTemplates` | One **Email reports** button / link; one modal mount |
| [`RecurringEmailReportsModal.tsx`](../../src/components/jobs/RecurringEmailReportsModal.tsx) (~1.1k lines) — props `open, onClose, authUserId, authRole, scopeMasterChoices`; preview → `recurring-job-report-preview`, test → `recurring-job-report-test-send`; schedules on `recurring_job_report_schedules` + `_recipients`; the inline editor's save **deletes and reinserts** a schedule's recipients | Extract its body as `RecurringDigestsPanel` (no overlay, no title); the preview toolbar moves under a disclosure |
| [`ReportEmailSettingsModal.tsx`](../../src/components/dashboard/ReportEmailSettingsModal.tsx) — props `open, onClose, authUserId`; kernel [`reportEmailSubscriptions.ts`](../../src/lib/reportEmailSubscriptions.ts); *Send now* → `send-report-email` manual mode; tolerates a missing team-leads table | Extract its body as `ReportEmailRecipientsPanel` |
| — | New `EmailReportsModal.tsx` (in `src/components/jobs/`): title, intro, tabs, `initialTab: 'digests' \| 'every'`; takes the union of both modals' props |
| [`DashboardRecentReportsSection.tsx`](../../src/components/dashboard/DashboardRecentReportsSection.tsx) — the envelope button opens `ReportEmailSettingsModal` | Opens `EmailReportsModal` with `initialTab="every"`; it needs `authRole` and the scope-leader choices, which `JobsReportsTab` computes today (lift that loader into a small hook, e.g. `useRecurringReportScopeMasters`) |
| [`SettingsMyEmailScheduleSection.tsx`](../../src/components/settings/SettingsMyEmailScheduleSection.tsx) — "Managed from Jobs → Reports → Recurring Email Reports" and "… → Report email recipients (or the Dashboard's Recent Reports ✉)" | Both read **Jobs → Reports → Email reports** |
| [`SettingsEmailStreamsSection.tsx`](../../src/components/settings/SettingsEmailStreamsSection.tsx) — digest cards "edit schedule & filters → Jobs → Reports"; the Field report emails card "→ Jobs → Reports → Report email recipients" | Same rename |
| Guides [`email-reports-to-people.md`](../../src/content/help/email-reports-to-people.md) (two doors, button labels) and [`see-your-email-schedule.md`](../../src/content/help/see-your-email-schedule.md) | Button and tab names; the guide can keep its title |
| `docs/REPORT_SUBSCRIPTIONS.md`, `docs/EDGE_FUNCTIONS.md` → send-report-email ("Used by") | Door names |

**Option B only** (PR 2–3):

| Piece | Notes |
|---|---|
| Kernel `src/lib/reports/emailReportPeople.ts` (+ tests) | Groups digest recipient rows (`recurring_job_report_schedule_recipients`: `schedule_id`, `recipient_user_id`, `activity_scope`, `crew_filter`, `include_costs`) and per-report subscriptions (`recipient_user_id` or normalized `recipient_email`, authors, team leads) into one row per person, sorted by name; an outside address is its own row with no digest cell. Chip text reuses `describeDigestScope` and `describeReportEmailSubscription` from [`emailScheduleWeek.ts`](../../src/lib/emailSchedule/emailScheduleWeek.ts). |
| `EmailReportPersonEditor` | One sheet per person: a checkbox per schedule with that recipient's scope / filter / costs, then the per-report card fields. Write digest rows **per row** (insert / update / delete by id) — never the delete-and-reinsert the schedule editor does, or editing one person rewrites everyone's rows. `(schedule_id, recipient_user_id)` is unique; all four verbs are open to office staff. |
| `DigestScheduleEditor` | Name · enabled · days · 15-minute time · timezone, extracted from the recurring modal's inline editor, without its recipients table. |

## The plan

1. **One door, two tabs (Option A)** — client-only, S. The two panel extractions (pure moves, no behavior change), `EmailReportsModal` with tabs and `initialTab`, the preview toolbar under a disclosure, one toolbar button and phone link, the Dashboard door, the scope-leader hook, the Settings strings, both guides (with `{{button:outline|Email reports}}` and the tabs as chips), the two docs. Release note + `docs/recent-features/` fragment. A render smoke for the modal (tabs switch; `initialTab="every"` lands on the cards).
2. **(B) The people kernel and the list** — client-only, M. `emailReportPeople.ts` + tests; the *Every report* and *Digests* tabs are replaced by the table; Edit opens the per-person editor with per-row writes; *+ Add person*.
3. **(B) The schedule line** — client-only, S. The *Schedules:* line with the extracted `DigestScheduleEditor`; the preview/test disclosure moves under it; the old panels are deleted.

## How to verify

- `npm run dev`, then `/dev-login?as=1&to=/jobs?tab=reports` (always signs in as Robert, dev).
- The toolbar shows **Email reports** and Templates only; at phone width the links row shows one **Email reports** link.
- *Digests* tab: the two real schedules (*Last week recap* · Mon 3:00 AM, *Yesterday recap* · Tue–Sat 3:00 AM) with Edit / Delete. *Preview or send a test* → Preview HTML renders in the frame. Send a test only to your own account.
- *Every report* tab: Malachi's card (all reports) appears. Add a card for Robert, pick *Only from selected people or teams*, tick Abraham under Team leads, Save. Then Settings → My email schedule reads "Field reports — reports from everyone Abraham leads", and Settings → Emails & reports shows "Robert · from 1 team". Remove the test row with that card's × — never leave it.
- Dashboard → Recent Reports → the envelope opens the same modal on *Every report*.
- People → Users → **Imitate** a controller: the button shows and both tabs load; a superintendent or estimator sees no button.
- Do **not** press *Send now* on a real recipient: it emails up to 50 real reports from the last 14 days.
- For B: an outside address row shows a dash under Digest; editing one person's digest scope leaves the other recipients of that schedule untouched (check them in Settings → Emails & reports).
