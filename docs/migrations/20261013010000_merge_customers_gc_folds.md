# 20261013010000_merge_customers_gc_folds.sql (2026-10-13, v2.5310)

Merging a customer keeps their GC call log and their part on every GC project. `CREATE OR REPLACE` of `merge_customers(p_survivor, p_victim, p_field_choices)`: the body of `20260817221950_merge_customers_accepted_estimates.sql` word for word, plus three `UPDATE`s beside the folds it already does, before the victim's delete:

1. `gc_customer_contacts.customer_id` (on delete cascade since 20261010150000, so the victim's GC call log was dropped on merge) moves to the survivor, each line still naming its job;
2. `gc_projects.architect_customer_id` (on delete set null since 20261006233000) moves to the survivor;
3. `gc_projects.property_owner_customer_id` (the same) moves to the survivor.

SECURITY DEFINER as before, so the call log's append-only grants (no `UPDATE` for `authenticated`) do not stop the fold. The `gc_projects_owner_terms_guard` trigger watches the owner's terms and the billing job, not these two keys. No table, grant or policy changed. Idempotent: a second run replaces the function with itself.

**Ordering with the Messages spine** (PR #5431, migration `20261012010000_messages_spine.sql`): it also replaces this function, adding the `contacts` fold (`contacts_fold`) before the delete. Whichever of the two lands second carries the other's step; the second migration's author lifts the other's lines into their body. This one landed second, so it carries the spine's contact fold loop (the `v_victim_thread` loop before the survivor's update), lifted word for word from `20261012010000`. The `contacts`/`contact_*` tables are not touched here.

## Checked before the push

**The SQL bed** (`npm run test:pg:merge-customers`, the new `merge-customers` bed in `scripts/sql-beds.txt`): every migration on Supabase Postgres 17, this migration once more (changing nothing), then `supabase/tests/merge_customers/20_scenario.sql`:

- the fixture reads as laid: two of three GC call-log lines are the victim's, and the clinic names the victim as architect and property owner;
- nobody signed out merges (*Not authenticated*);
- a dev merges the duplicate into the kept one through RLS, taking the duplicate's address; the answer names the pair;
- the victim is gone and the survivor carries the chosen address; the victim's own job and old call-log line are the survivor's (the folds the function always did);
- all three GC call-log lines read on the survivor, the clinic call still naming its job;
- the clinic names the survivor as architect and property owner; a project drawn by the survivor and owned by a third customer, and one with no part for the victim, are as they were.

Not run on this Mac (Docker belongs to another account); the sql-beds job runs it on the PR. Without the first new `UPDATE` the call-log assertion reads one line, not three (the cascade); without the other two the clinic reads empty keys (set null).

## Verify after the push

```sql
-- 1. The three folds are in the function.
SELECT position('gc_customer_contacts' IN prosrc) > 0 AS call_log,
       position('architect_customer_id = p_survivor' IN prosrc) > 0 AS architect,
       position('property_owner_customer_id = p_survivor' IN prosrc) > 0 AS owner
FROM pg_proc WHERE proname = 'merge_customers';
-- expect: t | t | t

-- 2. Still SECURITY DEFINER, still granted to authenticated.
SELECT prosecdef FROM pg_proc WHERE proname = 'merge_customers';
-- expect: t
SELECT has_function_privilege('authenticated', 'public.merge_customers(uuid, uuid, jsonb)', 'EXECUTE');
-- expect: t
```

## Rollback

Re-run the `CREATE OR REPLACE FUNCTION "public"."merge_customers"` block from `20260817221950_merge_customers_accepted_estimates.sql` (or from the Messages spine's migration, if it has landed). Nothing else to undo.

## Status

Written 2026-10-13 with the migration. Not pushed; the lead pushes after merge.
