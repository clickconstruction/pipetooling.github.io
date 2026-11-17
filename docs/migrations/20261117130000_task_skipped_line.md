# 20261117130000_task_skipped_line.sql (2026-11-16, v2.7551)

A repeating task that was not ticked can say it was skipped (punch list #369, step D3). One more kind of line in a task's thread and the right to write it. No function, no column.

**Why.** A daily or weekly task that is not ticked drops off the list the next morning, and nothing asks why. Checklist → Today now asks once, the day after: did you do it, or was it skipped? *Did it* marks that day's row done, which needs nothing new. *Skipped* needs a line, so the question is not asked twice and History can tell a skipped day from one nobody answered for.

**What.**

- `skipped` joins the kinds of `checklist_instance_events.event_type`, beside the twelve of `20261117120000`. The check is dropped by what it holds and added back under the same name.
- The insert policy *Insert own comments on visible instances* lets `skipped` through beside `comment`, `progress`, `criterion`, `stuck` and `unstuck`: written as oneself, on a day row one can read.
- The column's comment names the thirteen kinds and who writes each.

**Nothing else changes.** A skipped line changes only the thread: the row stays not done. `moved`, `dropped`, `handed` and `map` are still written only by the `task_*` functions.

Starts with `SET lock_timeout = '3s';`. No new table, so no fence calls. Idempotent. The re-added check reads every row of `checklist_instance_events` once, a small table, under the lock the `ALTER` takes.

**Order.** It comes after `20261117120000_task_doer_acts.sql`, whose kinds it restates, and is pushed right after its own merge. Before the push, the **Skipped** press is refused by the check and the page shows the refusal. Nothing else on the screen depends on it.

**Checked.** The bed `task-doer-acts` gains a second scenario, `supabase/tests/task_doer_acts/20_skipped.sql`: 11 assertions on the whole schema. A person on the task writes a skipped line as themself and the row stays not done; nobody writes it for someone else or on a row they cannot read; a dropped line is still not written by hand; a note still lands; one check and one insert policy stand. The runner re-applies both migrations.

**Not checked.** Not run on this Mac, which has no Docker. The SQL beds workflow in CI is its first run.

**Verify**, read-only on prod after the push:

- `select pg_get_constraintdef(oid) from pg_constraint where conname = 'checklist_instance_events_event_type_check'` names thirteen kinds, `skipped` among them.
