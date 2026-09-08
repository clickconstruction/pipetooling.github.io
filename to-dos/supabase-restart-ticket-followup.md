# Supabase support ticket: instance restart loop — follow up

Status: **dated: follow up on 2026-09-14** · filed by the owner 2026-09-07 (evening CDT) from the Supabase dashboard, project `yewfzhbofbbyvkvtaatw`.

## The ask, in the owner's words

"I sent the ticket — add a to-do to follow up in a week."

## What the ticket asked

Why the whole database instance was restarted 30+ times in seven days (crash recoveries per day 09-01 → 09-07: 0 · 0 · 2 · 1 · 8 · 14 · 4, the last at 05:29:51 UTC on 09-07), whether the 09-05/09-06 spike matches anything on Supabase's side (host health-check, hypervisor, auto-restart), and what changed. Evidence in the ticket came from the Postgres logs (`last known up` → `starting PostgreSQL` pairs, no OOM, no shutdown request) and the node exporters (restart with the postmaster; `oom_kill` 0). The runbook carries the full read: [`docs/DB_FREEZE_RUNBOOK.md`](../docs/DB_FREEZE_RUNBOOK.md) → "2026-09-06 — Mode B" and "2026-09-07 — Mode B".

## On 2026-09-14

1. Read the ticket thread in the Supabase dashboard (Support → your tickets). If support asked for anything — logs, a time window, the "Allow support access" toggle — answer it from the runbook and `scripts/pg-logs.sh`.
2. Re-count restarts for the week since filing (read-only, prod):
   ```sql
   with h as (
     select sampled_at, ckpt_write_time_ms,
            lag(ckpt_write_time_ms) over (order by sampled_at) prev
     from monitoring.health_checks
     where sampled_at > now() - interval '7 days')
   select sampled_at from h where ckpt_write_time_ms < prev order by 1;
   ```
   Or the log fingerprint: `scripts/pg-logs.sh <iso_start> <iso_end> 'database system was interrupted'`.
3. Write the outcome into the runbook's 2026-09-07 entry (replace its "What this needs" line with what support said and whether the count went to zero), then delete this file. If the restarts continue and support has no answer, escalate on the same ticket rather than opening a new one — the history is there.

## Where it plugs in

- Runbook entry + Step 3 (`scripts/pg-logs.sh`): [`docs/DB_FREEZE_RUNBOOK.md`](../docs/DB_FREEZE_RUNBOOK.md).
- Logs tooling: [`scripts/pg-logs.sh`](../scripts/pg-logs.sh) (needs `SUPABASE_MGMT_TOKEN` in `.env.local`).
- Live metrics: the privileged `/customer/v1/privileged/metrics` endpoint with the service_role key (pull it fresh with `npx supabase projects api-keys`; do not keep the key on disk).
