# 20261108175919 — person_available_hours (v2.6707)

The answers table behind the Utilization train (PR 1 of three): the hours a person can work in a week, drawn as a Sunday-to-Saturday week on My Time or set by the office on People → People → Utilization. One row per answer, append-only: `hours_per_week` (the drawing's total, or the number typed), `days` (seven JSON arrays, Sunday first, of `[start, end]` minute pairs on the company clock; NULL for a number alone), `effective_from` (the Sunday the answer holds from), `note`, `set_by` (the person themself or the office person) and `created_at`. The newest row in force on a week's Sunday wins; the client's kernel reads the first row for the weeks before it too, so the office's first drawing of a person reads their past weeks.

- **RLS**: SELECT for your own rows or, for `is_dev()`, `is_assistant()` (assistant and controller) and `has_payroll_access()` (dev, controller, pay-approved masters), everyone's — the same roles that read other people's `clock_sessions`. INSERT with `set_by = auth.uid()` for your own row or, for those roles, anyone's. No UPDATE or DELETE policy: a correction is a new row. `anon` holds nothing.
- The four fences close the table (read-only write and statement blocks, the twin fence, the archived caller's read fence).
- One index, `(user_id, effective_from DESC, created_at DESC)`, the board's read order.

Deploy order: free. No client reads the table until PR 2 of the train (the kernels, the tab and the window) lands, and that PR's `check:calls-ahead` holds its deploy until this migration is pushed. Push, then `npm run gen-types:linked` as its own `chore(types)` PR.
