# 20261030060000_other_charges_date_memo.sql (2026-10-30, v2.6112)

Other job charges carry a date and a memo (punch list #215, PR 2 of 3, PR #6491).

- `jobs_ledger_materials` gains two nullable columns: `charged_on date` (the day the charge applies to, shown on the row's left and in the Costs packet) and `memo text` (the basis of the number, opened with **+ memo** under the charge). Both `IF NOT EXISTS`, with column comments.
- `public.cost_batch_apply` is re-created verbatim except that an `other_charge` op may carry `charged_on` (an ISO date, refused with the op's index when it does not parse) and `memo`; both land on the ESTIMATE row it inserts. Ops without them behave exactly as before.

Apply order: push this migration **before** #6491 merges. The client in that PR names both columns in its `jobs_ledger_materials` embed select, so a deploy ahead of the push would make every job window's cost read fail. The push ahead of the deploy is harmless: the old client never asks for the columns.
