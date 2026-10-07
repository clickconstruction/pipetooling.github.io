---
name: "Collections: a bill the office has given up on — stamped, out of every total, off the Lien desk"
number: 94
group: gated
status: planned 2026-10-06 from the owner's ask; mockup beside it; nothing built. Waits on the owner's go and four calls (below).
summary: >
  Some bills will never be collected. Today they sit in Collections forever, counted in the Collections
  total, the Pipeline's In collections tile, the Dashboard's Collections section, the Lien desk's queues
  and the Legal desk's rail. The owner wants a space in Collections where such a bill no longer touches
  any "what is coming in" number, with the reason plastered over the row so anyone who looks sees what
  happened — and once marked, off the Lien desk and out of every "what we could collect" figure.
next: >
  The owner reads the mockup and answers the four calls; then PR 1 (the columns, the RPC, the trigger)
  cuts from main and the train runs in order.
size: M — six PRs, S each
blocker: >
  The owner's go on the design and the four calls: the word on the button, who may do it, whether
  Stripe's invoice is marked uncollectible too, and whether the customer's payment terms get a nudge.
---

# Collections: a bill the office has given up on

**The ask, in the owner's words (2026-10-06):** *some bills are uncollectible and I would like to put them in a space in collections where they no longer affect our accounts receivable metrics and the reason is clearly plastered over the row like graffiti so anyone who goes sees clearly what happened … once it is marked uncollectable it should not show up in the lien desk or metrics of what we could collect (accounts receivable) so that we can always have an understanding of what is coming in to offset our balances.*

**The mockup:** [`mockup.html`](./mockup.html) — the Collections section before and after, the window, the phone card, the money story and the Dashboard card, and the "is this the best we can do" list.

## What exists today, and why none of it is this

- **Collections** is a flag on a `billed` job (`jobs_ledger.collections_at/by/note`, `set_job_collections_flag`, Glossary → *Collections*). Its money is already out of the AR headline but **in** Owed, the *In collections* tile, the Dashboard's Collections section, the Lien desk, GC on notice, retainage, the affidavit list and the Legal desk's rail.
- **The agreed write-down** (`apply_agreed_write_down_to_billed_invoice`, the Legal desk's *write it down*) shrinks a bill to a number the customer agreed to and issues a Stripe credit note. Nobody agreed to anything here; the bill must stay what it was.
- **The Legal desk's `uncollectible` end** closes a *matter* the firm held. It changes nothing on the job: the row keeps counting. And a $250 inspection never goes to a firm.
- **Mark Paid / Send back to Billed / delete the bill** each lie to the ledger.

## The decision

A second flag on the job, the same shape as Collections, one step further:

- **`jobs_ledger.uncollectible_at / uncollectible_by / uncollectible_reason`** (the reason required). Status stays `billed`; the Collections flag stays set (it is a sub-state of Collections).
- **`set_job_uncollectible(p_job_id, p_flagged, p_reason)`** — the Collections managers' pool (dev · master_technician · assistant · controller, the owner may narrow it), the job must be `billed` and in Collections, a reason of at least a sentence when flagging, idempotent, one `job_activity_events` row (`uncollectible_change`, financial) each way. The clear-on-paid trigger that already drops the Collections flag drops this one too, with the same event (`detail.auto = true`).
- **Where it shows:** the row stays in Collections, in a band at the bottom — **Given up on · n · $** — with its own count and dollars; the Collections header counts only what is still chased. On the row: the money struck through, the row faded, and a red tilted **stamp** across the money cell — the word, the reason, who and when, the dollars (`collectionsNoteLine` already prints the Collections note under the money; the stamp is its loud sibling). On the phone card: an UNCOLLECTIBLE pill and the reason as the second line.
- **Doors:** *Give up on it…* under a Collections row's icons (beside *Send back to Billed*) opens the typed confirm; *Put it back in Collections* on a given-up row reverses it; Mark Paid keeps working and the trigger clears the stamp when the job pays in full.
- **What stops counting it:** bill truth gets an `uncollectible` bucket (rows on flagged jobs), reported like `excludedOwed` and **out of** `collections` and `owed` — so the Pipeline tile, the Dashboard card, Quickfill, the Hub strip and the Customers list all follow from one kernel. The tile and the card show the given-up dollars in grey under the number, never summed.
- **Off the desks:** `list_lien_notice_months`, `list_lien_affidavit_windows`, `list_lien_retainage_windows` add `AND j.uncollectible_at IS NULL`; the client calendar (`lienCalendar` over the board rows), GC on notice and the owner-records picker skip the flag. The Legal desk lists the account under *Given up on* at the rail's foot, read-only, no packet; closing a matter `uncollectible` from the desk sets the job's flag through the same RPC, and giving up on a job whose matter the firm holds warns first.
- **Still on the books:** nothing deleted, no bill rewritten, no credit note. The band's right end carries the year's given-up total and **the accountant's list** (Settings → Reports: every given-up bill by year with its reason — bad debt is a deduction the office has never been able to name).

## Is this the best we can do?

- *A seventh status?* Touches every trigger, report and send-back; the flag has worked for Collections for a year. No.
- *Inside Collections, not a seventh section?* The owner asked for a space in Collections; a new section means a strip chip, a map colour, a section pref, a deep link and a header. A band at the bottom costs none of that and keeps "given up" one scroll from "still chasing".
- *Job-level, not bill-level?* Collections is job-level and the row the office reads is the job's. A job with one live bill and one given-up bill is rare; the reason can name the bill. Bill-level is the fallback if the first month proves otherwise.
- *What it adds beyond the ask:* the accountant's list, the self-clearing stamp, and the Legal desk hand-off so nothing is given up behind the firm's back.
- *Where it could still be wrong:* the stamp's hand-written face is a system font (Marker Felt / Bradley Hand / Segoe Print); on a machine with none it falls to cursive, still red and tilted. The band's "this year" total needs the flag's date, which is why the date is a column and not a note.

## The owner's four calls

1. **The word on the button:** *Give up on it…* (the mockup) · *Write it off…* · *Uncollectible*. The stamp says UNCOLLECTIBLE either way.
2. **Who may do it:** the Collections managers (today's pool), or a dev and the controller only.
3. **Stripe:** also mark the bill's Stripe invoice uncollectible (closes the pay link; Stripe still accepts a late payment and the webhook would then pay the job and clear the stamp), or leave Stripe alone.
4. **The customer:** a customer with a given-up bill gets a payment-terms nudge (*Deposit required*) on the next job, or nothing.

## Where it plugs in

| Piece | Exists | New |
|---|---|---|
| Columns + RPC + trigger | `collections_*`, `set_job_collections_flag`, `jobs_ledger_clear_collections_on_paid` | `uncollectible_*`, `set_job_uncollectible`, the trigger widened |
| Bill truth | `supabase/functions/_shared/billTruth.ts` (`billed` / `collections` / `owed` / `excludedOwed`) | `uncollectible` bucket; `collections` and `owed` skip it |
| Board | `buildJobsStagesBoardLists` (`collectionsRows`), `stagesSectionHeader`, `StagesUnifiedInvoiceRow` / `StagesUnifiedJobRow`, `collectionsNoteLine` | `givenUpRows` split, the band, the stamp, the two doors, the confirm window |
| Phone | `jobNextLine`, `StagesPhoneRow` | the pill and the reason line |
| Money story + Dashboard | `pipelineOverview.ts` (`in-collections`), `DashboardFinancialsSection` (`arCollectionsSection`), `dashboardFinancials.ts` | the grey given-up line |
| Lien | the three `list_lien_*` RPCs, `lienCalendar.ts`, `GcOnNoticeModal`, `ownerRecordsDesk.ts` | one predicate each |
| Legal | `legalPacket.ts` accounts, `legal_close_matter`, `LegalDeskModal` rail | the *Given up on* group; the end sets the flag |
| Accountant | — | Settings → Reports → *Given up on* (by year, with reasons); CSV |

## The plan — six PRs, smallest first

1. **Columns, RPC, trigger, types** — migration (`SET lock_timeout`, idempotent), `docs/migrations/<version>_job_uncollectible.md`, regenerated `database.ts`; `setJobUncollectible.ts` client; kernel tests on the activity words.
2. **Bill truth** — the `uncollectible` bucket and every reader: Pipeline tile, Dashboard card and drill-down, Quickfill, Hub strip, Customers list; the grey given-up lines. Kernel tests pin `owed` excludes it.
3. **The board** — `givenUpRows`, the band, the stamp (desktop row + phone card), *Give up on it…* with the required reason, *Put it back*, the Collections header's narrowed count. Render smokes: the stamp reads the reason; the header excludes the row.
4. **The desks** — the three lien RPCs' predicate, the client calendar, GC on notice, owner records; Lien desk smoke: a given-up job is on no pile.
5. **Legal** — the *Given up on* group in the rail, the matter end sets the flag, the warning in the confirm when the firm holds the account.
6. **Words and the accountant** — help guide (`give-up-on-a-bill-you-will-never-collect`), Glossary, `ACCESS_CONTROL.md`, `BILLING_FLOWS.md`; Settings → Reports → *Given up on* with the yearly total and CSV.

## How to verify

Dev login, Jobs → Pipeline → Collections, a ZZ TEST job billed and flagged to Collections: *Give up on it…* with a reason; the row drops into the band stamped; the Collections header, the *In collections* tile, the Dashboard card and the Lien desk count no longer carry it; Mark Paid on it pays the job and the stamp is gone; *Put it back* restores it; the job's activity thread holds both moves with the reason.
