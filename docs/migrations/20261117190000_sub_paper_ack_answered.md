# 20261117190000_sub_paper_ack_answered.sql (2026-11-17, v2.7609)

The office marks a sub's note answered (punch list #371, step 3). Three columns on `sub_paper_acks` and one function.

**Why.** A sub can say from their page that something is wrong on a statement or a payment. That note flags the sheet on Jobs → Subs → Pay. A flag nobody can put down is a flag nobody trusts, so the office needs a way to say the note was answered, once, with who and when.

**What.**

- `answered_at`, `answered_by` and `answered_by_name` on `sub_paper_acks`. All null while a note waits.
- `sub_paper_acks_waiting_idx`: the notes that still wait, by person.
- `answer_sub_paper_ack(p_ack_id uuid) returns timestamptz`, `SECURITY DEFINER`. It stamps the three columns and hands back when.
  - Only the office roles who see sub pay (`is_office_staff()`). A training account, a digital twin and an archived account are refused, each with its reason.
  - Only a `something_wrong` row can be answered. A row that is gone says so.
  - A note is answered once. A second call hands back the first time and changes nothing.
- `EXECUTE` is revoked from `PUBLIC` and `anon`, and granted to `authenticated`.

**Nothing else changes.** The table stays read only by grant. This function is the one way a signed-in person writes it, and these three columns are all it writes. The note's own words are never changed or removed.

Starts with `SET lock_timeout = '3s';`. No new table, so no fence calls. Idempotent.

**Order.** The Pay view calls the function, so it is pushed right after its merge. Before the push the view reads the table without the three columns, shows the notes, and draws no **Mark answered** press.

**Checked.** The bed `sub-papers` gains a third scenario, `supabase/tests/sub_papers/40_ack_answered.sql`: who may call it, an estimator and a training account refused, a `received` row and a missing row refused, Devon's answer stamped with his name and the note's words unchanged, a second answer handing back the first time, and a hand-typed stamp refused by the grant.

**Not checked.** Not run on this Mac, which has no Docker. The SQL beds workflow in CI is its first run.

**Verify**, read-only on prod after the push:

- A read of `sub_paper_acks` that names `answered_at, answered_by_name` answers.
- `select proname from pg_proc where proname = 'answer_sub_paper_ack'` returns one row.

**Applied** to prod on 2026-11-17 by `supabase db push --include-all` from a checkout at `origin/main` (c244a15e93, after the merge of #8550). The dry run named this one file. `check:migration-drift` reads 1,352 versions on both sides. A read naming `answered_at` and `answered_by_name` answers. The function was called once on prod, from Jobs → Subs → Pay on a ZZ TEST note: the note read as answered with the name and the day, and its flag went away. The types follow in #8567.
