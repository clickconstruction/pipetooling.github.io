# 20260905200000_schedule_hidden_block_counts.sql (2026-09-05, v2.2892)

Superintendent's Schedule board — grey "busy" placeholders and a true Expected Manpower total (journey-map Tier-2 #23, J18-F2 / N2). Idempotent (`CREATE OR REPLACE` throughout); no tables, so no read-only re-apply calls are needed.

1. **`public.is_superintendent()`** — STABLE SECURITY DEFINER role helper (mirrors `is_controller()` / `is_primary()`): `users.role = 'superintendent'` for `auth.uid()`. EXECUTE: authenticated, service_role.
2. **`public._schedule_total_block_counts(p_start date, p_end date)`** — internal, SECURITY DEFINER (RLS bypassed): per `(assignee_user_id, work_date)` → `total_count`, `total_hours` (`sum(time_end − time_start)` in hours, 2 dp) over **all** `job_schedule_blocks` in range (≤ 62 days). Aggregates only — no ids, no times, no job identity. Gate: `is_superintendent() OR is_master_or_dev() OR is_assistant()` (assistant-like includes controller); anon revoked.
3. **`public.schedule_hidden_block_counts(p_start date, p_end date) → (user_id, day, hidden_count, hidden_hours)`** — the caller-facing RPC, **SECURITY INVOKER** on purpose: its own aggregate over `job_schedule_blocks` runs under the caller's RLS (`job_schedule_blocks_select` + the bid SELECT policy), so "visible" is whatever the policies say today, and hidden = total − visible is computed server-side by joining to (2). Returns only rows with `hidden_count > 0`. Same gate as (2); anon revoked.

**Why a pair.** A single SECURITY DEFINER body cannot see the caller's RLS-filtered set (it runs as the owner), and copying the policy predicate into the function would drift the moment the policy changed. Invoker-outer + definer-inner keeps RLS the one source of truth for visibility while the subtraction stays on the server.

**Order.** Client first is safe — the hub calls the RPC only for `role = 'superintendent'`; until the push that call fails into one warning toast and the board renders as before. Push, then reload.

**Verify after push.**

```sql
select proname, prosecdef from pg_proc
 where proname in ('is_superintendent','_schedule_total_block_counts','schedule_hidden_block_counts');
-- is_superintendent t · _schedule_total_block_counts t · schedule_hidden_block_counts f
-- as a superintendent (impersonate): hidden rows appear; as dev: zero rows.
select * from public.schedule_hidden_block_counts(current_date, current_date + 6);
```
