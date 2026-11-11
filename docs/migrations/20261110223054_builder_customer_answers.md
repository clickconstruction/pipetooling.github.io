# 20261110223054_builder_customer_answers.sql (2026-11-10, v2.6872)

Bids and permits: the answer on a name (punch list #307, PR 6 and 7; `to-dos/bid-permits/`). One table, append-only.

## What it does

- **`builder_customer_answers`** (id, builder_key, customer_id, answer, scope, permit_id, name, answered_by, answered_at): whether a name the city lists on permits works for a customer.
  - `answer`: `works_for`, `someone_else`, `not_sure` (that person only) or `taken_back` (an earlier answer undone).
  - `scope`, on `works_for` only: `all` (every permit under the name shows under the customer) or `this_permit` (the one it was asked on, which then needs a `permit_id`). Two checks hold both rules.
  - `name` is the name as the city lists it, for the screen. `customer_id` cascades with the customer; `permit_id` is set null if the permit goes.
  - Indexes on `(customer_id, builder_key, answered_at)` and `(builder_key, answered_at)`.
- **Row security**: read and insert for `user_can_research_permits()` (the office and every estimator), an insert only as oneself. No update and no delete: the newest decisive row per name and customer is the state, folded by `src/lib/research/nameAnswers.ts`.
- Closed to `anon`; `SELECT` and `INSERT` to `authenticated`. The four fences close the file.

`builders.customer_id` (v2.6835) is left in place and unwritten. The card planned to drop it; nothing reads it, and dropping a column is not additive.

## Release order

Merge the PR, then push. Before the push `loadNameAnswers` reads a missing table as nothing to ask: no question is drawn and the GC's panel leaves its second half off.
