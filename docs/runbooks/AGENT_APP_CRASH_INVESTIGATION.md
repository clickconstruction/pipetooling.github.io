# Agent playbook: app crash / outage / Supabase load

**Use when the user says things like:** *find why the app crashed*, *outage*, *Supabase down*, *everyone stuck loading*, *503 / timeout*, *database slow*.

**Not this playbook alone:** pure **white screen** with **200** responses — start with [`TROUBLESHOOTING.md`](../TROUBLESHOOTING.md) (*White screen after app update*) and `TROUBLESHOOT_404.md`.

---

## Ask first (or use if user already provided)

- **UTC** time window (start–end).
- **Symptom** (blank UI vs spinners vs toasts; all users vs subset).
- **Browser Network:** failing **path** (e.g. `/rest/v1/clock_sessions`) and **status** (502/503/504/429/500). **Never** paste JWTs or `Authorization` headers.
- Optional: folder from **`./scripts/capture-supabase-incident.sh`** or prior `inspect` output.

---

## Agent steps (typical)

1. Read this file; skim **Phase D–E** (correlation + fix classes) in [`SUPABASE_INCIDENT_RUNBOOK.md`](./SUPABASE_INCIDENT_RUNBOOK.md).
**Repo root** is the directory that contains `supabase/` and `package.json` (clone root).
3. Run `supabase projects list` — expect **●** on the production project. If `inspect` fails with **password authentication failed** / **SQLSTATE 28P01**, stop: user must **`supabase link`** with current DB password or set **`SUPABASE_DB_PASSWORD`** in the shell (never echo secrets).
4. Run **`supabase inspect db`** from repo root, **in order** (fast signals first):
   - `blocking` → `locks` → `long-running-queries`
   - then `outliers`, `calls`, **`inspect report`** (slower)
5. Map blocking/slow query text to app tables using **Phase D** in [`SUPABASE_INCIDENT_RUNBOOK.md`](./SUPABASE_INCIDENT_RUNBOOK.md) (`clock_sessions`, `jobs_ledger`, `people_crew_*`, triggers).
5b. **Realtime `:queue_timeout` / DB-unresponsive / restart?** Do **not** assume connection-pool exhaustion — that error fires whenever Realtime can't reach the DB, **including when the DB is frozen, not full** (confirmed 2026-06-30: crashed at 49/90 conns). Query the **monitor** (Phase B2 in [`SUPABASE_INCIDENT_RUNBOOK.md`](./SUPABASE_INCIDENT_RUNBOOK.md)) to **distinguish two diagnoses**: (a) **true exhaustion** → `monitoring.connection_totals` climbs toward 90 → `max_connections`/compute/demand levers; (b) **infra freeze** → conns well under 90 + a **sampling gap** + **checkpoint stall** (`monitoring.checkpoint_activity`: big `write_time_delta_ms`, flat `buffers_delta`) + `io_wait_backends>0` / `sample_ms` spike → **Supabase host/storage issue, escalate with evidence; do not upgrade reflexively.**
6. **Postgres looks healthy** but users saw **5xx** or gateway errors: **CLI cannot pull hosted Logs Explorer** (API/Auth). Tell the user to export **Dashboard → Logs** for the same UTC window ([**Phase C**](./SUPABASE_INCIDENT_RUNBOOK.md)) or use a log drain / MCP logs if available per [`AGENTS.md`](../../AGENTS.md).
7. **Deliverable:** Short verdict — *lock contention* vs *hot query* vs *pool/API* vs *client/SW* — and **next step** (no schema/RPC changes without evidence; migrations are append-only per [`AGENTS.md`](../../AGENTS.md)).

---

## Human shortcut: capture artifacts

From repo root:

```bash
./scripts/capture-supabase-incident.sh
```

Writes under `docs/runbooks/supabase-inspect-snapshot/incident-<UTC>/` (gitignored). Paste that path or zip into chat for the agent.

---

## See also

| Doc | Role |
|-----|------|
| [`SUPABASE_INCIDENT_RUNBOOK.md`](./SUPABASE_INCIDENT_RUNBOOK.md) | Full procedure, Phase A checklist, Dashboard export |
| [`TROUBLESHOOTING.md`](../TROUBLESHOOTING.md) | Disk I/O, long-query SQL, runbook link |
| [`.cursor/rules/supabase-incident-triage.mdc`](../../.cursor/rules/supabase-incident-triage.mdc) | Cursor: natural-language outage prompts → this playbook + inspect / capture script |
| [`RECENT_FEATURES.md`](../RECENT_FEATURES.md) **v2.454** | Client Realtime debounce / visibility / narrower subscriptions |
