# Database freeze runbook

---
file: DB_FREEZE_RUNBOOK.md
type: Runbook
purpose: What to do (and what Claude does via /db-freeze) when the app looks "database down"
audience: Devs + AI agents
last_updated: 2026-07-31
---

The app going "database down" office-wide has (so far) **never been a crash** —
no OOM, no signal 9, no data loss. But it has two distinct causes that need
opposite responses, and telling them apart is the whole job:

| | **Mode A — lock pileup** | **Mode B — instance stall** |
|---|---|---|
| First seen | 2026-07-30 | 2026-07-31 |
| CLI `supabase inspect` | connects fine | **cannot connect at all** |
| `inspect db blocking` | names a blocker | unreachable |
| `wait_event_type='Lock'` | present | **completely absent** |
| Fix | `pg_terminate_backend(<pid>)` | restart is the only lever |

**Do not reflexively restart.** In Mode A a restart destroys the evidence and
only helps by accident (it kills the lock holder). In Mode B it is the correct
and only action. Step 0 below tells you which you are in, in about 30 seconds.

Run `/db-freeze` in Claude Code and it executes this runbook's forensics.

## The signature (what a freeze looks like)

- App unresponsive everywhere at once; browser consoles show
  `canceling statement due to statement timeout` on ordinary queries.
- Dashboard home may show healthy CPU/RAM — that is the tell. Stalled-but-idle
  = queries **waiting on a lock**, not a capacity problem.
- Realtime error bursts are a symptom (open tabs thrash-reconnecting), not a cause.

## Step 0 — the 30-second triage probe (no DB password needed)

Do this **first**, before the CLI. It needs only the anon key from `.env`, and
it cleanly separates "HTTP tier alive, Postgres stalled" from "everything down":

```bash
set -a; . ./.env; set +a
curl -s -o /dev/null --max-time 20 -w "db-touching: http=%{http_code} t=%{time_total}s\n" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  "$VITE_SUPABASE_URL/rest/v1/app_settings?select=key&limit=1"
curl -s -o /dev/null --max-time 20 -w "http-only:    http=%{http_code} t=%{time_total}s\n" \
  "$VITE_SUPABASE_URL/rest/v1/"
```

Read it like this:

- **`http-only` returns 401 in ~0.1s but `db-touching` hangs to the timeout** →
  the edge/HTTP tier is healthy and Postgres is not answering. Freeze confirmed.
- **Both hang** → networking or a platform outage; check status (below).
- **Both fast** → the DB is fine; the problem is elsewhere (client, auth, realtime).

Any HTTP *response* — even a `400 column does not exist` — means Postgres
answered and parsed SQL. That is a recovery signal, not an error. Don't write a
polling loop that waits for exactly `200`; a wrong column name will loop forever
(this happened on 2026-07-31).

## Step 1 — CLI forensics (Mode A only)

CLI (linked project `yewfzhbofbbyvkvtaatw`; all read-only):

```bash
supabase inspect db blocking              # who blocks whom — THE answer, in Mode A
supabase inspect db long-running-queries  # what has been running/waiting longest
supabase inspect db locks                 # granted vs waiting locks
```

If `blocking` names a blocker: note its `pid`, statement, and how long it has
held. Terminate just that backend (Dashboard → SQL editor):

```sql
select pg_terminate_backend(<blocking pid>);
```

That releases the pileup without a restart (killing one session is data-safe —
its transaction rolls back).

### When the CLI itself can't connect

These pooler errors mean **Supavisor cannot reach Postgres to authenticate you**,
so this entire step is blind — there is no blocker pid to find:

```
FATAL: (EAUTHQUERY) auth_query secret check timed out
FATAL: (ECIRCUITBREAKER) failed to retrieve database credentials after multiple attempts
```

`EAUTHQUERY` comes first; after a few attempts Supavisor trips its breaker and
returns `ECIRCUITBREAKER` until it cools down. When Postgres cannot answer a
single-row credential lookup, you are in **Mode B** — skip to the restart.

**The direct connection is not a workaround.** `db.<ref>.supabase.co` resolves
**IPv6-only** on this project (no IPv4 add-on), so `--db-url` on port 5432 fails
with `no route to host` from any IPv4-only network regardless of credentials:

```bash
supabase inspect db blocking --db-url "postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres"
```

Making this a real fallback requires buying the IPv4 add-on. Worth considering —
it is the only path that survives a circuit-broken pooler — but note that in a
true Mode B stall Postgres answers nobody, so it likely would hang too.

## Step 2 — the post-mortem queries that actually work

**This is the highest-value section.** `monitoring.*` and `cron.job_run_details`
are ordinary tables inside the database, so they **survive a restart**. They gave
the complete 2026-07-31 picture in three queries, after the instance was back,
while every live-forensics path had been blind from the first second.

Run these via MCP `execute_sql` or the SQL editor (read-only).

**a) Find the freeze window — gaps in the per-minute sampler.** Cron job 13
runs `monitoring.sample_connections()` every minute; a gap means the DB could not
run a 20ms query:

```sql
with s as (
  select sampled_at, total_conns, active_conns, io_wait_backends, sample_duration_ms,
         lag(sampled_at) over (order by sampled_at) as prev_at
  from monitoring.health_checks
  where sampled_at > now() - interval '4 hours'
)
select prev_at as gap_start, sampled_at as gap_end,
       extract(epoch from (sampled_at - prev_at)) as gap_seconds,
       total_conns, active_conns, io_wait_backends, sample_duration_ms
from s
where prev_at is not null and extract(epoch from (sampled_at - prev_at)) > 90
order by sampled_at;
```

**b) Did the postmaster stop forking workers?** The decisive Mode B signal:

```sql
select start_time, end_time - start_time as duration, jobid, status, return_message
from cron.job_run_details
where start_time > now() - interval '3 hours'
  and (status <> 'succeeded' or end_time - start_time > interval '5 seconds')
order by start_time desc;
```

`status = 'failed'` with **`job startup timeout`** means pg_cron could not get a
background worker started *at all*. That is resource starvation below the SQL
layer — no query tuning will help.

**c) Was anything actually lock-blocked?**

```sql
select sampled_at, state, wait_event_type, sum(cnt) as conns
from monitoring.connection_samples
where sampled_at > now() - interval '3 hours'
group by 1,2,3 having sum(cnt) > 1
order by 1, conns desc;
```

`wait_event_type = 'Lock'` present → Mode A. Backends `active` with
`wait_event_type = NULL` → they were running/runnable, **not** blocked; Mode B.
Also watch `idle in transaction` counts here.

### Leading indicator

`monitoring.health_checks.sample_duration_ms` normally sits at **10–30ms**. It
spiked 40–350× *before* both 2026-07-31 outages. **A sampler consistently over
~250ms is an early warning** and is worth alerting on — it buys 90 minutes.

## Step 3 — Postgres logs (narrow window only)

Dashboard → Logs → Postgres, or MCP `get_logs` (returns only the last few
minutes in practice, despite claiming 24h — for anything older use the Dashboard
with an explicit window):

- Severity **Error** → the `canceling statement due to statement timeout` cluster
  timestamps the freeze.
- Search **`still waiting`** → Postgres names blocked/blocker pids retroactively
  (`process X still waiting for ShareLock … blocked by process Y`). **Mode A only** —
  absent in Mode B, which is itself confirmation.
- Search **`terminated`** → distinguishes real crashes (signal 9 / OOM — never
  seen so far) from our own restarts (`administrator command`).

Also check https://status.supabase.com. The component list is often "all green"
while a project is dead — on 2026-07-31 Database and Connection Pooler both
showed 100% uptime during an 8-minute outage. The Atom feed is easier to scan
than the page:

```bash
curl -s https://status.supabase.com/history.atom | grep -oE "<title>[^<]*</title>|<updated>[^<]*</updated>"
```

## Restarting, and what recovery looks like

Restart from Dashboard → Settings → General → Restart project.

**Expect ~2 minutes of continued failure afterward — this is normal, not a failed
restart.** On 2026-07-31 there were 106 seconds between `received fast shutdown
request` (17:34:11) and `database system is starting up` (17:35:57). During that
window probes returned Cloudflare **520/525** or kept hanging. Do not conclude
the restart didn't work and start escalating; re-probe with Step 0 until a real
HTTP status comes back.

## Second opinion: the smoke suite as an on-demand prod probe

If the inspections come back clean, get an independent read before concluding
anything — the CLI connects as `postgres` and proves only that *one* path works:

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

## Standing protections

- `idle_in_transaction_session_timeout = 60s` database-wide (migration
  `20260730231000`) — kills sessions that hold locks while idling in an open
  transaction, the classic silent blocker. **Note:** a freeze that persists past
  60s is therefore *not* a plain idle-in-transaction blocker — that is a useful
  Mode A/B discriminator on its own.
- Every migration starts with `SET lock_timeout = '3s'` (CI-enforced) so DDL
  fails fast instead of queueing the whole app behind it.

## Incident log

### 2026-07-30 — Mode A (three freezes in one afternoon)

CPU peaked at 12% all day, RAM steady, DB ~245 MB, 99% cache hit, zero crash/OOM
entries. `inspect db blocking` named the culprit each time. Full detail in
`RECENT_FEATURES.md` v2.1136. Produced the `idle_in_transaction_session_timeout`
migration.

### 2026-07-31 — Mode B (8-minute stall, 17:26:01–17:34:06 UTC)

Ended by a manual restart. Established Mode B and everything in Step 2.

- **`cron.job_run_details`**: jobs 5 and 13 scheduled 17:27:00 both failed after
  **425.8s** with `job startup timeout` — the postmaster could not fork a
  background worker for seven minutes.
- **Zero** `wait_event_type = 'Lock'` rows across 2.5 hours. Not lock contention.
  At onset (17:26:01): 42 idle, **15 active with `wait_event_type = NULL`** —
  running, not blocked. `pg_terminate_backend` had no target.
- **Two precursors that self-healed**: 16:01:09 (`sample_duration_ms` = 3,665ms,
  8 conns `idle in transaction`) and 16:18:00 (**31 backends simultaneously
  active**). The final event at 17:26:01 showed 560ms and 15 active.
- `io_wait_backends = 0` throughout — not storage I/O wait as sampled.
- No OOM, no signal 9. Only our own restart in the logs.
- Supavisor returned `EAUTHQUERY` → `ECIRCUITBREAKER`; status page showed all
  components 100% operational; no us-east-1 incident was ever posted.

**Open question — worth resolving before the next one.** 31 active backends on a
t4g.medium's **2 vCPUs** is 15× oversubscription. Two readings fit the same data:
host stalled → backends piled up (Supabase's problem), or a burst of concurrent
app queries saturated CPU → cron worker startup and Supavisor's `auth_query`
starved (ours). Distinguishing them needs host CPU for the window from
Dashboard → Observability, which is not reachable from the CLI or MCP. **Capture
that graph during the next incident** — it decides ownership.

## Known non-issues (checked 2026-07-30, don't re-litigate without new evidence)

- Compute: Medium (t4g.medium) is generously sized on RAM/disk — though see the
  2-vCPU oversubscription question above before calling CPU a non-issue.
- Replication slots healthy (0 lag); WAL at the default 1 GB ceiling; vacuum
  current; no bloat; connections ~54/120.
- The `supabase inspect db outliers` view only sees the `postgres` role's
  queries — app (PostgREST) traffic is invisible there; use Dashboard →
  Observability → Query Performance for all-role query stats.
