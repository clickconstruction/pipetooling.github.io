# Database freeze runbook

---
file: DB_FREEZE_RUNBOOK.md
type: Runbook
purpose: What to do (and what Claude does via /db-freeze) when the app looks "database down"
audience: Devs + AI agents
last_updated: 2026-07-31
---

The app going "database down" office-wide has (so far) **never been a crash**.
The 2026-07-30 investigation (three freezes in one afternoon) established the
signature and the playbook. **Do not reflexively restart the instance** — a
restart destroys the evidence (`pg_stat_statements` and all activity state)
and only helps because it kills whatever held the lock.

Run `/db-freeze` in Claude Code and it executes this runbook's forensics.

## The signature (what a freeze looks like)

- App unresponsive everywhere at once; browser consoles show
  `canceling statement due to statement timeout` on ordinary queries.
- Dashboard home may show healthy CPU/RAM — that is the tell. Stalled-but-idle
  = queries **waiting on a lock**, not a capacity problem.
- Realtime error bursts are a symptom (open tabs thrash-reconnecting), not a cause.

Evidence from 2026-07-30: CPU peaked at 12% all day, RAM steady, DB ~245 MB,
99% cache hit, zero crash/OOM entries in Postgres logs. Every "shutting down"
log line was our own restart (`terminating connection due to administrator
command`). Full detail in `RECENT_FEATURES.md` v2.1136.

## During a freeze — 60 seconds of forensics BEFORE any restart

CLI (linked project `yewfzhbofbbyvkvtaatw`; all read-only):

```bash
supabase inspect db blocking              # who blocks whom — THE answer, usually
supabase inspect db long-running-queries  # what has been running/waiting longest
supabase inspect db locks                 # granted vs waiting locks
```

If `blocking` names a blocker: note its `pid`, statement, and how long it has
held. Terminate just that backend (Dashboard → SQL editor):

```sql
select pg_terminate_backend(<blocking pid>);
```

That releases the pileup without a restart (killing one session is data-safe —
its transaction rolls back). Restart the instance only if the CLI itself
cannot connect.

## Second opinion: the smoke suite as an on-demand prod probe

If the three inspections come back clean, get an independent read before
concluding anything — the CLI connects as `postgres` and proves only that
*one* path works:

```bash
gh workflow run e2e-smoke.yml && gh run watch $(gh run list --workflow=e2e-smoke.yml --limit 1 --json databaseId --jq '.[0].databaseId')
```

It cold-loads Dashboard, Stages, Settings, Estimates, Quickfill, People and
Materials against production as a real signed-in user — all Supabase-heavy —
and timestamps every one. A run that passes in ~5 minutes is strong evidence
the app was *not* frozen during that window (2026-07-31: 31/32 passed with
0.5–2.6s page loads while the CLI showed zero blocked locks). A run that
fails everywhere at once, or dies in `auth.setup.ts`, corroborates a real
outage.

## After (or if you restarted anyway)

Dashboard → Logs → Postgres, window around the freeze:

- Severity filter **Error** → the `canceling statement due to statement
  timeout` cluster timestamps the freeze.
- Search **`still waiting`** → Postgres names blocked/blocker pids
  retroactively (`process X still waiting for ShareLock … blocked by process Y`).
- Search **`terminated`** → distinguishes real crashes (signal 9 / OOM — never
  seen so far) from our own restarts (`administrator command`).

Also check https://status.supabase.com — on 2026-07-30 two platform incidents
(Edge deploys, Management API) were live and muddied the picture, though the
Database component was unaffected.

## Standing protections

- `idle_in_transaction_session_timeout = 60s` database-wide (migration
  `20260730231000`) — kills sessions that hold locks while idling in an open
  transaction, the classic silent blocker.
- Every migration starts with `SET lock_timeout = '3s'` (CI-enforced) so DDL
  fails fast instead of queueing the whole app behind it.

## Known non-issues (checked 2026-07-30, don't re-litigate without new evidence)

- Compute: Medium (t4g.medium) is generously sized; RAM/CPU/disk all idle.
- Replication slots healthy (0 lag); WAL at the default 1 GB ceiling; vacuum
  current; no bloat; connections ~54/120.
- The `supabase inspect db outliers` view only sees the `postgres` role's
  queries — app (PostgREST) traffic is invisible there; use Dashboard →
  Observability → Query Performance for all-role query stats.
