---
name: "Two more views join through a COALESCE onto a table with row policies: agreements_on_file and people_hours_recorded"
number: 430
group: close
status: found 2026-11-21 by the #306 thread while fixing the Photos tab's statement timeout (v2.8301) · the card written 2026-11-23 on the owner's word of 2026-11-23 · 2026-11-23 no read-only path to a plan on prod, so both mended on the plan's shape: v2.8389 (agreements_on_file) and v2.8392 (people_hours_recorded) · both merged and both migrations on prod, the ledger holds 20261123190000 and 20261123193000 · 2026-11-24 each view read as a dev through the dev seat and answered · 2026-11-24 the plan reader built and live (v2.8432, the dev seat's check_query_plan) and both plans read on prod as a dev: the customer and the supply house are found by key, the pay config is read once and hashed, the trade company is read once and held, and none is walked once per row · the last open step is done; retiring the card is the owner's
summary: >
  Documents → Photos timed out because its view found a job with a join written as an equality
  onto a COALESCE. Postgres will not use such a clause as an index condition on a table with row
  policies, so it walked the whole table under its policies once per outer row. That one was
  fixed. The thread that fixed it saw the same shape in two other security_invoker views and
  changed neither: agreements_on_file joins three party tables that way, and people_hours_recorded
  joins the pay config that way. No read-only path to a plan on prod was open on 2026-11-23, so
  both are mended on the plan's shape, with beds that hold every row the same (v2.8389 and v2.8392).
  Both are merged and on prod. On 2026-11-24 both plans were read on prod as a dev, through the
  plan reader built for it (v2.8432): 12 ms and 35 ms, and no table is walked under its policies
  once per row. Two of the four tables are found by key. The other two are read whole once, by
  price, which is no fault at their size.
next: Nothing is owed. The measure is done (2026-11-24, under *Where it stands*); the owner retires the card.
size: S · S, both shipped, and the plan read on prod done (2026-11-24)
blocker: none
ver: v2.8389 · 8392 · 8432
opinion: close — both views are mended, held by their beds and measured on prod; what the measure found in the trade company and the pay config is no fault today
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

Since v2.8432 the dev seat reads each as the dev, under the dev's own row policies: `check_query_plan` with
`statement: agreements_on_file` or `statement: people_hours_recorded` (`docs/dev-mcp/README.md`). `find` with a table's
name shows that table's scans with the joins above them.

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

Read the plan on prod with the same two statements. The scan on the policy-bearing
table is an index scan, and the Agreements tab and a job's Cost tab read in under a second on the
busiest account. The push and `npm run check:migration-drift` are done (2026-11-24, clean), and the plans were read
on 2026-11-24 (under *Where it stands*).

## Where it stands

**Measured on 2026-11-23, as far as a read-only path allowed.** No path to a plan on prod was open from the session
that took the card: the Supabase CLI at 2.72.7 has no verb that runs a query, the session pooler needs a database
password the machine does not hold, the Supabase MCP is off limits for this, and the dev seat reads through PostgREST,
which hands back rows and no plan. Through the dev seat, as a dev, a one-line read of each view answered.

The policies decide it, and they were read instead. `customers` has policies that read its own column
(`master_user_id`), and `people_pay_config` has a self-read policy that reads `person_name`: on those two a `COALESCE`
join cannot be an index condition. `supply_houses` was read then as having one policy that reads no column of its
own. The bed shows two read policies, and one of them (`supply_houses_select_by_my_po_code`,
`20261109200000_po_code_read_by_its_person.sql`) reads the house's own `id`, so the walk happens there too: in the bed
the view as it stood walks it.

The shape, on a local Postgres 15 as a role under a policy that reads a column, with 5,000 records and 200 lines:

| Join | Plan with the walks priced out | Plan left free |
|---|---|---|
| `COALESCE` | `Join Filter` over a `Materialize` of the whole table | the whole table hashed under its policy, 5,000 rows |
| `CASE` | `Index Cond` on the primary key | 200 lookups by key |

**Both mended, since the rewrite keeps every row the same:**

- `agreements_on_file`: `20261123190000_agreements_party_join_by_key.sql` (v2.8389), the three joins as a `CASE`. The
  `paper-party` bed rebuilds the view as it stood and asserts five roles read the same lines from both, and that the
  plan finds the customer, the supply house and the trade company by key, where the view as it stood finds none of
  the three so. The trade company's lookup was logged and not held until 2026-11-24, on the guess that the bed had too
  few people at trade companies. That was not it: two thousand people there changed nothing. A policy on
  `supply_houses` reads `material_po_generator_entries`, which the bed leaves empty and had never measured, and Postgres
  priced the unmeasured table so high that the trade company's lookup, joined after the supply house, saved too little
  to tell from a walk. The bed measures that table now (`ANALYZE`), and the lookup holds.
- `people_hours_recorded`: `20261123193000_people_hours_recorded_pay_join_by_key.sql` (v2.8392), the pay config join as
  a `CASE`. A new bed, `people-hours-recorded`, does the same over each side of the full join.

**Merged and on prod.** Both PRs are merged, and the prod ledger holds `20261123190000` and `20261123193000`
(`npm run check:migration-drift` clean on 2026-11-24). On 2026-11-24 each view was read as a dev through the dev seat
and answered: 49 lines of `agreements_on_file`, and 81 rows of `people_hours_recorded` for work dates from 2026-11-10
on.

**Measured on prod, 2026-11-24.** The plan reader is live: `dev_query_plan` (`20261124063000_dev_query_plan.sql`,
v2.8432) and the dev seat's `check_query_plan` (dev-mcp 0.133.0). It runs `EXPLAIN (ANALYZE, BUFFERS)` on one of the two
statements above, by its key, as the dev under the dev's own row policies. Both were read through it as a dev between
08:19 and 08:21 UTC, with no lock waits and three active connections.

| Statement | Planning | Execution | Plan lines | Rows |
|---|---|---|---|---|
| `people_hours_recorded`, the last 14 days, run once | 6.67 ms | 11.92 ms | 237 | 81 |
| `agreements_on_file`, run three times | 78.2 ms · 68.6 ms · 67.2 ms | 35.2 ms · 33.0 ms · 33.3 ms | 1,400 | 49 |

`agreements_on_file` ran three times and not once. Its plan is 1,400 lines, more than one reply of the seat holds, and
each look at one table's joins runs the statement again.

Which of the four tables are found by key, and which are read whole:

| Table | In the plan | Found by key |
|---|---|---|
| `customers` | `Index Scan using customers_pkey`, the `CASE` as its `Index Cond`, 33 loops | yes |
| `supply_houses` | `Index Scan using supply_houses_pkey`, the `CASE` as its `Index Cond`, under a `Memoize` (31 hits, 2 misses) | yes |
| `gc_companies` | one `Seq Scan` (2 rows), held in a `Materialize` read 33 times, under a `Nested Loop Left Join` with the `CASE` as a `Join Filter` | no: read whole once and held, by price |
| `people_pay_config` | one `Seq Scan` (29 rows), under a `Hash Right Join` with the `CASE` as its `Hash Cond` | no: read whole once and hashed |

No table is in the shape this card was written about, a scan under its policies once per outer row. Every scan of the
four runs once (`loops=1`) or is a lookup by key.

The plan's own lines for those joins. The customer:

```
->  Index Scan using customers_pkey on customers pcu  (cost=0.27..19.11 rows=1 width=32) (actual time=0.017..0.017 rows=0 loops=33)
      Index Cond: (id = CASE WHEN (pc.customer_id IS NOT NULL) THEN pc.customer_id ELSE pcp.customer_id END)
      Filter: ((InitPlan 409).col1 AND (is_office_staff() OR (master_user_id = (InitPlan 410).col1) OR (InitPlan 416).col1 OR (ANY (master_user_id = (hashed SubPlan 420).col1)) OR (ANY (master_user_id = (hashed SubPlan 424).col1)) OR (InitPlan 430).col1 OR is_dev() OR is_office_staff() OR (master_user_id = (InitPlan 431).col1) OR user_has_schedule_block_for_customer(id)))
```

The supply house:

```
->  Memoize  (cost=0.15..5172.72 rows=1 width=48) (actual time=0.021..0.021 rows=0 loops=33)
      Cache Key: CASE WHEN (pc.supply_house_id IS NOT NULL) THEN pc.supply_house_id ELSE psr.supply_house_id END
      Cache Mode: logical
      Hits: 31  Misses: 2  Evictions: 0  Overflows: 0  Memory Usage: 1kB
      ->  Index Scan using supply_houses_pkey on supply_houses psh  (cost=0.14..5172.70 rows=1 width=48) (actual time=0.335..0.342 rows=0 loops=2)
            Index Cond: (id = CASE WHEN (pc.supply_house_id IS NOT NULL) THEN pc.supply_house_id ELSE psr.supply_house_id END)
            Filter: ((InitPlan 439).col1 AND ((ANY (id = (hashed SubPlan 663).col1)) OR (InitPlan 669).col1))
```

The trade company, with the join it sits under:

```
->  Nested Loop Left Join  (cost=52.62..97446.97 rows=32 width=360) (actual time=7.069..13.105 rows=33 loops=1)
      Join Filter: (pgc.id = CASE WHEN (pc.gc_company_id IS NOT NULL) THEN pc.gc_company_id ELSE pgp.company_id END)
      Rows Removed by Join Filter: 66
      ->  Materialize  (cost=0.00..11.69 rows=38 width=48) (actual time=0.012..0.012 rows=2 loops=33)
            ->  Seq Scan on gc_companies pgc  (cost=0.00..11.50 rows=38 width=48) (actual time=0.395..0.396 rows=2 loops=1)
                  Filter: ((InitPlan 672).col1 AND (InitPlan 673).col1)
```

The pay config, with the join it sits under:

```
Hash Right Join  (cost=233.17..1580.61 rows=316 width=148) (actual time=5.278..10.590 rows=81 loops=1)
  Hash Cond: (pc.person_name = CASE WHEN (ph.person_name IS NOT NULL) THEN ph.person_name ELSE (TRIM(BOTH FROM u.name)) END)
  ->  Seq Scan on people_pay_config pc  (cost=0.00..1346.13 rows=9 width=23) (actual time=1.286..7.274 rows=29 loops=1)
        Filter: ((InitPlan 4).col1 AND ((ANY (person_id = (hashed SubPlan 158).col1)) OR (ANY (btrim(person_name) = (hashed SubPlan 170).col1)) OR has_payroll_access()))
```

**Two tables are not found by key, and neither is a fault today.** Nothing is changed for either here.

- **The trade company is read whole once, by price.** The `CASE` would let Postgres look it up by key, and the bed
  shows it does when the lookup is the cheaper plan. On prod a dev sees two trade companies, and their policies read no
  column of the table, so the filter is worked out once for the scan. The whole of it is one scan of 0.4 ms and two held
  rows compared against each of 33 lines. It would matter when the trade companies are many: the compares are the lines
  times the companies. The sign to look for in a later read is this `Join Filter` still over the `Materialize` with its
  rows in the hundreds.
- **The pay config is read whole once and hashed.** That is the plan for a statement that wants most people's pay
  rows, as this one does. Its 29 rows are filtered under their policy once each, however many person-days the view hands
  back. That scan is 7.3 ms of the statement's 11.9 ms. It would matter with pay rows in the thousands, or for a read of
  one person's days that still pays to filter every pay row. This statement reads everyone, so it does not show that
  second case.

**The card's last open step is done.** Both views are mended, on prod, held by their beds and measured. Retiring the
card is the owner's.

One thing the bed taught for that read, written before it. The planner calls two plans the same price when they are within one part in a
hundred, and on prod the supply house's policy reads a table with real rows, so its price there is real. If that price
is high enough, the trade company may still be walked on prod with the `CASE`, by price and not by the join's form.
`gc_companies` has policies that read no column of its own, so such a walk is cheap. This was a reading of the bed, and
the measure bears it out.
