# 20261001151153 — `bid_submittal_takeoff_choices.product_line_ids` (v2.4292)

**What**: one additive nullable column, `product_line_ids uuid[]`, on the table v2.4107 added for the estimator's ticks in *Choose from the takeoff*.

**Why**: the pick list named one part line as each fixture's product — on BP375 the angle stop for LAV2 (its part type "Sink" read as the fixture) and the flush valves for WC 1&2 and UR 1&2 (the priciest line). The product is now the fixture's pieces in takeoff order with trim left off by name; the estimator switches pieces as chips and the choice is remembered here: the `bids_takeoff_rough_part_lines` ids that make the product. `NULL` = the default rule; `'{}'` = none on (the row is built as Missing, to type with Edit). A stored id whose line is gone is ignored; when none of them is left, the default rule decides again.

**Safety**: `SET lock_timeout = '3s'`; `ADD COLUMN IF NOT EXISTS`, nullable, no default (no rewrite). No new table, so the read-only and twin appliers are not re-run; the existing policies cover the column. No foreign key on the array (Postgres has none for arrays); stale ids are dropped by the client.

**Client**: `takeoffCandidatesIo.ts` reads it with the tick and split; `saveTakeoffChoices(…, productKeys)` writes it only for fixtures whose pieces the estimator switched.
