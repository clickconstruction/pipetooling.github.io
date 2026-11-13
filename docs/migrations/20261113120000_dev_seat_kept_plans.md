# 20261113120000 — dev_seat_kept_plans (v2.7122, punch list #315 upgrade 3a)

One approvals list. The dev seat writes under plan then apply: a plan is a dry run with a hash, and the apply quotes the hash. The plan itself was stored nowhere, so it lived in the session that made it. With many sessions on one file the owner said *Apply it* in each, and a plan was lost when its session ended.

**`dev_seat_kept_plans`** — one row is one plan kept for a yes.

- `person_id`, `verb` (the plan verb), `args` (its arguments whole, at most 400 KB), `plan_hash` (64 hex characters), `reply` (the dry run's reply as the session was shown it, at most 60 KB), `words` (one paragraph, 1 to 1,200 characters).
- Who kept it: `kept_by`, `author_label`, `session_label`, `kept_at`.
- `state`: `waiting`, then once `applied`, `dropped` or `stale`, with `decided_by`, `decided_label`, `decided_at` and `decided_why` (required for dropped and stale, 1 to 500 characters).
- The same plan (person, verb, hash) waits once (`dev_seat_kept_plans_waiting_once`).
- **`dev_seat_kept_plans_guard`**: a kept plan is what it was when kept. Only its decision may be set, and only once.

**`dev_kept_plan_verbs()`** — the verbs a kept plan may carry: `plan_hr_entry`, `plan_person_doc`, `plan_person_report`. A later migration adds one by replacing the function.

**`dev_kept_plan_keep(p)`** — dev-gated, definer. `p = { person_id, verb, args, plan_hash, reply?, words, session? }`. Refused, each in words:

- a verb off the list;
- arguments that carry `content_base64` anywhere (a file's bytes are not stored);
- arguments with `counsel_only: true` anywhere;
- a `plan_person_doc` whose `doc_id` names a counsel-only document;
- arguments that write to another person's file (the entry's or the document's `person_id`, or the report's subject);
- the same plan already waiting.

It answers `{ kept_id, person, verb, state, waiting }`.

**`dev_kept_plan_decide(id, state, why?)`** — dev-gated, definer. Records the one decision. It applies nothing: the apply is the plan verb's own, with the same arguments and hash, and its dry run runs again.

**Access.** Devs select. No insert, update or delete policy exists and no such grant is made to `authenticated`; `anon` has nothing; `hr_agent` has no grant; nothing files a row to Drive. The four fence calls end the migration.

**What it leaves alone.** Plan then apply, the call log, every screen and every seat verb. Nothing reads the table yet and nothing in the app applies a plan.

**The owner's calls.** Who may press Apply in the app (any dev, or him alone): not built, so a plan is applied in a session on his word, as today. Whether a kept plan expires: it does not expire by the clock; it turns stale only when its dry run no longer matches.

Held by `npm run test:pg:dev-seat-kept-plans` (`supabase/tests/dev_seat_kept_plans/`, in `scripts/sql-beds.txt`): 36 checks. Before the PR the scenario ran on a local Postgres 15 with stand-in tables and the migration applied twice. Seven mutants were tried: six failed it (keeping a counsel-only plan, a change to a counsel-only document, another person's file, a file's bytes, a table left writable, a door with no dev gate). The seventh, a door that lets a plan be decided twice, still passes, because the table's guard refuses it in the same words.

Deploy order: push this migration. No client reads the table and no function is redeployed.
