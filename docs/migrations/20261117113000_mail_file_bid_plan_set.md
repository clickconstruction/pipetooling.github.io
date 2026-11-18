# 20261117113000_mail_file_bid_plan_set.sql (2026-11-16, v2.7531)

Punch list #368, PR 1: a mail's file kept as a set of plans on a bid.

Adds `message_attachments.bid_plan_set_id uuid`, a foreign key to `bid_plan_sets(id)` with `ON DELETE SET NULL`, and a partial index on it. The column says which set of plans on a bid a mail's file was filed into. `bid-plan-set-files` writes it as the service role, and only once the file is in the set's Drive folder. The office holds `UPDATE` on `paper_answer` alone on this table, so no signed-in client can set or clear it.

It is kept per file because a mail with three files may have two kept, and a later mail may add a sheet to a set an earlier mail made. A mail reads as kept from its files, and a set reads as from a mail from the files that point at it. A set removed from the bid clears the mark, and the mail offers the press again.

The constraint is added `NOT VALID` and validated in the next statement, so the wait on `message_attachments` is the catalog change's own and the check of the rows runs under the lighter lock. Every row is null on the day it lands. Idempotent. No table is created, so no fence is owed.

**Apply order**: push right after the merge and before `bid-plan-set-files` is deployed, since the function writes the column. No client reads it until PR 2.

**Pushed** 2026-11-16, right after #8440 merged, with `bid-plan-set-files` deployed after it and `dev-mcp` redeployed for its catalog. The generated types took the column in the types PR that followed.

**Applied** to prod by 2026-11-18: `npm run check:migration-drift` read 1,366 local files against 1,366 remote versions, fully applied, this version among them (run in the docs pass after #8630).
