# 20261013050000_flow_draws_requested.sql (2026-10-12, v2.5338)

The draws fix, by GC Reviews helper 8 with helper 4 (the facts and the reading are theirs), after Messages cut 4 ([20261012120000_messages_flows](20261012120000_messages_flows.md)). A trade partner's draw now reads as ours from the day they ask for it until it is paid, and the next one reads as theirs between draws. Before, the draws step's paper (their waiver) was read by `draw_paid`. A draw asked for and not paid then read as theirs (*Send your pay application with its conditional waiver.*), and the time between draws read as ours (*We are on it.*).

## What it does

1. **`flow_fact_ids()`** is re-created with `draw_requested` just before `draw_approved`, as `src/lib/flows/facts.ts` lists it. The flow steps' facts check (`flow_facts_ok`) then lets a step pick it.
2. **`flows_seed()`** is re-created with the trade flow's draws step finished by `draw_requested` and `draw_paid` (joined by and, so a round still ends when it is paid), for a database with no flow yet.
3. **The trade flow's draws step on a database seeded before** (prod) changes only where it still reads as seeded: facts `{draw_paid}`, joined by and, paper `{waiver}`. An office edit stays the office's. One `flow_step_history` line says so, *Draws: + their pay application is in*, by *The app*, in the flows editor's own words.

Someone with Settings → Flows open on the trade flow during the push is told *Someone saved this flow* on Save, since `flow_save` compares the newest History time. That is right: the one who saved is *The app*.

No table, column or grant changes. `src/lib/flows/flowsSql.test.ts` reads both functions from this migration, the newest that defines them, and holds them to the code.

## Checked before the push

**The SQL bed** (`npm run test:pg:flow-draws`, the new `flow-draws` bed, run by the SQL beds workflow). It applies every migration on Supabase Postgres 17, then this one once more, last, changing nothing. The `messages-flows` bed re-applies cut 4's migration after everything as its own check, which puts back cut 4's two functions, so this bed holds this migration's.

- The facts list `draw_requested` just before `draw_approved`, and a step may pick it.
- The draws step reads `draw_requested,draw_paid`, and, with one History line for the change.
- The migration once more, streamed in mid-scenario after an office's edit to the step, leaves the edit alone and writes no second line.
- A trade flow seeded afresh draws the step the same way, and a second seed adds nothing.
