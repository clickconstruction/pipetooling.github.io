# 20261109010000 — on_site_job_summary (v2.6743)

Materials on site (punch list #209): the summary RPC for a job past the client's 5,000-row read. No table is created, so no fence is owed.

**`on_site_job_summary(p_job_id uuid, p_since timestamptz DEFAULT now() − 30 days)` → jsonb**, `LANGUAGE sql`, `STABLE`, **`SECURITY INVOKER`**: the ledger's own RLS (`on_site_can_touch_job`) decides what the caller sums, so a job the caller may not touch answers empty, as the screens' read does. `authenticated` may execute it; `anon` may not.

The same arithmetic as `src/lib/materials/onSite.ts` over the whole ledger, in one pass of window functions: each touch of a (container, part) is one row (a count sets the line, the from side takes, the to side adds; a delivery's from side and a use's to side are ignored as `reasonSides` ignores them); a row's **segment** is the number of counts on the line so far, its own included; a segment's total is the count that opened it plus every change after it, and the line's on hand is its newest segment's total. A count's **expected** is the segment before it. The part key folds a typed name as `partKey` does (`text:` + lower, trimmed, spaces collapsed; `id:<part_id>` for a book part); a line carries the first row's name and maker (as the kernel's accumulator does) and the newest row's touch.

The answer:

| Key | What it is |
|---|---|
| `rows` | How many ledger rows the job has. |
| `lines[]` | Every line of every container: `container_id`, `part_key`, `part_id`, `part_name`, `manufacturer`, `on_hand`, `cannot_find_since_count`, `last_touched_at` / `by`, `last_count_at` / `by`, `last_count_diff` (counted − expected at the last count, null when never counted). Zero lines too; the client's `linesOf` filters as it does for the kernel's lines. |
| `last_counts[]` | The newest count on each container: `container_id`, `at`, `by_name` — the stale rule reads it. |
| `diffs[]` | Every count since `p_since`, newest first, with `expected` and `counted` — the Missing section and the week's money read these. |
| `cannot_find[]` | Every Can't find press since `p_since`, newest first, with its `quantity`. |
| `credits` | The `returned` rows, for the credits-due count. |

The client (`onSiteStore.loadJob`) reads the ledger newest first, keeps the newest 5,000 rows for History and the lines, and when the read came back full marks the job capped and calls this; `jobMaterialsSummaryFor` (`onSiteSummary.ts`) then sums from the server's answer through `onSiteServerSummary.ts`, pricing the shortfalls on the device as before. No job on prod is near the cap (the yard job holds about 300 rows), so the first caller is a test.

## Order

Merge, then `supabase db push` **right after the merge**: the client calls the function by name on a capped job, so `check:calls-ahead` labels the PR *push right after the merge* and the deploy holds until the push. Nothing to deploy: the dev MCP's `read_on_site` keeps its own paged read and cap.

**Verify** after the push, read only: `call_read on_site_job_summary { p_job_id: <JP972> }` through the dev seat against `read_on_site` on the same job — every live line's on hand, last count difference and Can't find since should agree, as `on_site_line_on_hand` did on 2026-11-03.
