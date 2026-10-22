# 20261022064210_bid_plan_questions.sql (2026-10-22, v2.5737)

Robot rounds, PR 7 (punch list #142, decision 9): Ask the robot to look. One new table, `bid_plan_questions`: a person's question about a bid's plans asked from the Plans panel (`question`, `asked_by`, `asked_at`), the round's claim (`claimed_by`, `claimed_at`), the robot's answer (`answer`, `sheet_refs`, `answered_by`, `answered_at`), `seen_at` (the asker read it; clears the Dashboard line), `rfi_id` (the RFI made of it), `status` open · answered · dismissed. RLS: the bid roles read; a bid role asks as themselves with an open, unanswered row; estimator and up update (dismiss, seen, the RFI tie). The robot answers through twin-mcp's service role (`put_plan_answer`), never through the fence. The three house calls at the end. Nothing here is money.

Push any time; the panel reads fail-soft before the push. Deploy `twin-mcp` (v1.7.0) after the push.
