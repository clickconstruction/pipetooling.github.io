# 20261122235000_sub_paper_confirm_once.sql (2026-11-22, v2.8298)

A work statement is confirmed once per copy ([v2.8298](../recent-features/v2.8298.md), punch list #350, PR 7's leftover; `to-dos/sub-papers-statement-of-account/`). One unique index on `sub_paper_acks`. No column, function, policy or table changes.

**Why.** A sub's confirm of a work statement ([v2.8273](../recent-features/v2.8273.md), behind `SUB_PAPER_CONFIRM_LIVE`, off) is written by `sub-portal` after it reads the answers and finds no confirm of this copy. Two presses at one moment both read before either writes, so both would write. A payment's *received* row has been held to one by the table since [`20261117150000`](./20261117150000_sub_paper_ack_targets.md). A confirm was held by the function alone.

**What.**

- `sub_paper_acks_confirmed_paper_key`: unique on `(paper_id)` where `kind = 'confirmed' AND paper_id IS NOT NULL`, with a comment that says the rule.
- Each revision of a paper is its own row in `sub_papers` (`20261117040000`), so one confirmed row per `paper_id` is one confirm per revision. The next revision is another `paper_id` and takes its own confirm.
- A *something is wrong* note on the same copy is not in the index and can be sent again.

**Nothing else changes.** The grants and policies stand: the office reads, nobody signed in writes, and `sub-portal` writes with the service key.

**Read on prod before writing.** Read only, on 2026-11-22 through the dev seat: the table holds no row of kind `confirmed`. The switch has never been on, so nothing has written one.

Starts with `SET lock_timeout = '3s';`. No new table, so no fence calls. Idempotent (`IF NOT EXISTS`). Building the index holds writes to `sub_paper_acks` for a moment, on a table of a few rows that only `sub-portal` writes.

**Order.** Pushed after its merge, then `sub-portal` is redeployed. Neither waits on the other. Before the push, the function writes as it did. After the push and before the redeploy, a refused second confirm would answer *That could not be saved*, which no page can reach while the switch is off.

**Checked.** The bed `sub-papers` gains a fourth scenario, `supabase/tests/sub_papers/50_ack_confirmed_once.sql`: the index is there and unique over the confirms that name a copy, a second confirm of one copy is refused by it, the next revision takes its own confirm once, two notes on the same copy are kept, and a voided copy keeps its confirm. The runner applies this file a second time.

## Applied

On the prod ledger, read on 2026-11-23 with the dev seat's `check_migration_ledger` during a docs catch-up. The push's own time and checks were not recorded here.
