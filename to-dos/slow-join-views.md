---
name: "Two more views join through a COALESCE onto a table with row policies: agreements_on_file and people_hours_recorded"
number: 430
group: ready
status: found 2026-11-21 by the #306 thread while fixing the Photos tab's statement timeout (v2.8301) · neither view measured · the card written 2026-11-23 on the owner's word of 2026-11-23 to the overnight main session (the hand-off's permission 10, "writing the card", not the fix)
summary: >
  Documents → Photos timed out because its view found a job with a join written as an equality
  onto a COALESCE. Postgres will not use such a clause as an index condition on a table with row
  policies, so it walked the whole table under its policies once per outer row. That one was
  fixed. The thread that fixed it saw the same shape in two other security_invoker views and
  changed neither: agreements_on_file joins three party tables that way, and people_hours_recorded
  joins the pay config that way. Neither has been measured. This card holds them so the measure
  and the fix are done once, on purpose, and not found again by a timeout.
next: Measure each view's plan on production as a dev, read only, with EXPLAIN (ANALYZE, BUFFERS) on the read the app makes. Then one migration each, only where the plan shows the whole-table walk.
size: S · S, after the measure
blocker: none
opinion: measure first — a view that reads in a few hundred milliseconds today is not worth a migration, and a view that walks a table under its policies will time out the day the table is big enough, as the Photos tab did
---

# Two more views join through a COALESCE (#430)

## Where this came from

On 2026-11-22 the live walk of punch list #306's PR 9 found Documents → Photos answering *The photos
did not read: canceling statement due to statement timeout* on its first screen. The view behind it,
`uploaded_photos`, found the job behind a text's picture with `j.id = COALESCE(m.jobs_ledger_id,
gp.billing_job_id)`. Postgres uses a join clause as an index condition on a table with row policies
only when it can prove the clause leaks nothing, and it does not prove that of a `COALESCE`, so the
join walked every job under its policies once per picture. The fix, v2.8301
(`20261122063000_uploaded_photos_message_job_join.sql`), rewrote the join as two plain equalities
under a `CASE`. The rule is written in `docs/MIGRATIONS.md`: *join onto a table with row policies by
a plain equality or a `CASE`, never a `COALESCE`.*

The thread that fixed it read the other views for the same shape and found two. It changed neither
and asked for a card. The owner said yes to the card on 2026-11-23.

## The two views

Both are `security_invoker` views, so the joined table's row policies apply to the caller's own
read, which is where the walk happens.

### 1. `agreements_on_file`

Defined last in `20261120010000_paper_party.sql` (punch list #403, step 5). The party's record is
found through three joins of the shape the rule forbids:

| Join | Written as |
|---|---|
| the customer | `pcu.id = COALESCE(pc.customer_id, pcp.customer_id)` |
| the supply house | `psh.id = COALESCE(pc.supply_house_id, psr.supply_house_id)` |
| the GC company | `pgc.id = COALESCE(pc.gc_company_id, pgp.company_id)` |

Each one is the contact's own id first and the contact person's company second. `customers`,
`supply_houses` and `gc_companies` all carry row policies. The view is read by the Agreements tab
(`DocumentsAgreementsTab.tsx` over `src/lib/documents/agreementsLedger.ts`), by `paperParty.ts` and
`partyPapers.ts`, and by the GC portal's paper lines. Punch list #403's open PRs restate this view
again (`20261123083000_agreements_every_party_paper.sql`), so the fix should wait until that lands
and then restate it once more, or be folded into the next restatement.

### 2. `people_hours_recorded`

Defined in `20260909022534_recorded_time_costing.sql` (v2.3179). It joins the pay config as
`pc.person_name = COALESCE(ph.person_name, p.person_name)`, where the `COALESCE` picks the name from
whichever side of a `FULL OUTER JOIN` has the row. `people_pay_config` carries row policies. The view
is read by job costing (`src/utils/teamLabor.ts` and its edge copy) and by the pay functions that
`20261118190000_salaried_week_in_cost_functions.sql` restated, so a slow plan here slows every
job's cost read, not one tab.

## What to measure

As a dev, read only, on production, once each, at a quiet hour:

```sql
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM public.agreements_on_file;
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM public.people_hours_recorded WHERE work_date >= current_date - 14;
```

What to look for: a `Seq Scan` on `customers`, `supply_houses`, `gc_companies` or `people_pay_config`
under a `Nested Loop` whose outer side is the view's rows, with the policy's filter on the scan. A
plan that uses the table's primary key or name index on those joins needs no change.

## The fix, where the measure asks for one

One migration per view, idempotent, `SET lock_timeout = '3s'` first, `CREATE OR REPLACE VIEW` with
the same columns in the same order so nothing reading it changes and no types PR follows:

- `agreements_on_file`: each of the three joins as a `CASE` on which id is set, as v2.8301 wrote
  the Photos join, or as two `LEFT JOIN`s (one per side) folded by `COALESCE` in the select list,
  where the `COALESCE` is on the output and not in the join clause.
- `people_hours_recorded`: join `people_pay_config` to each side before the `FULL OUTER JOIN`, or
  join it on a `CASE WHEN ph.person_name IS NOT NULL THEN ph.person_name ELSE p.person_name END`.

Each migration gets its page under `docs/migrations/`, and the bed that plays the view (the
`paper_party` bed for the first; the costing bed for the second) re-applies the new file last. The
release note names the screens that read faster and nothing else.

## How to verify

Read the plan again after the push with the same two statements. The scan on the policy-bearing
table is an index scan, and the Agreements tab and a job's Cost tab read in under a second on the
busiest account. Then `npm run check:migration-drift`.

## Where it stands

Nothing is measured and nothing is built. The two views were seen on 2026-11-21 while the Photos
view was fixed, and the card was written on 2026-11-23.
