# 20261014005000_estimate_line_from_message.sql (2026-10-12, v2.5430)

Messages, residential R8 · 8, PR 2 (`to-dos/gc-mode/messages/RESIDENTIAL_BUILD_PLAN.md` → R8 on branch `spike/gc-mode`): the office puts a customer's message on their estimate as a line.

The kernel is `src/lib/estimates/lineFromMessage.ts` (v2.5403). The link is `messages.estimate_id` (`20261014002000_messages_estimate_id.sql`, v2.5426). The model is cut 4b's `gc_draft_change_order_from_message` (`20261012180000_change_orders_from_messages.sql`).

## What it does

**`draft_estimate_line_from_message(p_message_id, p_estimate_id, p_line, p_replaces_last, p_seen_at)`** returns `drafted_estimate_id`, `drafted_estimate_number` and `drafted_line_number`. It is `SECURITY DEFINER`, since `messages` grants no column for the link. It saves the line and stamps the message in one call.

1. **Who**: signed in, not a training account, not a digital twin, and on the office team (`gc_office_team()`). Each refusal is in words. All five office roles are already inside `estimates_insert` and `estimates_update_draft`, so the definer gives no new right over estimates.
2. **The message**, locked: refused when it is a line on an estimate already, so it is never drafted twice.
3. **The kernel's refusals**, in its words:
   - a contact who is not a customer, named by kind, with all eight kinds R0 gives;
   - a message on no Pipeline job (`messages.jobs_ledger_id`);
   - a job that is not the contact's customer's;
   - a billed or paid job.
4. **The line**, in the estimate's own shape. Its amount is worked out here from how many and the price, and it is never below zero. A line with no name and no description is refused.
5. **The job's open estimate** is the newest draft estimate that a message tied to the same Pipeline job points at.
   - `estimates.job_ledger_id` cannot say it. It is unique, the link to the job an estimate created, and a draft for a job that already exists never carries it.
   - With `p_estimate_id`, the draft is locked. It must still be a draft estimate, for the job's customer, with a message on this job pointing at it.
   - Its `updated_at` must equal `p_seen_at`, else *changed since you opened it*.
   - A draft with options is refused, since its lines are the options' to change.
   - The line is added, or takes the place of the last line when `p_replaces_last`. The total is the sum of the lines, as the page keeps it.
6. **A new draft** when `p_estimate_id` is null. It is refused when the job has an open one already, which a press on another of its messages may have started. The job's row is held, so two first lines start one draft.
   - It is owned by `company_owner_user_id()`, else the caller. It is made by the caller, for the job's customer, titled with the job's name, at the job's address.
   - It takes `job_ledger_id` only while no estimate holds that job, so a signed one never makes a second job through `autoCreateJobGuard`. A race for the link falls back to no link.
7. **The stamp**: `messages.estimate_id` is set to the estimate.

`EXECUTE` is for `authenticated` only. No new table, so no fence calls.

## Why the client sends `p_replaces_last`

The kernel decides whether the line takes the place of the draft's blank or placeholder last line (`isReplaceableStubLine`). The definer takes that answer with the draft's `updated_at` as the client read it. An unchanged `updated_at` means the lines the kernel judged are the lines here, so the rule keeps one home in the kernel and is not copied into SQL. The client sends `updated_at` exactly as the read gave it, never through a `Date`, which would drop the microseconds.

## Safety

- `SET lock_timeout = '3s'`. `CREATE OR REPLACE FUNCTION` takes no lock on a table.
- Idempotent: a new function with its grants, restated on a re-run.
- **Old clients**: nothing calls it until this PR's client ships, so the order of the push and the deploy does not matter.

## The bed

`npm run test:pg:messages-spine` (`supabase/tests/messages_spine/20_scenario.sql`, section 13) presses as the estimator through RLS and checks:
- a first line starts the kitchen's draft as line 1, for the customer, holding the job's free link;
- a message on an estimate is not drafted twice;
- a second line joins the draft as line 2, its amount worked out here and the total the sum;
- a second new draft on a job with one open, and a draft read before it changed, are refused;
- a billed job, a job not theirs, a trade partner's line, a customer's line on no job and a line that says nothing are refused, in words;
- the laundry's draft goes without the job link an older estimate holds;
- a line marked to replace takes the place of the draft's last;
- a draft with options is refused;
- training mode, a digital twin and a superintendent are refused, and `anon` cannot call it.

It runs in CI on this PR (SQL beds), since no Docker or Postgres server is reachable from the office Mac.

## Follow-ups (recorded in the plan)

- The customer's own drafts on Estimates, offered as candidates by address. A draft the office made by hand for the job holds no message, so the press does not find it yet.
- The guard rule for a draft whose job link was taken: a signed estimate a message points at should skip auto-create. This touches `_shared/autoCreateJobGuard.ts`, its app twin and `auto_create_job_from_signed_estimate`.

## After the push

The types regenerate from prod in one types PR. `lineFromMessageIo.ts` then drops its untyped client.
