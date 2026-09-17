---
name: Job accounts on the Bid Board
group: ready
status: PR 1a built 2026-09-16 (v2.3520 — the won row's chips and the Won header count) · PR 1b (the lens + one email per house) and PR 2 (strip steps 11–12) not started
summary: >
  **Job accounts on the Bid Board**: chips on the won row, steps 11–12 *Job opened* / *Job
  accounts* on "Where this bid is", a Job accounts lens sorted by first parts run and grouped by
  house, and one email per house covering several properties. Mock-up in the folder.
next: >
  PR 1 the batch hook, the row chips, the BidsJobAccountsLens and the multi-property email
  composer; PR 2 the bid-flow steps 11–12 in a new Won phase.
size: M (2 client-only PRs)
blocker: None. Decisions were taken 2026-09-14.
ver: PR 1a v2.3520
---

# Job accounts on the Bid Board — the row, the strip, the lens, one email per house

## The ask, in the owner's words

"How could an estimator manage job accounts from the bidboard?" (2026-09-14), after the estimator lane shipped the tools inside Edit Bid's Job block. Then "show me mockups", then "I like all of this, save it to the to-dos".

## The decision

Bring the job-account tools to the board using the three devices it already has, plus one batch email:

1. **The won row carries the chips.** Under the won GC pill and "J#### · open →", once a job exists: `Ferguson · asked` · `Moore Supply` · `Reece · quoted` and a "…" door to the Job accounts question. A won bid with no job yet reads *after the job is opened*. One `list_bid_job_account_strip` call for the page's won bids.
2. **Two steps on "Where this bid is".** Step 11 *Job opened* and step 12 *Job accounts* in a new **Won** phase. Step 12's proxy: done when every house that quoted the bid or expects an account is open or not needed; next when the job exists and a house is missing (the pill names it); untracked before the job. Its door is a new kind, `accounts`, opening the Job accounts question for the job.
3. **The Job accounts lens** beside Waiting to hear / Why we lost / Forecast: every won bid with a job missing an account, soonest first parts run first (`bids.estimated_job_start_date`), grouped by house, bidder named, a Mine toggle, Mark opened / Not needed per row, the count on the Won pill's line.
4. **One email per house across properties.** From a house's group: *Ask Curly for all three* drafts one numbered note listing each property with its own GC contact (from `fetchBidPacketFacts`), from the estimator's inbox; *Sent — log all three* marks each job `requested` and writes a send-log row per job with its bid.

Decisions taken by default on 2026-09-14 (the owner said yes to the page as drawn): won bids with no job yet **do** appear in the lens with *open the job first* as their only action; one email **does** cover properties with different GCs (numbered blocks, each with its GC); the lens shows **everyone's** rows by default with a Mine toggle.

Rejected: a plain filter on the main list (a lens has its own sort and actions); anything showing money (estimators read no invoices or balances — the RPC returns existence and status only).

## The mock-up

**Before / after, drawn from the real screen** (also on the design canvas https://claude.ai/artifact/JHb3f7Tr7LVPfjMg6sdNLf): [`before-after-pr1b.html`](./before-after-pr1b.html) — PR 1b, the Job accounts lens grouped by house and the one-email-per-house composer, drawn 2026-09-16 on the board as it is after PR 1a.

[`mockup.html`](./mockup.html) — four screens (also published as the artifact *Job Accounts on the Bid Board*).

## Where it plugs in

| Exists | New |
|---|---|
| `list_bid_job_account_strip(uuid[])` (v2.3451) — batch by bid id; returns the linked job, houses that expect / quoted / hold, status, rep | none on the server |
| `BidJobAccountsRow` + `useBidJobAccountStrip` (v2.3451/54) — the chips and Mark opened, per bid | a page-level batch hook (one call per won-row set) and a compact chip cluster for `BidBoardGcRows` beside the won pill / "open the job →" |
| `JobFormModalContext.openJobAccountsPrompt(jobId)` — the "…" door | — |
| `src/lib/bids/bidFlow.ts` — `BID_FLOW_STEPS`, `evalStep`, `BidFlowDoor`; `BidFlowStrip.tsx`; `openBidFlowDoor` in `Bids.tsx` | steps 11–12 with a `Won` phase, a `BidFlowFacts` input for the accounts (from the batch hook), the `accounts` door |
| `BidsWaitingToHearLens.tsx` / `BidsForecastLens.tsx` — lens pattern, Mine toggle, the lens bar in `BidsBidBoardTab.tsx` | `BidsJobAccountsLens.tsx` + kernel `src/lib/bids/jobAccountsLens.ts` (rows from the RPC output + bids' start dates; grouping by house; sort) |
| `composeRepEmail` in `src/lib/jobs/jobAccountRepEmail.ts`, `fetchBidPacketFacts`, `JobAccountRepEmailSheet` (single property) | a `properties[]` form of the composer (numbered blocks, joined start weeks; the single note is the one-item case) and a multi-job "Sent — log all" that upserts one `requested` row per job and one send-log row per job |
| The Won pill's count line in `BidsBidBoardTab.tsx` | "N missing job accounts" |

## The plan

**PR 1a shipped v2.3520** — the page-wide read (`useBidBoardJobAccountStrips`, one RPC call for the Won section), the compact chips under the won GC line with Mark opened and the "…" door (`BidBoardJobAccountChips`), and the Won header's "N missing job accounts" count. The row's read is kernel-tested in `src/lib/bids/bidBoardJobAccounts.ts`. What follows is the rest of PR 1 as planned:

1. **The row and the lens** (client-only): the batch hook; the compact chips on the won GC line with Mark opened and the "…" door; the lens with by-house groups, the per-house email (multi-property composer, tests), Mark opened / Not needed per row, Mine, the Won-pill count. Release note + fragment; guide *open a job account when you win a bid* gains "From the board".
2. **The strip steps** (client-only): steps 11–12, the proxy rule (tests in `bidFlow.test.ts`), the `accounts` door. Same guide, one paragraph.

## How to verify

- Dev login (Robert) → Bids → Bid Board → search `SPACEX`: the won row shows the chips for J1007 (Ferguson · asked from the 2026-09-14 tests may already be cleared — expect three `none yet`), the "…" opens the question. People → Users → **Imitate** Wendi (estimator): the same row and chips; a chip → Mark opened writes under her RLS (delete the row afterwards via the REST recipe in the memory note; **Exit (Wendi)** restores the dev).
- The lens: with the SpaceX and Pondhill jobs present, expect rows sorted by start date, grouped under Ferguson / Reece / Moore; "Ask Curly for all" opens the numbered note; do **not** send from a real inbox — Copy for email, then *Didn't send it*.
- The strip: open the b398 row; steps 11–12 read done / next per the proxy; step 12's pill names the missing house; its door opens the question.
- Gotchas: an estimator's Job block still reads "Open the job" when a job exists (its own lookup reads `jobs_ledger`; the accounts row beneath is right — fix by trusting the RPC's job when the lookup is empty, small); Curly's contact has no phone on file, so Call stays hidden until the office adds one.
