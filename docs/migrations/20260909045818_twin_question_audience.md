# 20260909045818_twin_question_audience.sql (2026-09-09, v2.3186)

Adds `twin_questions.audience text NOT NULL DEFAULT 'estimator'` with a CHECK on `('estimator', 'operator')`, a partial index on open rows, and a one-time backfill that moves the open machine-side questions (sandbox, sign-in, the write fence, a table or tool name, a file the service account can't read, a leading "ANSWER PARKED") to `'operator'` using the same signals as `supabase/functions/_shared/twinQuestionAudience.ts`. Answered and dismissed history is untouched.

Shipped with PR #2894 (v2.3186 — robot questions get an audience). Additive and idempotent; `NOT NULL DEFAULT` is metadata-only on PG17.

Order: client first (it reads `select('*')` and classifies from the text when the key is missing; the bounce buttons hide until the column exists), then `supabase db push`, then `supabase functions deploy twin-mcp` (the function retries the insert without the column if it is deployed early, so either order is safe there).
