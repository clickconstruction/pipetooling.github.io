# 20261014050000_residential_flow.sql (2026-10-12, v2.5396)

*Renumbered on 2026-10-13 from `20261013170000`: while it waited on R0, main gained later stamps (`20261013210000` to `20261014002000`), and a migration that sorts before main's newest would push out of order. Nothing in it depends on those four.*

The residential customer's flow (residential R4 · 1 of 4, `to-dos/gc-mode/messages/RESIDENTIAL_BUILD_PLAN.md` on `spike/gc-mode`). It follows Messages cut 4 ([20261012120000_messages_flows](20261012120000_messages_flows.md)) and the draws fix ([20261013050000_flow_draws_requested](20261013050000_flow_draws_requested.md)). Every step reads a fact the app already keeps. No table or column is added, and no grant changes.

## What it does

1. **`flows_kind_known`** is dropped and added again with `residential` and `sub` beside the four kinds. R0 adds both kinds of contact. The sub flow comes with R8 · 12. `flows` holds one row a kind, so the check's scan is a handful of rows.
2. **`flow_fact_ids()`** is re-created with the eleven residential facts after `named`, as `src/lib/flows/facts.ts` lists them: `booked`, `on_way`, `arrived`, `found`, `estimate_sent`, `estimate_approved`, `working`, `done`, `billed`, `paid`, `review_asked`. **`flow_paper_ids()`** gains `estimate` and `bill`. The flow steps' checks (`flow_facts_ok`, `flow_papers_ok`) then let a step pick them.
3. **`flows_seed()`** is re-created with the residential flow, *Residential customer flow*, and its eleven steps in one Per job lane, Booked to Review asked.
   - Approved carries the estimate reminder: one quiet day, a text, from the app.
   - Paid carries the bill reminder: at its pay by day, a text, from the app.
   - Billed and Paid loop once per bill.
4. **`SELECT public.flows_seed();`** runs it. On prod, the four kinds already have their flows, and the seed adds a step only for a kind with no flow. So it adds the residential flow and its eleven steps, and changes nothing else. A second run adds nothing.

The two reminders are the app's, and nothing in this migration turns them on. The morning run sends a step's reminder only once the owner switches that step on.

`src/lib/flows/flowsSql.test.ts` reads each function and the kind check from the newest migration that defines it, and holds them to the code.

## Checked before the push

**The SQL bed** (`npm run test:pg:residential-flow`, the new `residential-flow` bed, run by the SQL beds workflow). It applies every migration on Supabase Postgres 17, then this one once more, last, changing nothing.

- Five flows, the residential one with its eleven steps in one Per job lane, Booked to Review asked. Six steps are read back field by field.
- Only Approved and Paid carry a reminder, and no seat is set.
- The eleven facts come last in `flow_fact_ids()`, and the estimate and the bill last in `flow_paper_ids()`. A step may pick each.
- A sub flow is allowed, and an unknown kind is refused by `flows_kind_known`.
- The migration once more, streamed in mid-scenario after an office's edit to a step, leaves the edit alone.
- A residential flow seeded afresh adds eleven steps, and a second seed adds nothing.

The `messages-flows` bed re-applies cut 4's migration last. Its seed and lists are cut 4's, so it now counts five flows and 36 steps: the residential flow stays from this migration's run.

## Push

`supabase db push` after the PR is on `main`. It starts with `SET lock_timeout = '3s'`. The `ALTER TABLE` on `flows` takes its lock for a scan of a handful of rows. If the push fails on the lock timeout, retry in a quieter moment.

## Check after the push (read only)

- `SELECT kind, name FROM flows ORDER BY kind;` lists five flows, *Residential customer flow* among them.
- `SELECT step_key, position, who, nudge_days, nudge_send, nudge_day_fact FROM flow_steps s JOIN flows f ON f.id = s.flow_id WHERE f.kind = 'residential' ORDER BY position;` gives eleven rows, `booked` to `review`. Only `approved` (1, app, no day) and `paid` (0, app, `pay_by`) have a reminder.
- `SELECT array_length(public.flow_fact_ids(), 1), array_length(public.flow_paper_ids(), 1);` gives 44 and 19.
