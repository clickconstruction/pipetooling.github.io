---
name: Counsel's portal after the lien desk — the same rail, the same paper, the same grid
number: 41
group: ready
status: drawn 2026-09-23 (second pass after "is this the best we can do?") · build approved the same day ("I would like to build all 4") · PR 1 built as v2.3787 on claude/legal-portal-lein-desk-62a0d1 (the rails and the envelopes; the owner's-answers band waits on #33 PR 2–3) · PR 2 built as v2.3789 on claude/legal-portal-grid-pr2 (stacked; the grid panel + the service-role migration) · PR 3 built as v2.3790 on claude/legal-portal-asks-pr3 (stacked; asks and answers, no migration) · PR 1b left
summary: >
  **The legal portal shows none of what the lien desk learned this week.** The desk draws every
  Chapter 53 step per job (v2.3761), keeps the book and prints counsel's twelve columns
  (v2.3768), holds the retainage clock and the bond (v2.3753), the saved copy of each paper
  (v2.3763), a paper sent by hand or covering three jobs (v2.3770, v2.3777) and the owner's
  three answers (#33 PR 3). The firm's Paper tab still computes a five-column "Lien clock" with
  the older kernel — wrong the day a notice goes out — and lists filings one job at a time with no
  copy. Four changes, each on a kernel the desk already runs: the job's rail replaces the clock
  table, filings become one row per envelope with the owner's answers under the notice, the grid
  goes live as a third portal panel, and the office can ask the firm (a question, or a sign-off on
  one job) and the firm answers on the portal.
next: >
  Ship PR 1–3 in order (each stacked on the last); then PR 1b (the owner's answers, letter two
  and the GC's okay under the notice row) once #33 PR 2–3 (v2.3760, v2.3767) are on main — the
  fields live on job_lien_desk_items, which the portal function will then fetch. Then retire.
size: M
blocker: none — PR 1b waits on #33 PR 2–3 for the desk-item fields it reads, not on a decision; the grid's coverage is a constant with an owner call drawn.
mockup: to-dos/legal-portal-lien-desk/mockup.html
opinion: build — counsel asked for the timeline per job and the grid "today"; both exist on the desk and reach the firm only as a printout the office emails, and the firm's own table contradicts the desk the day a notice is mailed.
---

# Counsel's portal after the lien desk

**The ask (Grace, 2026-09-23):** "in the last day we've added some awesome stuff to the lien desk,
I think we should look at the legal portal and think about how what we've built changes things and
what we should include in the legal portal now?" Then, on the assessment: "help me build mockups as
to 1–4 and then ask yourself is this the best we can do? and then I would like to build all 4."

## What changed underneath, and what the portal does with it (read at v2.3779)

| Shipped to the desk | Data or kernel | On the portal today |
|---|---|---|
| The timeline, v2.3761 / v2.3768 | `buildLienTimeline` (eight steps), `LienTimelineStrip`, `lienGridRows` / `lienGridHtml` | Not used. Paper tab shows notice due · affidavit due · status from `computeJobLienClock` |
| Retainage, v2.3753 | `lien_contract_ended_on`, `lien_retainage_held`, `lien_payment_bond` on `jobs_ledger`; kind `retainage_53_057` | The `legal-portal` function never selects the columns |
| Saved copy, v2.3763 | `document_url` on `job_lien_filings`; the desk's *Copy* column | Dropped from the portal's table (`LegalFilingLine.documentUrl` is built and unused there) |
| By hand and combined, v2.3770 / v2.3777 | `packet_id`, `by_hand`, `printed_claim` | One row per job with its share; nothing says one paper |
| Letter two and the owner's call, #33 PR 2–3 | `fields.letterTwo`, `fields.ownerCall`, `fields.gcAuthorizedDirectPay`; piles A / B / C | Nothing |
| The suit watch, #37 PR 3 | `suitDeadlineFor`, `legalLienClockWords` | In flight: *Suit by* and the served / released words on desk, firm view and print |

Two structural gaps: counsel has no door in before a referral (the timeline names *counsel by* at
90 days, the memo wants a per-job sign-off before the office takes an owner's direct payment, and
the § 53.057 form waits on counsel's read); and questions run one way — the firm asks, the office
answers, and the memo's open question lives in `owner-decisions-pending.md` because there is no
channel.

## The design (mock-up beside this file — the second pass)

1. **Where each job stands.** The Lien clock table goes; each job gets its rail
   (`buildLienTimelineFromWindow`, #37 PR 3's adapter: filings + job row + work months folded from
   the approved clock sessions the function already fetches) and the desk's *Next on the path*
   line. The § 53.057 step carries the retainage and the bond as words — no second table.
2. **The paper that went out.** Filings grouped by `packet_id`: one row per envelope with every
   job's share, run or by hand, tracking, the copy, the months as printed with *as information*
   where the window had closed (counsel, v2.3745). Under a notice: the owner's answers and the
   pile, letter two, the GC's written okay.
3. **The lien grid.** A third top panel beside Matters and Notifications: the desk's Timeline
   book as `lienGridRows`, per GC and lens, *Print the grid* hands over `lienGridHtml`. A `?`
   marks an answer the office still owes.
4. **Asks and answers.** One channel: an *ask* from the desk (flavor question or sign-off, with a
   job) lands on the firm's Fees & steps under *From the office*; the firm answers there (words,
   or *Signed off* / *Not yet* with a note); the answer lands on the office's Needs You card, the
   desk's entries and — for a sign-off — the notice footer. No money moves, no stage changes.

### Is this the best we can do? — what the first pass got wrong

- A retainage table under the rail said every retainage fact twice → the step's words carry it.
- Filings still one row per job with new columns → one row per envelope, the answers as a band.
- A per-matter grid on Paper duplicated the rails → one grid across the book at the top level.
- Two acts and two office verbs for one movement → one ask with a flavor, one answer.
- The rail dated § 53.057 from the job's contract end only → the owner's completion date (the
  § 53.101 trigger) reads from the owner's call when there is one.
- Keeping the Lien clock table beside the rails "for the firm's habit" → two readings of the same
  dates, one wrong the day a notice is mailed; the table goes, the print gets the rails as rows.

**Left on purpose:** the firm still sees no job before the office refers the account; a lien at
"suit in 61d · counsel" reaches them through the grid or the referral, not its own alarm. A
firm-side line on the grid panel ("3 jobs inside the counsel lead") rides on PR 2 if wanted.

## Owner calls

| Call | Drawn as |
|---|---|
| Which jobs the grid covers | The desk's whole Timeline book — the rows the office prints and emails today. Alternative: only referred matters' jobs. |
| Who may ask the firm | Anyone who can open the Legal desk; the notice pane's *Ask counsel to sign off…* follows the desk's roles. |
| Whether a sign-off unlocks anything | No — words on the footer and the desk. A gate on Mark paid is a later PR if wanted. |
| The print packet | The rails print as a table per job in the Paper section. |

## Where it plugs in

- **Portal page and view:** `src/pages/LegalPortal.tsx`, `src/components/jobs/legal/LegalFirmMatterView.tsx` (shared with the desk's Mark-ready preview), `legalFirmMatterViewShared.ts`.
- **Packet kernel:** `src/lib/legal/legalPacket.ts` (`LegalLienClockLine`, `LegalFilingLine`, `paper`), `legalPacketPrint.ts`, `legalPortalPayload.ts` (the raw rows → packet).
- **Function:** `supabase/functions/legal-portal/index.ts` (the select list), `submit-legal-portal` (the firm's acts).
- **Lien kernels reused:** `src/lib/jobs/lienTimeline.ts`, `lienTimelineDesk.ts` (`buildLienTimelineFromWindow`), `lienTimelineBook.ts` (`lienGridRows`, `lienGridHtml`), `lienNoticeByHand.ts` (packets), `lienOwnerCall.ts` (the piles), `lienLetterTwo.ts`; `components/jobs/LienTimelineStrip.tsx`.
- **Desk side:** `LegalDeskModal.tsx` (Paper tab, Fees & steps), `LienDeskModal.tsx` (the notice footer's door), `dashboardNeedsYou.ts` (the firm-activity card), `useLegalFirmActivityNudge.ts`.
- **New:** `legalPaper.ts` (filings → envelopes), the grid panel component, the ask/answer entry kinds (migration), `docs/EDGE_FUNCTIONS.md` sections for both functions, the guide *share your attorney their portal*.

## The train

1. **PR 1 · the rails and the paper** (items 1 + 2). Function selects the three lien columns and
   `created_at`; `legalPacket.ts` builds a timeline per job and groups filings by packet;
   `LegalFirmMatterView` draws the rails and the envelope table; desk Paper tab and print follow.
   Deploy `legal-portal` after merge. Needs #37 PR 3, #35 PR 2 and #33 PR 3 on main.
2. **PR 2 · the grid** (item 3). The function runs the Timeline tab's two RPCs as the service
   role and returns the book; the portal's third panel draws and prints it. Deploy `legal-portal`.
3. **PR 3 · asks and answers** (item 4). Migration: the two entry kinds; the desk's *Ask the
   firm…*, the notice footer's *Ask counsel to sign off…*, `submit-legal-portal` takes `answer`,
   the firm's *From the office* card, the Needs You wording, the footer's signed-off line. Deploy
   `submit-legal-portal` and `legal-portal`.

## How to verify

- The desk's Mark-ready sheet → *Preview what the firm sees ↗* renders the same component; check
  the Lenox matter (273 · 858 · 866) there before any token is minted.
- The sample portal (`?t=` sample token, v2.3512 / v2.3639) carries one referred matter — the
  rails must draw on it with no filings (every step undated or later, one *next* line).
- Live: the firm's link on prod after `supabase functions deploy legal-portal`; the by-hand
  Lenox paper (v2.3770) must read as one envelope with three shares.
