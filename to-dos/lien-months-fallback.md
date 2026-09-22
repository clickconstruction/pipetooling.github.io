---
name: URGENT · Lien notices — a job with no clock hours falls back to its creation month
number: 32
group: ready
status: found 2026-09-22 on RMC- Dudley Mason (Taunya) · not started
summary: >
  The lien desk and the "Put a GC on notice" run only name a month when the job has approved
  clock hours in it. A job with no approved sessions has no month, so it is silently left out
  of the notice — RMC- Dudley Mason shows $84.6k open on the Pipeline and $54,850 in the run
  because 14 billed jobs (about $45k, the largest $17,600) carry no hours. Owner's ruling: a
  bug. Those jobs stay in the list; the fallback month is the day the job was created.
next: One migration that gives every lien-month RPC the fallback, the kernels and rows that say "dated from the job's creation", the live re-run on Dudley.
size: M
blocker: none
opinion: build now — money is falling out of notices that are about to be mailed
mockup: not required — a rule change; the row gets one line of wording
---

# Lien notices: the creation-month fallback

**The report (Taunya, 2026-09-22):** searching the Pipeline for Dudley shows $78.4k billed
(the board read $84.6k across 20 jobs an hour later as jobs moved); *Put RMC- Dudley Mason on
notice* claims $54,850 across 6 jobs.

**The owner's ruling (2026-09-22):** "this is a bug, those amounts should still be in the lien
list with the day of their job creation as a fall back."

## What the code does today

Every lien reader builds a job's months from **approved clock sessions** and drops the job
when there are none:

| RPC | Latest definition | Feeds |
|---|---|---|
| `list_gc_unpaid_months(p_gc_customer_id)` | `supabase/migrations/20260915142556_list_gc_unpaid_months.sql` | the GC run (`useGcOnNoticeData` → `src/lib/jobs/gcOnNotice.ts` → `GcOnNoticeModal`) |
| `list_lien_notice_months(p_within_days)` | `supabase/migrations/20260921203000_lien_notice_months_restore_window.sql` | the Lien desk queue (`useLienDeskData` → `src/lib/jobs/lienDesk.ts`) |
| `list_lien_affidavit_windows(p_within_days)` | `supabase/migrations/20260914190000_lien_desk_affidavits.sql` | the affidavit windows on the desk |
| `list_jobs_owner_to_confirm()` | `supabase/migrations/20260914270000_owner_auto_confirm_switch.sql` | the owner-confirm list (`first_work_month` orders it) |

The pattern in each: a `months` CTE over `clock_sessions` where `approved_at IS NOT NULL AND
rejected_at IS NULL AND revoked_at IS NULL AND clocked_out_at > clocked_in_at`, grouped by
`to_char(work_date, 'YYYY-MM')`, then an inner join back to the job — so a job with zero
approved sessions has zero rows and vanishes. The job filter itself is right (status in
waiting / working / ready_to_bill / billed, `revenue − payments_made > 0`, and for the GC run
`gc_customer_id = p_gc_customer_id`).

## The evidence (2026-09-22, as a dev, search "Dudley")

In the run, all six with approved hours: 273 $17,585 · 651 $13,170 · 706 $11,000 (unbilled
contract balance) · 258 $9,800 · 608 $2,245 · 881 $1,050 = $54,850.

Out of the run, every one "No hours" on its Pipeline row:

| Job | Open | Stage |
|---|---|---|
| 372 · Dudley Mason, 1780 FM 1343 Castroville (Dan Turk) | $17,600 | billed |
| 858 · Service visit, 9703 Lenox Hl | $7,902 | billed |
| 186 · Dudley Mason, 574 Co Rd 660 | $6,200 | billed |
| 866 · Omar Khan- Lennox | $3,500 | billed |
| 868 · Service visit, 1875 Co Rd 777 | $2,650 | billed |
| 867 · Service visit, 628 Terrell Rd | $1,710 | billed |
| 800 · Service visit, 233 Palomino Trail | $1,600 | billed |
| 1008 · Trip charges | $1,050 | billed |
| 863 · Service visit, 628 Terrell Rd | $1,049 | billed |
| 226 · Dudley Mason | $650 | billed |
| 853 · Service visit, 628 Terrell Rd | $595 | billed |
| 1009 · Lenox check PU | $350 | billed |
| 890 · Dudley Mason | $285 | billed |
| 436 · Dudley Mason Ongoing | $15,750 | waiting (contract balance) |
| 305 · Dudley Mason | $15,400 | waiting (contract balance) |
| 790 · Dudley Mason-Terrell Rd | $1,713 | collections |

798 (working, 16 h 46 m) is out for a different reason — no open balance — and stays out.

## The rule to build

- **A job with approved sessions keeps its months from the sessions**, exactly as now.
- **A job with none gets one month: the month of `jobs_ledger.created_at`** (company calendar,
  the app's Denver day key — the same `to_char(..., 'YYYY-MM')` shape the sessions use), with
  `approved_hours = 0` and a new column **`month_source`** = `'hours'` | `'job_created'`.
- The fallback month goes through the same `lien_notice_deadline(month, property_kind)` as a
  real one. An old job's creation month will often be **closed** — the desk already names a
  closed month as information ("its lien is gone, the owner still learns the balance"), so the
  job appears, the balance is claimed, and the row says so. Nothing is hidden.
- `last_work_month` / `first_work_month` = the fallback month for such a job.
- Never both: sessions present → no fallback row.

## Where it plugs in

1. **One migration**, `SET lock_timeout = '3s';`, `CREATE OR REPLACE` all four RPCs with a
   `months` CTE that UNIONs the fallback (`SELECT j.id, to_char(j.created_at AT TIME ZONE
   'America/Denver', 'YYYY-MM'), 0::numeric, 'job_created' FROM jobs j WHERE NOT EXISTS (… an
   approved session for j)`), the hours rows carrying `'hours'`. Number it from
   `origin/main`'s latest file (`20260922190000_…` today) and register it with
   `npm run claim -- --migration <file>`; write `docs/migrations/<version>_<slug>.md`. No new
   table, so no read-only sweep calls.
2. **Kernels** `gcOnNotice.ts` and `lienDesk.ts`: carry `monthSource` on the month and on the
   job (`datedFromCreation: boolean`); tests for a job with no sessions (one month, hours 0,
   dated from creation; closed when old) and for a job with sessions (unchanged).
3. **Rows and paper**: the GC modal's row and the Lien desk row say *dated from the job's
   creation · no clock hours* under the month; the notice itself names the month as it names
   any other (the statute wants the month the work was furnished — the office's call that
   creation stands in for it is recorded on the item like the claim correction is, v2.3682:
   `month_source` saved on the desk item / filing so the paper trail says where the date came
   from).
4. **The Needs You lien card and `journey_health_counts`** read the same RPCs — no change, but
   confirm their counts move with the new rows.
5. Release note (kind: fix) + `docs/recent-features/` fragment; update the help guide
   *send lien notices from the lien desk* (one paragraph: what a job with no hours does); the
   lien section of `docs/GLOSSARY.md`; `docs/EDGE_FUNCTIONS.md` untouched (no function changes).

## Verify

- Unit: the four kernels' fixtures gain a no-sessions job.
- Live, as a dev: Pipeline → search Dudley → Pipeline tools → *Put RMC- Dudley Mason on
  notice…*: the run lists **22 jobs** (6 + the 16 above), the header total ≈ $54,850 + $45,141
  billed + $31,150 unbilled; 372's row reads *dated from the job's creation*; old rows show
  their month under *Also named · window closed*. Do not send: close the modal.
- Lien desk queue: the same jobs appear with the same wording; the Needs You lien card's
  count and dollars change accordingly.
- `npm run check:migration-drift` after the push.
