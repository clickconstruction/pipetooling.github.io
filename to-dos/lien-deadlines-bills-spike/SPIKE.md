# Lien desk → Deadlines: bills under each GC, by customer and address (design spike)

Spike notes, 2026-11-04. Not a card. Branch `claude/lien-deadlines-bills-170aad`, never merged;
whatever the owner likes is built as small PRs from fresh `main`.

Grace's ask (with a screenshot of Deadlines at desktop width, the job rows under *RMC- Dudley Mason /
628 Terrell Rd* boxed on the left and their money column boxed on the right): *"on the deadlines page in
the lien desk I think that we should do an additional sub group below each GC that shows all the bills
associated with one customer or one address. help me build a spike so I can evaluate if we should build
more in this direction?"*

## 1. What the data says (read-only, the live desk, 2026-11-04)

Read as the dev through the app's own REST session on the worktree's dev server (the dev-mcp key is
revoked and a superuser `psql` read is refused in auto mode). Everything below is what the signed-in
dev sees under RLS, the same rows the desk reads.

### What a "bill" is here

A bill is one `jobs_ledger_invoices` row with `status` `billed` or `paid` (a sent bill; `draft`/ready
rows are not bills yet). The desk's money on a job is what its sent bills still owe — `lienBilledOpen`
in `src/lib/jobs/lienBilledOpen.ts`, `lien_billed_open()` in SQL — never the job's price. Per bill:

| fact | where it comes from | notes |
|---|---|---|
| number | Stripe's number when known, else `fallbackInvoiceNumber(inv, hcp_number)` — `lienClaimBills` does this already | 19 of RMC's 20 bills live in Stripe |
| billed day | `billed_at` (the day on the bill); `sent_to_customer_at` is when it went out | 1 of 73 sent bills on the desk has no `billed_at` |
| amount | `amount` | |
| paid | the one payment rule (v2.5093): `attributeJobPayments` — linked payments in full, the job's unlinked money pays the unbilled part first, then the sent bills oldest first | job 273's four payments are all unlinked; the rule leaves its bills owing $16,685 |
| open | `max(0, amount − paid)`; a `paid` bill owes nothing | |
| the months it covers | **a bill carries no months.** The closest fact is `billed_at`'s month. The work months come from approved clock sessions (`list_lien_notice_months` / `useBilledLienClocks.workMonths`), the notice months from `job_lien_filings.months_covered` | so "a bill across two notices" is not a stored fact today |
| which § 53.056 notice names it | `job_lien_filings.invoice_ids` is the column meant for it — **it is empty on all 20 notice filings on the desk** (0 of 20 carry invoice ids; the run writes `months_covered` and `amount`, not the bills). The only link is by month: a bill billed in 2026-08 ↔ the notice whose `months_covered` holds 2026-08 | the spike matches by month and says so on the row |
| whether it is in a sent run | `job_lien_desk_items` (`status` sent / approved / missed, `months`, `sent_at`, `printed_at`, `sent_filing_id`), also per job and month, not per bill | |

All of this except the filing link is already in memory on the Pipeline: `JobWithDetails.invoices` and
`.payments` are loaded with the billed stage, and the runway (`LienPayRunway.noticeMonths`) already
carries each work month's notice state (sent / mailed / owed / closed). **Shape A and B need no new
read.** The notice-per-bill link would be one more read (`job_lien_filings` by job id) or, better, a
column the run writes.

### The desk's size

| | count |
|---|---|
| billed jobs on the Pipeline | 51 |
| … under a GC (sub jobs, the ones with a notice step) | 33, across 9 GCs |
| sent bills (`billed` + `paid`) on billed jobs | 73 (48 on sub jobs) |
| bills per job | 0: 2 · 1: 37 · 2: 4 · 3: 4 · 4: 4 — no job has more than 4 |
| § 53.056 notice filings | 20, none with `invoice_ids` |

So the biggest GC today draws 20 bill rows, and a GC with 30 bills is a near-future case, not a present one.

### RMC- Dudley Mason, the richest group

16 billed sub jobs (the desk lists 12 — four have no clock yet or their runway is `none`), $52,834 open
by job balance, **5 customers at 4 properties**:

| property (customer_addresses) | owner of record / customer | jobs | sent bills | bills open |
|---|---|---|---|---|
| 628 Terrell Rd, San Antonio — **two property records** (`2c49c941…` under the owner's customer, `bc9f4aac…` under the GC's) | Rizvi Syed Zulfiqar & Kizilbash Quratulain Fatima | 258, 608, 226, 790, 853, 863, 867, 890 | 9 (258: $8,000 paid + $9,800; 608: $6,220 paid + $2,245; 226 $650; 790 $1,712.50; 853 $595; 863 $1,049; 867 $1,710; 890 $285) | $18,046.50 |
| 9703 Lenox Hl, San Antonio — one record, five spellings of the typed address (`Lenox Hl`, `Lenox Hill`, with and without the zip) | Umar Khan | 273, 858, 866, 881, 1009 | 7 (273: $13,420 + $665 + $3,500 owing $16,685 after its unlinked payments; 858 $7,902; 866 $3,500; 881 $1,050; 1009 $350) | $29,487 |
| 1875 Co Rd 777, Devine | Bobby Urrabazo | 868, 1008 | 2 ($2,650; $1,050) | $3,700 |
| 233 Palomino Trail, Natalia | Billy & Sarah Garcia | 800 | 1 ($1,600) | $1,600 |

Customer and address are the same cut here: every property has exactly one customer (the owner), so
"by customer" and "by address" give the same four sub-groups for this GC. Across the desk the GC
*Knight Contracting* has one customer at three addresses, so the two cuts differ there.

Notices on RMC's jobs: 11 notice filings. Two batches by hand on 2026-10-06 (273, 858, 866, and 258 once
more by hand) covering Apr, Jun, Jul, Aug; one run on 2026-10-14 (258, 800, 853, 863, 867, 868, 890) —
258's second notice covers Apr–Aug, the rest August alone; 1008 and 1009 approved and printed 2026-10-08,
not sent (September). Desk items `missed` for 258's and 273's April–July months. **Bills and notices
line up by month only loosely:** the August notices (billed 2026-08-18/20) match; 273's $13,420 bill is
dated 2026-03-16 and no notice covers March; 226's $650 (billed 2026-08-24) has no notice at all because
its windows closed; 790's $1,712.50 (billed 2026-05-15) likewise.

What the group's totals look like: the GC header's $47,176 is the sum of the 12 listed jobs' balances;
the four sub-group totals above add to $52,834 because the spike also counts the four jobs the board
leaves off — the sub-group's bills total must be built from the **listed** jobs, or the column stops
adding up. The spike builds it from the listed jobs.

### Where the numbers would come from in a build

- Bills, paid, open: `lienClaimBills(job)` over `JobWithDetails` (already the Months card's rule) — in memory.
- Month of a bill: `billed_at` in the app's calendar (`calendarYmdInAppTzFromIso`).
- Notice per bill: today by month match against `runway.noticeMonths`; properly, `job_lien_filings.invoice_ids`
  stamped by the run (`lienDeskRunIo`) and by `recordLienNoticeByHand` — a small write change, no migration
  (the column exists).
- Sub-group key: `customer_address_id` when linked, else `lienAddressKey(address)`, unioned by
  `lienSameProperty` so the two Terrell records and the five Lenox spellings fold to one each; the customer
  name beside it. The board's own `placeOverdueWithProperty` uses the same rule.

## 2. What the spike builds

On this branch only, behind a DEV-only toggle on the Deadlines toolbar (*Spike · bills: off · shape A ·
shape B*, remembered in `localStorage.lienSpikeBills`; a production build never draws it).

| piece | where |
|---|---|
| kernel: bills per job (`lienClaimBills` + month), the notice a bill's month maps to, the property sub-groups (union by `lienSameProperty` and the address key), the words, shape B's marks | `src/lib/jobs/spike/lienBillsSpike.ts` + `lienBillsSpike.test.ts` (5 tests) |
| the board's pieces: the toggle, the property heading, shape A's nested table, shape B's mark layer and money line, the phone list | `src/components/jobs/spike/LienDeskBillsSpike.tsx` |
| wiring | `JobsStagesTab` builds the map from the jobs it already holds (one memo, one prop); `LienDeskModal` passes it through; `LienDeskCalendarTab` takes the prop, keeps the toggle, and under a GC group renders the property sub-groups in place of its flat rows — `JobRow` takes two spike props, `PhoneBoard` the same |

No read was added. No write. `lienDesk.ts`, `lienNextUp.ts` and the Do now components are untouched. The desk's
existing render tests (30 + 5 + 83) pass with the toggle off, which is the only state they see.

### The screenshots (`shots/`, RMC- Dudley Mason, 2026-11-04)

| | 1,400 wide | 375 wide |
|---|---|---|
| **A** nested table | `A-1400-light.png`, `A-1400-dark.png` | `A-375-light.png` + `-2` (the bills list), `A-375-dark.png` + `-2` |
| **B** marks on the job's row | `B-1400-light.png`, `B-1400-dark.png` | `B-375-light.png` + `-2`, `B-375-dark.png` + `-2` |

Taken headless (Chrome through Playwright) because the app's window was not on screen; the desk is the real
one on the live rows, signed in as the dev.

## 3. The read

### What each shape says that the desk could not

**Both.** The GC's twelve rows fall into four properties, each with its owner's name and its count of jobs and
bills, and a total in the money column that the job rows under it add up to — the thing Grace boxed. Today
the board draws an address sub-heading only when an overdue job is parked with its property (v2.4526); the
spike draws one for every property, so *628 Terrell Rd* and *9703 Lenox Hill* read as two matters under one
GC instead of twelve rows. The paid bills show up for the first time on this board ($14,220 paid at Terrell).

**A — the nested table.** Every sent bill is a line: number, job, billed day, the notice that names its
month, where it sits on the ruler, and what it still owes. The claim adds up in front of you (ten lines →
$18,047), and the gaps are readable at a glance: 890's $285 bill is dated **Jul 15** while its notice covers
**August** (*no notice names Jul*); 608's second bill, $2,245 billed Aug 20, has **no notice at all** because
its windows closed; 273's $13,420, the biggest number under this GC, was billed **Mar 16**, four months
before anything was noticed, and sits parked at the left edge with a ◂. None of that is visible on the
desk today without opening each job's Lien window and reading its Months card.

**B — marks on the job's row.** The bill's day lands on the same ruler as the notice flag and the lien flag,
so the row now reads *billed → noticed → lien day* as one line: 258's $9,800 went out Aug 20, its August
notice was recorded Oct 14, the lien day is Nov 16. The money column says per job how many bills, how many
paid and what is open. Nothing else is added; the rows grow by one small line. What B cannot say is the
per-bill number or the notice-per-bill words — those are the hover (the mark's title carries them).

### What each costs

| | A | B |
|---|---|---|
| reads | none new | none new |
| rows under RMC (12 jobs listed) | +4 property headings, +4 table heads, **+18 bill rows** → the block is ~3× taller with every table open | +4 property headings; each job row +10 px |
| whole board, every GC open | 18 property headings, 45 bill rows beside 45 job rows | 18 property headings |
| scroll on a phone | the bills list under each property is as long as the jobs list | one extra line per job |
| compute | `lienClaimBills` builds a physical-invoice model per bill to print its number (73 bills today — fine, heavier than it needs to be) | the same map, no extra |

### What breaks

- **A GC with 30 bills.** A's table under one address is 30 lines; with the tables open by default the GC's
  block becomes a page of its own and the *This month* bar scrolls away from its rows. The fold handles it
  only if the tables start **folded** with the count and the open sum on the heading. B does not break, but
  bills days apart share a pixel: 273's two Aug 21 bills are one mark; a job with monthly draws would show a
  row of diamonds that needs the cluster card (`lienMarkClusters`) the flags already use.
- **A job with no bills.** A says *No bill sent on these jobs yet*; B says *no bill sent* under the money; the
  heading counts *1 with no bill*. Fine. But a job **billed as one shell** (status billed, no invoice row) gets
  `lienClaimBills`'s synthetic bill named by the HCP number, and a bill at `sequence_order` 0 is named the
  same way (`fallbackInvoiceNumber`) — so the table shows **#608 on job 608, #790 on job 790, #890 on job 890**,
  which reads as the job number, not a bill. A build prints Stripe's number (the desk already fetches
  `StripeInvoiceFacts` for the Months card) or plain *bill 1*.
- **A bill across two notices.** Not a stored fact: a filing carries months, never bills (0 of 20 have
  `invoice_ids`). The month match picks one month → one state; a bill billed in a month two filings both
  cover (258's August is on the by-hand notice **and** the run's) shows *on file* with no way to say which.
  Stamping `invoice_ids` when the run sends and when a notice is recorded by hand turns this into a list;
  the column exists, so no migration.
- **Bills before the ruler starts.** The axis opens 21 days before today (90 at most for a dead row); a bill
  from March sits at the edge with a ◂ and its day in A, and as a mark on the edge with no day in B. On a board
  about the next 15ths that is right, but the biggest old bill is then the least visible.
- **Two property records for one address.** 628 Terrell has one record under the owner's customer and one
  under the GC's; the spike folds them by address text. *9703 Lenox Hl* / *Lenox Hill* fold only because the
  five jobs share one record; a job typed differently with no record would stand alone under its own heading.
  The real fix is the duplicate-record finder, not this board.
- **The heading's total.** It is the job balances (so the column still adds), and says *$X on the bills* only
  when the sent bills owe less than the jobs' balances — unbilled work. Under RMC the two agree on every
  property today.
- **The v2.4526 address sub-heading** is replaced by the spike's heading under a GC (same words, more facts);
  the *Direct* and *Lien gone* groups keep the flat rows, since the ask was under each GC.

### Recommendation: B, with A's table as a fold the reader opens

Build the property sub-groups and shape B. The Deadlines board is a board of dates; the one fact about a bill
the board could never say is *when it went out* against the flags, and B says it on the row the office already
reads, for no new read and one small line per job. A says everything, and says it three times taller — the
per-bill numbers already live on each job's Lien window (the Months card lists exactly these lines), so A on
the board repeats them for every GC at once. Where A earns its place is on demand: the property heading's
*10 bills* becomes a fold that opens the table (A, folded by default), for the day the owner wants to see a
claim add up without opening eight windows. Neither shape should ship until the run stamps `invoice_ids`;
until then the notice words per bill are a guess by month, and the desk should not print a guess beside a
§ 53.056 notice.

### The calls that are the owner's

1. Group a GC's rows by property always, or only when the GC has more than one property (a one-property GC
   gains a heading that repeats the GC line)?
2. Customer or address as the cut — the same under RMC, different under Knight Contracting (one customer, three
   addresses). The spike cuts by property and prints the customer on the heading.
3. Paid bills: on the board (the claim adds up) or off it (the board is about what is owed)?
4. The bills table: a fold on the heading (recommended), open by default, or not on the board at all?
5. Stamp `invoice_ids` on the notice at send time, and backfill the 20 filings by month, or keep the link by
   month and say so?
6. Shape B's line under a job's money on the phone: keep, or drop at 375 where it is the fourth line of a row?

### The build, as small PRs from fresh `main`, if he says go

| PR | what | kernels / reads / docs |
|---|---|---|
| 1 | **Property sub-groups under a GC** — the heading with customer, jobs, bills, and the total in the money column; fold per property; phone too. No bills drawn yet. | `src/lib/jobs/lienDeadlinesProperties.ts` (from the spike's `spikePropertyGroups`, over `lienSameProperty`), tests; `LienDeskCalendarTab` + `PhoneBoard`; the bills count needs PR 2's map or a count alone (`job.invoices` is already on the row's job). Guide: `src/content/help/see-what-is-due-on-the-lien-calendar.md` gains *Each GC's jobs sit under their property*; `docs/LIEN_DESK_ARCHITECTURE.md` region K amended; release note + fragment. |
| 2 | **The bill marks (B)** — `JobsStagesTab` hands the desk a bills map built from `job.invoices`/`payments` (a lighter number than `lienClaimBills`: Stripe's number from the facts the desk already reads, else *bill N*); the mark on the row, the line under the money, a *Bill sent* entry in the key, the mark's hover card through `lienMarkCards` (clusters included). | `src/lib/jobs/lienDeadlinesBills.ts` + tests; `lienCalendar.ts` gains a `bill` mark kind so `lienMarkClusters` folds it with the flags; render tests for the row and the card; guide + fragment. No read, no migration. |
| 3 | **The notice names its bills** — `lienDeskRunIo` (the run's send) and `recordLienNoticeByHand` write `job_lien_filings.invoice_ids` = the sent bills the claim counted; a one-off script backfills the 20 filings by month; the desk's bill words read the list (*on the Oct 14 notice*) and fall back to the month. | `lienDeskRunIo.ts`, `lienNoticeByHandIo.ts`, a kernel for *which bills a notice claims* (the Months card's `lienClaimBills` owing > 0 at send time); `scripts/` backfill; `docs/LIEN_DESK_ARCHITECTURE.md`; **no migration** (column exists); fragment. |
| 4 | **The bills table on demand (A, folded)** — the property heading's *N bills* opens the table; phone list. | the spike's table component made real, under the key the heading already has; guide + fragment. Only if the owner wants it after seeing PR 2 live. |

Nothing here touches the Do now view, `lienDesk.ts` or `lienNextUp.ts`. No migration and no edge function in
any PR; PR 3 is the only write, and it writes a column that already exists.
