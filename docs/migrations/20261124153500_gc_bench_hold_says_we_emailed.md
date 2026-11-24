# 20261124153500_gc_bench_hold_says_we_emailed.sql (2026-11-24, v2.8491)

**Remove from the bench…** refused in the wrong words (punch list #416, the 2026-11-24 walk of 1c). This restates `gc_remove_bench_company(p_company_id uuid)` with one reason corrected.

- **What was wrong**: the function names the first piece of history that keeps a company. One check reads `gc_trade_messages` and said *‹name› stays on the bench, since they wrote to us from their portal.* That table holds every email **we** sent to a trade company (`20261008050000`; written by `gc-trade-email`, `document-builder-send` and the signing sends). Nothing a company writes lands there. A test company that was emailed one sheet, and wrote nothing, was refused as having written to us.
- **What changed**: that check now says *‹name› stays on the bench, since we emailed them.* The function's comment says *a file from their portal, an email we sent them* where it said *a portal file or message*.
- **What did not**: the rule. An email that went to a company is history, and the company stays. Every other check, their order, the prospect going back on its lane, the delete and its fallback are restated unchanged; a diff of the two bodies shows the one line and the comment.
- **Door and grants**: unchanged and restated (`SECURITY DEFINER`, `gc_office_team()`; a training account, a digital twin and an archived caller refused first; `REVOKE … FROM PUBLIC, anon`, `GRANT EXECUTE … TO authenticated, service_role`).

No table is created, so no fence call is owed. `CREATE OR REPLACE`, idempotent.

**Order**: push right after the merge. The client already calls this function, so `check:calls-ahead` labels the PR *push right after the merge* and the deploy holds until the push. Nothing breaks in between: the client sends what it always sent, and until the push the press refuses in the old words. No types regen is owed: the signature is the same.

**Held by**: `src/lib/gc/benchRemove.test.ts` reads the newest migration that defines the function and fails if the old words come back or the email's check loses its reason.
