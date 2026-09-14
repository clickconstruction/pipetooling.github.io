# Lien desk — from "a notice is due" to "it went out," with the leader's say-so on record

Status: **in progress** · PR 1 v2.3405 (the migration, the queue kernel, the desk's office and leader sides, the doors, the Dashboard cards) · next: the run (PR 2), affidavits (PR 3) · the 6 decisions below taken as proposed on 2026-09-14 ("this should work, please build it all") · mock-up: [`mockup.html`](./mockup.html) (entry points, Draft A, the critique, Refined B: office pane, leader pane + phone, the run; also published as a Claude artifact 2026-09-14) · spine: the v2.3400 work-months kernel (`src/lib/jobs/forecastWorkMonths.ts`)

## The ask, in the owner's words

> Now that we know what days people were working on bills that have not been paid, it seems logical for us to make it as easy as possible to send liens. I think the right way to do this is to make a notice on an office member's dashboard that a lien is due (matches the qualities of 3 months of work and there not being a payment) per the rules you identified, that an assistant drafts and then it goes to the master unless they select something to bypass the leader's click approval because the leader instructed them orally, and then presents the lien tools to them. I see this as its own modal with multiple entry points: one from the dashboard because things are overdue, and another button on the collections dropdown and hamburger menu in Jobs Pipeline.

## The reading

- Texas Property Code ch. 53 counts from the **month labor was furnished**, never the bill date. A sub job (a GC on the job) needs one § 53.056 notice per unpaid month by the 15th of the 3rd month after (2nd for residential), and one affidavit from the last month worked (§ 53.052). See the memory/statute note and the guide *file a lien and never miss its deadlines*.
- v2.3400 put the per-month evidence and state on the Payment forecast. The Lien window (`LienInstrumentsModal` → `LienFilingTabs`) still keys on the last work month and records `months_covered` as that one month; the Dashboard's `lien-notice-window` card counts jobs, not months, and opens the Pipeline.
- Live 2026-09-14: six sub jobs have June's notice due Sep 15 ($99,088 open) — J650 ATI Schertz, J273 + J258 Dudley Mason, J878 Take 5 Seguin, J825 Palmer, J789 Knight (which also carries a promise for Sep 15). None has an owner of record on the property record. The blocker in practice is data readiness, not approval.
- "Desk" is the app's word for a queue with a workflow: the Legal desk (attorney matters on Collections accounts, v2.3293) and the deposit-matching desk (AR). The Lien desk is the paper we file ourselves, and comes before the Legal desk.

## The decision

One modal, the **Lien desk**, three doors, one lifecycle per (job, months, kind) item:

`due` (derived, never stored) → `drafted` → `awaiting_approval` → `approved` | `held` → `sent` (a `job_lien_filings` row naming the months; the item leaves the desk) · `missed` (kept a week past the deadline so the loss is seen).

- **What qualifies**: a job with a GC, a month with approved clock sessions, money open on the job, no live notice naming that month, deadline within **30 days** (amber ≤ 14, red ≤ 7). One notice may name several months; the earliest sets the deadline. Pending (unapproved) hours are shown, never named.
- **Office** (assistant, controller, dev) readies (owner of record via the property record and the county appraisal link), drafts, sends, records the run. **Leader** (master, dev) approves, holds, and sets a **standing rule per GC** (`ask` · `send` · `hold`) beside payment terms, so routine GCs never reach his queue; he still sees every send in an FYI list.
- **Bypass**: one button, *Robert said to send it*, recording who / when / how (phone · in person · text); the item goes straight to the run; the leader's FYI line carries a *not what I said* pull-back while it has not gone out.
- **Hold**: *they promised* (re-asks on the promise date if unpaid) or *I'll call first* (re-asks 3 days before the deadline); both spell out the forfeit — "June's lien right ends Sep 15".
- **The run**: approved notices go out as one packet (owner copy + GC copy each, a cover sheet) with one tracking form; *Record the run* writes each notice to its job with `months_covered` **per month** — fixing the last-month-only bug for every reader.
- The notice's statutory text is untouched; an optional cover note says it is routine paper, not a claim of default.

Rejected: per-item leader approval with no standing rule (a rubber stamp at volume); a red "owner missing" field that still lets a draft reach the leader; a fourth per-job lien surface (the desk is the queue; the Lien window stays the per-job tool; the forecast's *Send notice…* routes to the desk); a 14-day lead time (certified mail and the owner lookup take days).

## Entry points

1. **Dashboard → Needs you** (and Quickfill's twin): office card *N lien notices to draft — June work on N jobs · $X · earliest closes tomorrow · N need the owner of record*, leader card *Approve N lien notices Taunya drafted*. Replaces `lien-notice-window` (per job) with per-month keys `lien-notice-draft` / `lien-notice-approve`; opens the desk in place.
2. **Pipeline → Collections section ⋯** (`stagesSectionToolsMenu.ts`): *⏱ Lien desk · 6 to draft · 2 to approve*, beside *⚖ Legal desk*.
3. **Pipeline tools ⋯** (page header): *⏱ Lien desk · 6 due · $99,088*.
4. The forecast row's **Send notice…** opens the desk on that item. The row's orange lien icon still opens the Lien window, which shows *In the Lien desk · awaiting Robert* when an item exists. Deep link `?tab=stages&liendesk=1` (the `?legal=` pattern).

## Where it plugs in

| Exists | New |
|---|---|
| `forecastWorkMonths.ts` (months, weeks, per-month notice state), `useForecastWorkMonths`, `ForecastWorkMonthsPanel` (the evidence strip), `lienDeadlines.ts` (the statutory dates), `LienFilingTabs` notice tab (the § 53.056 document, sends jsonb, `months_covered`), `job_lien_filings`, `customer_addresses` property record (owner of record, kind, county) + `CustomerPropertySheet` (CAD link), `dashboardNeedsYou.ts` + `useLienWatchNudge`, `LegalDeskModal` (the two-pane desk pattern), `customerPaymentTerms.ts` (where the standing rule sits), `stagesSectionToolsMenu.ts`, Pipeline tools ⋯ | `lienDesk.ts` kernel (derive due items, piles, readiness, the leader's why-line), RPC `list_lien_notice_months()` for the Dashboard count, table `job_lien_desk_items`, `customers.lien_notice_policy` + note, `LienDeskModal` (piles · list · pane · footer by role/state), the run packet + *Record the run*, Needs You keys, the two menu entries |

## Data

- `job_lien_desk_items`: `job_id`, `months text[]` (earliest = the key), `kind` (`notice_53_056` now; `affidavit` in PR 5), `status`, `fields jsonb` (the draft), `drafted_by/at`, `submitted_at`, `approved_by/at`, `approval_mode` (`leader` · `word` · `rule`), `word_note`, `word_channel`, `held_by/at`, `hold_reason`, `hold_until`, `sent_filing_id → job_lien_filings`, `voided_at`. Unique live per (job, earliest month, kind). RLS: office read/write; a trigger allows `approved_by` only for master/dev unless `approval_mode = 'word'` with a note; both read-only appliers.
- `customers.lien_notice_policy text` (`ask` default · `send` · `hold`) + `lien_notice_policy_note`; leader-write.
- `list_lien_notice_months()`: SECURITY DEFINER, office-gated; sub jobs with open money × approved-session months × not noticed × deadline within 30 days → (job_id, month, approved_hours, deadline).

## The plan

1. **PR 1 — the queue and the card.** `lienDesk.ts` (+tests), the RPC, Dashboard keys replacing the per-job card, deep link. Client-only apart from the RPC.
2. **PR 2 — the desk, office side.** Migration (items + policy), the modal shell and piles, the pane (readiness with the *Find the owner* door, months checkboxes, the evidence strip, the notice preview from the Lien window's renderer extracted into a kernel, the Send box with the cover note), Save draft · Send to Robert · Robert said to send it; the three doors; the forecast's *Send notice…* routes here.
3. **PR 3 — the leader side.** *Your decisions* with the why-line and the context (open with the GC, their word, pay record, months, the forfeit if held), Approve & next, Hold with re-ask, standing rules + the Customer review column, the FYI list with pull-back; the phone layout.
4. **PR 4 — the run.** Packet PDF (owner + GC copies, cover sheet), *Record the run* → `job_lien_filings` per notice with `months_covered` per month; the Lien window's notice tab shows desk state and records per month too.
5. **PR 5 — affidavits.** The 4th-month window as a second item kind (notarize · file · serve) on the same flow; the hand-off line to the Legal desk when paper does not move the money.

Each PR: a release note + fragment, the guide *file a lien and never miss its deadlines* updated (a new guide *send lien notices from the Lien desk* with PR 2), `docs/ACCESS_CONTROL.md` for the approve/bypass split, `GLOSSARY.md` for *Lien desk* and *standing rule*.

## Open decisions (the owner)

- **Lead time**: 30 days before the deadline (proposed), or the day the month's bill goes past its expected pay date?
- **Default rule for a new GC**: ask each time (proposed), or send without asking with an FYI?
- **The cover note**: on by default (proposed), off, or per GC?
- **Bypass reach**: assistant and controller (proposed), or controller only?
- **Held items**: re-ask 3 days before the deadline (proposed) or 7?
- **A GC entered as the customer with no GC set** (J273, J258, J878): treat as a sub job when the customer is a builder (proposed: a *who owns the site?* chip on the item that sets the GC), or leave them direct-with-owner?

## How to verify

Dev login → Dashboard: the office card counts months and opens the desk on the earliest item; the leader card (sign in as a master) lists drafted items with the why-line. Jobs → Pipeline → Collections ⋯ and Pipeline tools ⋯ open the same modal. Draft J650: the owner-of-record door lands on the property record and the item moves from *Needs the owner* to *To draft* on save; *Send to Robert* moves it to *Awaiting Robert*; the master's Approve & next lands on the next item and a rule set on Loberg keeps later Loberg months out of his queue; *Robert said to send it* asks the channel, lands the item in the run, and shows in the master's FYI list; *Record the run* writes a `job_lien_filings` row with three months and the forecast's June/July/August lines read *notice sent*. Prod-safe: nothing here emails or mails until *Record the run* / the courtesy email is confirmed; use a TEST job with a fake GC for the live pass.
