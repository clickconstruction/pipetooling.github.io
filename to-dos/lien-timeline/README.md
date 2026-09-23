---
name: The lien timeline — one job, every Chapter 53 date, where it stands
number: 37
group: ready
status: approved 2026-09-23 ("I love what you're proposing") · PR 1 built on claude/frosty-varahamihira-beff11 (v2.3761: the kernel, the strip on both desk panes) · PR 2 built on claude/lien-timeline-pr2 (v2.3768: the Timeline tab, Print the grid) · PR 3 next
summary: >
  **The lien timeline**: counsel's memo says "run the timeline separately on every job" and
  "move every job onto that grid today". The app dates two of the six Chapter 53 steps and
  shows them in four places, none of which shows the path — and a filed job leaves the desk
  after 30 days while the year-long suit clock runs unwatched. This draws the path once per
  job from facts the app already holds (last work month or the creation month, property kind,
  filings, service, releases), puts it on the desk pane as a strip, on a third desk tab as the
  book of every job, and prints it as counsel's grid per GC. The two steps the app cannot
  date yet (§ 53.057 retainage, § 53.101 hold) are drawn as gaps with their door, not guessed.
next: >
  Ship PR 1 (v2.3761) and PR 2 (v2.3768) after the live look; then PR 3 (the suit watch on
  the Dashboard, the Lien window header takes the strip). #33 §1
  (v2.3753, in flight) and §3 light the two dashed steps when they ship.
size: M
blocker: none — no migration, no stored rows; the two undated steps wait on #33, not on this.
ver: —
mockup: to-dos/lien-timeline/mockup.html — approved 2026-09-23
opinion: build — the desk is the office's lien tool and it cannot say where a job stands or when the lien dies; counsel asked for exactly this list, per job, "today".
---

# The lien timeline

**The ask (Grace, 2026-09-23):** "there should be an item in the to-dos to build a timeline of
the actions a lien should have" — there was none. The memo
([`../gc-failure-playbook/counsel-memo-2026-09-22.md`](../gc-failure-playbook/counsel-memo-2026-09-22.md),
*Timeline — run it separately on every job*) has the six steps as a table; #33 folds two of
them into its six pieces and never asks for the path itself.

## The Lien desk, reviewed at v2.3756

Read live on 2026-09-23 (17 notices, 3 affidavits, 6 missed) and in the fragments
v2.3412–v2.3747. What it does well: one pile per state, four gates in fixed slots, a months
card with *Mail by · N days*, the paper in place, one next step in the footer. What it cannot
say, per job:

| Step (Tex. Prop. Code) | Commercial · residential | Where the app has it | Gap |
|---|---|---|---|
| § 53.056 notice per unpaid month | 15th of the 3rd month · 2nd | Notices tab, GC run, forecast, Dashboard watch inside 14 d | — |
| § 53.057 retainage notice | 30 d after our contract ends | nowhere (rules guide: *not modeled*, v2.3420) | needs the contract-end date (#33 §1) |
| § 53.052 affidavit | 15th of the 4th month after the last month · 3rd | Affidavits tab, Lien window *File by*, Dashboard watch inside 21 d | the Lien window header ignores the creation fallback (v2.3747) |
| § 53.055 copy served | 5 d after filing | the Lien window stamps `serve_due`; a Dashboard card until *Record service* | not on the desk |
| § 53.101 owner's 10 % hold ends | 30 d after the original contract completes | only inside the printed § 53.254(g) words | needs the completion date (#33 §3) |
| § 53.158 suit | 1 year from the last day the affidavit could be filed | nowhere | no watch; *Filed · 30d* drops the job |
| Release of record when paid | — | the Lien window's Release tab, the release queue | the desk never says the clock stopped |

So the office sees the next notice in one pile and the next filing in another, and nothing
that reads *this job is at step 3 of 6, step 2 was missed, the lien dies Dec 15 unless…*.

## The proposal

One pure kernel, `lienTimeline.ts`, builds a job's dated steps from what the desk already
loads — the RPC rows (months, `month_source`, deadlines), `jobs_ledger.last_work_date`,
`customer_addresses.property_kind / homestead`, `job_lien_desk_items`, `job_lien_filings`
(`filed_at`, `serve_due`, `served_at`), `job_lien_releases` — and names one next step. It is
drawn three ways:

1. **The strip on the pane** — the pane's first line (*Jul notice by Oct 15* today) becomes
   the strip: last work → each month's § 53.056 → § 53.057 → § 53.052 → § 53.055 → § 53.158
   (or the release), today marked, one *Next* line under it. Nodes are done / due / missed /
   blocked / undated. An unknown kind shows commercial dates with the gate-3 words. The
   sticky strip (v2.3522) carries *Next*.
2. **The Timeline tab** — every billed job with money open and a lien month, one row each,
   the strip in miniature, sorted by next date; a GC filter; *Something due* as the default
   lens and *All* for the tail and the dead. A row opens the job on whichever pane its next
   step is. The count agrees with *Lien desk · N*.
3. **Print the grid** — counsel's twelve columns per GC, letter landscape; the three the app
   lacks (bond, paid-out, 10 % reserved — plus the contract-completion date) print blank with
   a footnote until #33 §3.

Plus the tail: `assessLienWatch` gains a fourth watch — a filed, unreleased, unpaid lien whose
suit deadline is inside 90 days — and the Lien window header shows the one-line strip
instead of its two dates (applying the creation fallback there at last).

## Is this the best we can do?

- **Strip alone?** No — the tail leaves the desk in 30 days and the suit clock is a year.
  The three parts are one design; PR 1 alone is a better header, not the timeline.
- **The memo's grid or something else?** The grid, twice: per job on the desk, per GC on
  paper, from one kernel so the dates cannot disagree.
- **Invented dates?** None. Two steps are dashed with the fact they need and its door; they
  are the frame #33 §1 and §3 slot into.
- **A calendar?** Rejected — dates are sparse and the question is *where does this job
  stand*, not *what is on the 15th*.
- **Job Detail / Pipeline?** The Lien window gets the compact strip in PR 3. Job Detail is
  long already; #34 covers the desk's doors on the Pipeline and is unchanged by this.
- **Taller pane?** One strip in place of one line; it can fold to its *Next* line.
- **Must not:** re-date a missed month (v2.3681), stamp a miss without a name (v2.3679),
  claim a stale month on the form (v2.3745), guess a kind (v2.3670). The strip reads those
  states; it never changes them.

## Where it plugs in

- Exists: `lienDeadlines.ts` (`statutoryFifteenth`, `filingDeadlineForMonth`,
  `serveDueForFiling`, `assessLienWatch`), `lienDesk.ts` (`buildLienDeskQueue`,
  `monthFromCreation`, `DATED_FROM_CREATION_WORDS`), `lienDeskAffidavits.ts` (gates, piles),
  `lienMonthHistory.ts` (sent / skipped / missed per month), `useLienDeskData`,
  `LienDeskModal.tsx` (header tabs at the `kind` switch, the pane's title line, the sticky
  strip), `LienInstrumentsModal.tsx` (the *Notice by / File by* header, `computeJobLienClock`),
  `useLienWatchNudge` + the Dashboard cards.
- New: `src/lib/jobs/lienTimeline.ts` + test; `LienTimelineStrip.tsx` (full and mini);
  the tab and its print view in `LienDeskModal.tsx`; the fourth watch; the guide
  `send-lien-notices-from-the-lien-desk.md` gains a *Where a job stands* section and
  `file-a-lien-and-never-miss-its-deadlines.md` names the suit watch.
- No migration. No stored rows. The § 53.057 and § 53.101 dates come with #33.

## The plan

1. **PR 1 (S)** — the kernel with tests (weekend roll, residential vs commercial, unknown
   kind, creation fallback, a missed month, a blocked affidavit on a sub job with no notice,
   filed → serve due → served, suit = filing deadline + 1 year, a release stops the clock)
   and the strip on the pane, both tabs. Guide section.
2. **PR 2 (M)** — the Timeline tab (the desk's rows + one query for filings and releases on
   billed jobs with money open), the GC filter and lenses, *Print the grid*.
3. **PR 3 (S)** — the suit watch on the Dashboard; the Lien window header takes the
   one-line strip.

## How to verify

Live on the desk (dev login, prod data): 273 Dudley (Lennox) — residential, Jul missed and
not noted, Aug awaiting approval, affidavit Nov 16 (Nov 15 is a Sunday); 650 ATI Schertz —
Jun closed, affidavit blocked, *Lien: gone*; 891 Take 5 — Jul + Aug on one notice, two dates;
864 Michael Palmer — kind unknown, dated from creation, owner missing. Compare every date to
the months card and the GC run's *Affidavit by*; they come from the same rules and must match.
The tail cannot be exercised live until a job is filed — the unit test carries it.

## Owner calls in the drawing

1. The tab's name — *Timeline* as asked; *Clock* and *Calendar* were considered.
2. Whether the § 53.101 hold-ends step belongs on the strip or only on the print.
3. *Counsel by* on the suit step is 90 days before the deadline — a default, not a rule.
