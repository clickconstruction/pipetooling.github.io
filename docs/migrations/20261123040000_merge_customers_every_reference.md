# 20261123040000_merge_customers_every_reference.sql (2026-11-23, v2.8324)

Merging two customer rows carries every reference to the row that goes ([v2.8324](../recent-features/v2.8324.md); the last of punch list #307's leftovers, *merging customer rows that are one GC*, on the owner's word *every reference*). No table changes. Nine functions, each `CREATE OR REPLACE`.

## Why

`merge_customers` moved ten references by name and then deleted the other row. Every table added since it was written went with the row by cascade, or kept a blank where the customer was.

## Read on prod before writing

Read only, 2026-11-22 and 23.

| What | Count |
|---|---|
| Columns with a foreign key to `customers` | 46 |
| Moved by the old merge | 10 |
| Lost by cascade on a merge | 18 tables |
| Set to null on a merge | 18 columns on 16 tables |
| References with no foreign key | 5 |

The five with no key, found by sweeping every list-of-ids column, every text column named like a key, id or ref (332), and every JSON column of a table under 60,000 rows (198), for a value that holds a customer's id:

- `public_page_views.entity_id`: a portal visit names its customer. 70 rows today.
- `legal_matters.payer_key`: `c:` and the customer's id. The app finds a customer's matter by it (`lienClosedEndIo.ts`, `legalMatters.ts`). 5 matters today. The key is unique (`legal_matters_payer_key_key`).
- `gc_word_asks.gc_ids`: the GCs a word ask is about. No ask today.
- `dispatch_requests.pending_payload` and `estimator_requests.pending_payload`: what an open request makes once it is approved. One open request today.

Left as written, since they record what already happened: `dev_mcp_calls.args`, `bids_rfis.sent_to`, a closed request's payload, and the history tables (`deleted_records_archive`, `bid_changes`, `job_activity_events`).

## What it adds and replaces

| Object | What it does |
|---|---|
| `customer_merge_moves_only(old, new, column)` | New. True while the merge's transaction flag is up and a row differs from itself in that one column alone. |
| `bid_versions_lock_guard`, `document_builder_sends_guard`, `gc_difficulty_ratings_guard` | Each refused the merge's move: a version locked by someone else, a send that is changed only by sending again, a rating that is never changed. Each is its newest body with one line that lets the move alone through. |
| `customer_reference_columns()` | New. Every single-column foreign key to `customers`, off the catalog, as `table.column`. |
| `merge_customers_keyless(survivor, victim, apply)` | New. Counts the five references with no key, or moves them. A word ask lists the kept customer once. |
| `merge_customers_exceptions(survivor, victim)` | New. The rows two customers may not both hold, and what a merge does with each. |
| `merge_customers_drop(table, key, ids, group)` | New. Deletes rows a rule drops, keeping each first in `deleted_records_archive` under the removed customer's id, the same bundle `archive_deleted_record` puts that customer's own row in. |
| `merge_customers_plan(survivor, victim)` | New. `holds`, `left_behind`, `portal_address_lost`, `same_job`, `legal_blocked`. |
| `preview_merge_customers` | Its old answer, with the plan added to it. |
| `merge_customers` | Moves everything, refuses a legal block, checks that nothing still names the row that goes, deletes it, and answers with `moved` and the plan. |

Every new function is closed to `anon` and `authenticated`. The two the app calls keep their grants, since `CREATE OR REPLACE` keeps them.

## The rules, where two rows may not both stand

| What | Rule |
|---|---|
| Follow-up setting, portal address, pay calendar (one a customer, or one a customer and job) | The kept customer's stands. The other's is dropped. The preview names the portal address that stops answering. |
| Active portal link (one an audience) | The kept customer's stays live. The other's is turned off and kept. |
| Statement mark (one a week), word ask answer (one an ask) | The newer stands, whichever row it was on. |
| Listing on a bid, due date line on a bid (one a customer on a bid) | The kept customer's stands. The other's is dropped. |
| Open proposal room (one a customer on a bid) | The other's is closed and kept. |
| Live document send (one a customer, builder and sheet) | The other's is taken off and kept. |
| Property spelled the same on both rows | Folded into the kept one when the other's copy holds nothing the kept one lacks. Whatever named the copy names the kept one. Any other property moves whole, with its legal record. |
| Legal matter on both rows | The merge is refused. A payer holds one matter. |

The other customer's starred property is un-starred before it moves, so the kept customer keeps its own. When the person chose the other row's address, the address sync stars that property on the kept row.

A job that names one row as its customer and the other as its GC names the GC alone after the merge and bills the GC, as `jobs_ledger_customer_gc_distinct` already rules. The preview counts these as `same_job`.

## A table added later

The merge reads the foreign keys off the catalog, so a new table that points at `customers` is moved with the rest. One that lets a customer hold a single row, with no rule here, stops the merge with its name, and nothing is changed. The bed holds the list of such rules against the catalog, so a new one fails CI until the merge is taught it.

## Tested

- A throwaway local Postgres 15 with every table the merge touches shaped off prod's catalog, and the functions it meets copied from prod's `pg_proc`: this file applied twice, then the bed's whole scenario. All 56 checks passed.
- `npm run test:pg:merge-customers`, the bed on the whole schema in CI. Part A is the bed as it was. Part B: an assistant merges a GC typed twice whose other row holds something in every kind of place a customer is named. Afterwards nothing names that row. What moved, what each rule did and what the archive holds read as laid down. The three guards still refuse an edit with the flag down and up. A table the merge never heard of is carried. One with a single-row rule stops the merge by name. Two rows that each hold a legal matter are refused.

## Release order

Either order is safe. The client reads the plan when the preview gives one and shows the six counts it always did when not. Push after the merge.

**Applied** to prod by 2026-11-23: `npm run check:migration-drift` read 1,454 versions applied against 1,454 local files, this version among them (read in the docs pass after #9274); types regenerated in #9442.
