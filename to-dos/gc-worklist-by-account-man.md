---
name: "GC Review: every GC under its account man, and the leader by default"
number: 54
group: ready
status: asked 2026-09-28 (the owner, reading This week's GCs after #4004 renamed the groups "Account Man Malachi")
summary: >
  This week's GCs groups by account man only above the $10,000 line; every smaller GC
  sits in one "Under $10,000" group whoever its account man is, and a GC with no
  standing pick and no account manager on its jobs sits under "No account man yet".
  The owner's shape: group by account man always — a small GC inside its account man's
  section, its word still optional — and file a GC nobody is set on under the leader,
  so nothing is nobody's.
next: >
  One PR: `buildGcWorklist` in `src/lib/jobs/gcWorklist.ts` drops the `under_line` group
  kind (the row keeps `overLine`, which still decides whether the word is required and
  what `worklistNextStep` asks for) and takes a `leaderUserId` for the `ownerUserId`
  fallback; `worklistGroupTitle` loses "No account man yet" and "Under $10,000";
  `GcWorklistPanel` marks an under-the-line row "word optional" inside its section;
  the guide *run your weekly GC statement round* → The week's list. Who the leader is:
  the same source the app's "leader" copy uses (one master, `is_master_or_dev` — read it
  once in the modal, pass the id in).
size: S
blocker: None — one kernel, one panel, one guide.
opinion: build — the owner described the shape and picked the heading wording; the only open question is whether "Under $10,000" should survive as a subtotal line inside each section (I would not: the row's "word optional" marker says it).
mockup: not required — the same rows, regrouped; the headings already read "Account Man <name>"
---

## The ask, in the owner's words (2026-09-28)

> Perhaps long term we should sort this by account man and when no account man is listed on a job, the default is the leader.

And, on the heading: *"Instead of Ask Malachi, it should say Account Man Malachi"* — shipped v2.4097 (#4004). Nothing of the regrouping is built yet (2026-09-29): `buildGcWorklist` still makes the `under_line` group.

## Where it stands today

- `buildGcWorklist` (`src/lib/jobs/gcWorklist.ts`) makes three kinds of group: `owner` (a GC over the line with an account man), `unassigned` (over the line, nobody), `under_line` (every GC under $10,000, whoever its account man is).
- The account man is `senders.get(gcId)` (the standing pick, `customers.statement_sender_user_id`) else `accountMen.get(gcId)` (the account manager on most of the GC's jobs, `gcStatementRounds.ts`), else null.
- The line (`GC_ROUND_THRESHOLD`, $10,000) also decides whether the word is required — that rule stays.

## What changes

1. Every GC files under its account man; the under-the-line rows keep their *optional* word step and read "word optional" beside the name, so a section still shows at a glance which rows only need Check and Send.
2. A GC with no account man files under the leader. The row's *pick an account man* link stays, so the office can move it.
3. The group order: the signed-in person first (as now), then the others by total.

## How to verify

`npm run dev`, `/dev-login?as=1&to=%2Fjobs%3FgcReview%3D1`: every GC appears exactly once, the sum of the section totals equals the "waiting to be checked" strip, a GC under $10,000 shows "word optional" and its Word step reads optional, and a GC with no account man on any job sits under the leader's heading.
