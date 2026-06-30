# Supabase incident runbook (CLI + logs)

**AI agents:** start with **[AGENT_APP_CRASH_INVESTIGATION.md](./AGENT_APP_CRASH_INVESTIGATION.md)** (short checklist). **Quick capture:** [`scripts/capture-supabase-incident.sh`](../../scripts/capture-supabase-incident.sh) from repo root.

Use this when the app feels like it **crashed**, **spins**, or **times out**, and you want evidence before changing schema or infra.

## Preconditions

1. **Supabase CLI** installed (`supabase --version`). Update periodically; newer builds add inspect fixes.
2. **Linked project** from repo root:

   ```bash
   cd pipetooling.github.io
   supabase projects list   # confirm ● on your production project
   ```

   If not linked:

   ```bash
   supabase link --project-ref <YOUR_PROJECT_REF>
   ```

   Use `SUPABASE_DB_PASSWORD` in CI/non-interactive environments. If **`inspect`** fails with **SQLSTATE 28P01** (*password authentication failed* for `cli_login_postgres`), update the **database password** in Dashboard, then **`supabase link`** again (or export `SUPABASE_DB_PASSWORD`) and retry.

3. **CLI vs Dashboard**: The CLI connects to **Postgres** for `inspect db`. It does **not** download hosted **Logs Explorer** (API gateway, Auth service stdout, etc.). For those, use **Dashboard → Logs** export or a **log drain** (see below).

---

## Phase A — Classify the incident (copy this table)

Fill in **during** or **immediately after** the event:

| Field | Your notes |
|-------|------------|
| **UTC time window** (start–end) | |
| **Symptom** (white screen / stuck spinner / toast / partial outage) | |
| **Who** (all users / one role / one geography) | |
| **Correlated action** (many clock-outs, bulk approve, deploy, migration) | |
| **Browser Network** — failed request **path** (e.g. `/rest/v1/clock_sessions`) | |
| **HTTP status** (502, 503, 504, 429, 401, 500, …) | |
| **Dashboard** — database / project health anomaly? | |

---

## Phase B — Postgres live inspect (same moment as pain, if possible)

Run from **repo root** (`pipetooling.github.io`):

```bash
supabase inspect db blocking --linked
supabase inspect db locks --linked
supabase inspect db long-running-queries --linked
supabase inspect db outliers --linked
supabase inspect db calls --linked
```

**Bundle** (writes CSVs under `docs/runbooks/supabase-inspect-snapshot/<date>/`; directory is gitignored):

```bash
mkdir -p docs/runbooks/supabase-inspect-snapshot
supabase inspect report --linked --output-dir docs/runbooks/supabase-inspect-snapshot
```

Save stdout or the CSV folder and attach to an incident ticket or chat **with secrets removed**.

---

## Phase B2 — Connection-usage monitor (historical peak: *who* held the pool)

The recurring outages are **connection-pool exhaustion** (`max_connections = 90`, Small compute): when the pool fills, Realtime's CDC poller is starved (`:queue_timeout`) and the platform restarts Postgres. A live `pg_stat_activity` snapshot *after* recovery is useless — the storm is over. So a 1-minute sampler records the breakdown into a private `monitoring` schema (migration `20260630180000_connection_usage_monitor.sql`; not exposed to PostgREST). Use it to answer **"how close to 90 did we get, and which service held the connections?"** — the evidence that decides *free `max_connections` bump vs. compute upgrade*.

```sql
-- 1) Daily peak total vs the 90 ceiling (is the wall actually being hit?)
select date_trunc('day', sampled_at) as day,
       max(total_conns) as peak_conns, max(pct_of_max) as peak_pct
from monitoring.connection_totals
group by 1 order by 1 desc;

-- 2) The worst few sample instants (drill into these timestamps next)
select * from monitoring.connection_totals order by total_conns desc limit 10;

-- 3) Service breakdown during an incident window (fill in the UTC range from Phase A)
select date_trunc('minute', sampled_at) as minute, service, sum(cnt) as conns
from monitoring.connection_breakdown
where sampled_at between '2026-06-30 16:55+00' and '2026-06-30 17:05+00'
group by 1, 2 order by 1, conns desc;

-- 4) Composition at the single peak instant
select service, sum(cnt) as conns
from monitoring.connection_breakdown
where sampled_at = (select sampled_at from monitoring.connection_totals order by total_conns desc limit 1)
group by service order by conns desc;
```

**Reading it:** `postgrest` (the app's REST pool) is normally the largest consumer, `auth` holds up to a fixed 10, `realtime` a handful. If a peak shows ~90 with `postgrest` dominating, the lever is **more headroom** (raise `max_connections` / upgrade) and/or **less app demand**; if `auth` 10 + idle bloat dominate, the **Auth percentage-based** switch + idle-connection trimming help. Retention is 14 days (rolling). To pause sampling: `select cron.unschedule('connection-usage-sample');`

---

## Phase C — Platform logs (historical API / Auth / Postgres service logs)

The **hosted** log streams are in **Supabase Dashboard → Logs** (or Observability → Logs). For the **same UTC window** as Phase A:

1. Query **`postgres_logs`** for errors (deadlock, timeout, out of memory, restart).
2. Query **API / gateway** logs for **5xx** and latency.
3. Query **`auth_logs`** if session/auth correlated.

**Export**: use the UI action to download results (often CSV/spreadsheet). **Redact** JWTs, keys, and magic links before sharing.

**Preferred — Supabase MCP (v2.590+)**: The project has a Supabase MCP connected ([`.mcp.json`](../../.mcp.json), hosted HTTP + OAuth), so an agent can pull hosted logs **without** the Dashboard UI: `get_logs` (service: `postgres` / `api` / `auth` / `edge-function` / `realtime` / `storage` — **last 24h**), plus `execute_sql` for live `pg_stat_activity` / `pg_stat_statements` and `get_advisors` for security/performance. This addresses the CLI-only caveat above for recent windows; for windows older than 24h, still export from **Dashboard → Logs**. (Cursor's own Supabase MCP also works if enabled — see [AGENTS.md](../../AGENTS.md).) Redact JWTs/keys before sharing.

**Optional — ongoing**: [Log Drains](https://supabase.com/docs/guides/telemetry/log-drains) to S3, Loki, Datadog, etc., for retention past dashboard limits.

---

## Phase D — Correlate DB behavior with PipeTooling (clock / jobs)

When `inspect` or logs show contention on **`clock_sessions`**, **`jobs_ledger`**, or **`people_crew_*`**:

| Signal in logs / `inspect` | Likely app / DB touchpoint |
|-----------------------------|----------------------------|
| `UPDATE clock_sessions` + wait | Client clock-out / edits: [ClockInOutButton.tsx](../../src/components/ClockInOutButton.tsx), My Time modals, approve/revoke RPCs |
| `jobs_ledger` row updated after session change | Trigger `touch_jobs_ledger_last_work_date_from_clock_sessions` → `refresh_jobs_ledger_last_work_date` — migration `20260408013952_jobs_ledger_last_work_date_clock_sessions_trigger.sql` |
| `people_crew_jobs` / `people_crew_bids` churn | Trigger `clock_sessions_sync_crew_assignments_tr` (job/bid change on **approved** sessions) — `20260402120000_clock_sessions_sync_crew_assignments_trigger.sql` |
| `sync_crew_jobs_from_clock` / `sync_crew_bids_from_clock` in stack | Defined in `20260422120000_approve_clock_sessions_crew_jobs.sql` and related migrations; also called from split/salary/NCNS paths (grep `sync_crew_jobs_from_clock` in `supabase/migrations/`) |
| Many sessions waiting on **one** `jobs_ledger` id | Hot row: many users assigning/updating the same job’s derived `last_work_date` cache — expect **serialization**, not necessarily Postgres crash |

---

## Phase E — Choose fix class (after evidence)

| Evidence | Direction |
|----------|-----------|
| 502/503/504, pooler, **too many connections** | Connection limits, pool mode, reduce duplicate Realtime tabs, client retry/backoff; **not** always a migration |
| `statement timeout`, one query dominates `outliers` / `calls` | Index / rewrite query / batching; may be migration |
| `deadlock detected` | Capture both statements from `postgres_logs`; fix lock order or shorten transactions (migration/RPC) |
| Blocking chains on **same table** you recognize from Phase D | Narrow trigger/RPC scope, defer work, or advisory-lock design — **new migration only** (append-only; see [AGENTS.md](../../AGENTS.md)) |
| Only browser white screen, Network **200** | Likely frontend / service worker — see [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) *White screen after app update* |

---

## Deliverable for post-mortem / AI review

Zip or paste:

1. Phase A table (filled).
2. `supabase inspect report` output folder **or** stdout from blocking/locks/long-running-queries at incident time.
3. Exported Dashboard log CSV snippet (**Postgres + API** minimum) for the same window, redacted.
4. One **HAR** or screenshot of Network failing row (path + status; no `Authorization` header).

Together, this replaces “CLI only” (which cannot replay full hosted logs for past incidents).
