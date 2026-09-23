---
name: Months on this job — the grid: months down, papers across
number: 38
group: ready
status: drawn 2026-09-23, redrawn as a grid the same day ("this is much better" on the first pass) · plan approved
summary: >
  **The Lien desk pane cannot tell a job's month story in one place.** On 273 · Dudley (Lennox)
  the pane shows two tick cards (Jul, Aug) and the claim; April and June — already named on the
  paper Taunya mailed by hand — are two dots under the cards; July's closed window is a red
  banner above everything; which paper covered which months, when it went out, what it claimed
  and where the copy lives are not on the pane at all. Grace: *"I would like to see next to
  Months this notice covers other months notices have gone out or we have reported gone out so
  users can have a better understanding of the timeline."*
next: >
  One PR after v2.3770 lands: the `lienMonthGrid` kernel (months from the RPC, the desk items,
  the job's § 53.056 filings and the work-month evidence, folded into one row per month and one
  column per paper — A, B… — with the window per row and "as information" where a paper named a
  closed month), the desk loads the selected job's notice filings (it loads only affidavits and
  releases today), and `LienDeskMonths.tsx` becomes the grid with the claim and the affidavit
  line under it; the red missed strip folds into the month's row. The one-line path (v2.3761)
  stays above. Second pass of the mock-up 2026-09-23 after "is this the best we can do?" — the
  first drew a rail beside a papers list and said every fact twice.
size: S
blocker: none — Grace's read of the mock-up.
mockup: to-dos/lien-months-rail/mockup.html
opinion: build — it is the pane's one card a reader opens most, and after v2.3770 a job can have papers the dots cannot show (a by-hand record has no desk item).
---

# Months on this job — the rail beside the claim

**The ask (Grace, 2026-09-23, with a screenshot of 273 on the desk):** make the pane easier to
consume — beside *Months this notice covers*, show the other months notices have gone out for,
or have been reported as gone out, so the timeline reads.

## What the pane shows today, and where the rest hides

| Fact | Where it is |
|---|---|
| Months this notice names | the tick cards (`LienDeskMonths.tsx`) |
| Months a notice already named | "Earlier months" dots under the cards (`lienMonthHistory.ts`: sent / skipped / missed, from desk items and the RPC's `noticed` flag) |
| A month whose window closed unnoted | the red strip above the card, and a dot |
| Which paper named a month, when, what it claimed, the saved copy | nowhere on the pane — the Lien window's *Filings on this job* (v2.3763), and for a by-hand record (v2.3770) nothing on the desk at all, since it has no desk item |
| The Chapter 53 path | the one-line strip at the top (v2.3761) and the Timeline tab (v2.3768) |

## The design (mock-up beside this file — the second pass)

- **Months down, papers across.** One row per month worked, oldest first: the month and its work
  (hours · people · days, from `useForecastWorkMonths`), the **window** column (*closed Jul 15* ·
  *closed Sep 15 · not noted · Note it as missed* · *mail by Oct 15 · 22 days left* · *not a work
  month yet*), then one column per **paper** — every § 53.056 filing on the job, run or by hand,
  lettered A, B… oldest first — and, last, **this notice** as a column whose checks are the ticks
  the office already uses. A check is a paper that names the month; *✓ as information* where the
  paper named a closed month (counsel, v2.3745).
- **A paper's header** holds what the old list said in prose: sent date, by the run or by hand,
  the claim, the other jobs on the packet, the method, *Saved copy · Drive ›* / *change*. This
  notice's header: the claim, the pile, *Preview ›*.
- **Under the grid**: the claim box (unchanged), the affidavit's state and date with its gates,
  *A paper that went out by hand? Record it…* (v2.3770's door), and the bold date this notice has
  to beat.
- The red strip above the card and the "Earlier months" dots go; the one-line path (v2.3761) stays.
- **The first pass** (a rail of month rows beside a list of papers) said every fact twice — the
  month row named its paper and the paper named its months. The grid says each once.

## Where it plugs in

- New kernel `lienMonthGrid.ts`: from the RPC months (`LienDeskMonth`), the work-month evidence,
  the desk items and the job's `job_lien_filings` (kind `notice_53_056`, with `by_hand`,
  `packet_id`, `printed_claim`, `document_url` — v2.3763/v2.3770), the rows (month · work · window
  state) and the columns (papers with letters, then this notice), with a cell state per pair:
  named · named as information · on this notice · blank. Replaces `buildLienMonthHistory` for the
  pane (the timeline kernel keeps reading `lienMonthHistory` until the grid feeds it the same
  outcomes).
- `useLienDeskData` loads the selected job's § 53.056 filings (today it loads affidavits and
  releases only, and the notices' `job_id` for the prior-notice test).
- `LienDeskMonths.tsx` → the grid, the claim box, the affidavit line and the by-hand door;
  `LienDeskModal.tsx` drops the missed strip above the card and passes the filings.
- Tests: the kernel (a by-hand paper over three jobs; a run paper; a skip; a closed month noted
  and unnoted; a month older than the RPC window that a paper names), the desk smoke.

## Verify

- 273 on the desk: column A is the Lenox paper (once the office records it through v2.3770's
  door) with checks on Apr, Jun, Jul (*as information*) and Aug; Jul's row reads *closed Sep 15 ·
  not noted* with the button; Aug's window reads *mail by Oct 15*; column B is this draft with
  Jul (*as information*) and Aug ticked; the Drive link sits in A's header.
- 650 · ATI Schertz (Jun closed, noted): Jun's row reads *window closed · noted by …*.
