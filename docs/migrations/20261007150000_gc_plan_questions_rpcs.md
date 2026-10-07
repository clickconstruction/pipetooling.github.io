# 20261007150000_gc_plan_questions_rpcs

**Version:** v2.4779 · **Date:** 2026-10-06 · **Plan:** `to-dos/gc-mode/NEW_PROJECT_REAL_BUILD.md` on `spike/gc-mode`, step 8.

## What it adds

- `gc_plan_questions.asked_by_name text NOT NULL DEFAULT ''`: who asked, as the office typed it, until the company record lands (`company_id` stays for it).
- `gc_questions_close_on(p_project uuid) RETURNS date`, `STABLE`: three days before our bid is due while the project is bidding; null when questions never close (the job is ours, or no due date).
- `gc_record_question(q jsonb) RETURNS uuid`: the office records a question a company asked by phone or email (`projectId`, `packageId?`, `askedByName`, `text`, `sheets[]`, `askedOn?`). Refuses a lost bid, a closed window, an empty question and a trade not on the project.
- `gc_answer_question(q jsonb) RETURNS uuid`: the architect's answer (`questionId`, `answer`) on a question not answered yet; sets `answer` and `answered_on`.
- `gc_issue_plan_set` re-created as `20261007090000` made it, plus `questionIds`: the answered questions the set carries get `in_set_id`.

All `SECURITY INVOKER`; `EXECUTE` to `authenticated` only; the tables' policies (dev-only while the build goes on) decide who may. Sending a question to the architect is the edge function `gc-plan-question-email` (step 8b), which sets `sent_to_architect_on` with the service role after the send.

## Applied

With `supabase db push` after the PR merged. Idempotent, additive.
