# Database freeze runbook

---
file: DB_FREEZE_RUNBOOK.md
type: Runbook
purpose: What to do (and what Claude does via /db-freeze) when the app looks "database down"
audience: Devs + AI agents
last_updated: 2026-08-14
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

> Companion evidence: `docs/runbooks/SUPABASE_INCIDENT_RUNBOOK.md` Phase B2 reads the
> other half of the monitor — `monitoring.connection_samples` / `connection_totals` /
> `checkpoint_activity` — while this runbook leans on `monitoring.health_checks`.
> Pull both when reconstructing a freeze window.

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

**Host metrics — checked, and they clear us.** 31 active backends on a
t4g.medium's 2 vCPUs looked like it might be self-inflicted CPU saturation. It
was not. Dashboard → Observability → Database for 10:04–13:04 local shows, right
through the outage:

| metric | during the freeze | ceiling |
|---|---|---|
| CPU usage | ~2–10%, one bar ~25% at 12:26 | 100% |
| Disk IOPS (read+write) | flat at ~0, one trivial blip at 12:26 | 3,000 |
| Disk throughput | flat | 125 MB/s |
| Memory | 3.74 GB used, large free band, no swap | 5.59 GB |

**Every host resource was idle while the instance could not fork a worker or
answer a single-row query.** So the active-backend pileup was a *symptom* —
queries accumulating because nothing could make progress — not the cause. The
only positive signal is a small **IOwait** component on that one 12:26 CPU bar
(the sole red bar in three hours), coinciding with the onset.

This is the "idle host freeze" signature, and it is Supabase's to explain, not a
query to tune. Caveat: these are ~2-minute buckets read off the charts, and a
stalled host can under-report its own metrics — but the series is continuous
through the window, so it was collecting.

Host metrics are **dashboard-only** — not exposed via the CLI or MCP. Capture
them while the window is still in retention.

### 2026-08-11 — Mode B again (intermittent stalls 19:22–20:32 UTC, self-recovered)

Office reported the app frozen ~20:30 UTC. Step 0: `http-only` 401 in 0.24s,
`db-touching` hung to the 20s timeout — freeze confirmed. CLI could not connect
(pooler `failed to receive message: context deadline exceeded` — timed out
before even an `EAUTHQUERY` came back), so live forensics were blind, as in the
07-31 incident. Step 2 after recovery gave the whole picture:

- **Four sampler gaps** in `monitoring.health_checks`: 19:22–19:24 (120s),
  19:38–19:40 (120s), 19:45–19:48:20 (200s, `sample_duration_ms` 787 on the
  recovery row), and **20:27–20:32 (300s)** — the office-visible one.
- **cron jobs 5 + 13 both failed** with `job startup timeout` at 19:39 (37s)
  and 19:46 (2m19s) — the decisive can't-fork-workers signal.
- **Zero `wait_event_type = 'Lock'` rows across 4 hours**; 1–6 active backends
  with NULL wait events; `io_wait_backends = 0` throughout. No pileup, no
  contention — the idle-host-freeze signature again.
- **Recovered without a restart** — first Mode B that self-healed. The 20:27
  stall ended at 20:32:00 while the restart decision was still being weighed;
  a re-probe returning `200 t=0.5s` is what caught it. Re-probe before
  recommending the restart — a stall that has already ended needs neither.
- Status page: no relevant incident posted (again).

Practical additions proven this time: when the Supabase MCP is unavailable,
`psql` over the **session pooler** (port 5432, `postgres.<ref>` user,
`SUPABASE_DB_PASSWORD` from `.env.local`) runs every Step 2 query; and the
worktrees are not linked — run `supabase inspect` from the main checkout.

Open item: 4 stalls in 70 minutes is a cluster, not a one-off. If it recurs,
restart on the Step 0 + CLI-unreachable evidence alone (Mode B is established
for this signature), and capture Dashboard host metrics for 19:00–20:40 UTC
while the window is in retention. *(It recurred 2026-08-14; the entry below
followed this guidance.)*

### 2026-08-14 — Mode B (10-minute stall 17:13–17:23 UTC, ended by restart)

Third Mode B in 2.5 weeks. Restarted on Step 0 + CLI-unreachable evidence per
the 08-11 open item; office-visible downtime ~10 minutes.

- **Step 0**: `http-only` 401 in 0.21s; `db-touching` hung to the timeout on
  three probes over ~3 minutes (20s/20s/25s). Freeze confirmed immediately.
- **CLI blind**: `supabase inspect` failed initialising its login role —
  `Failed to create login role: Connection terminated due to connection
  timeout` — timing out before even an `EAUTHQUERY`, as on 08-11.
- **Restart** from the Dashboard at ~17:21; Step 0 re-probe returned
  `200 t=0.24s` by ~17:25. Sampler resumed 17:23:00.
- **Step 2** (run via the Dashboard SQL editor): single
  `monitoring.health_checks` gap **17:13:00 → 17:23:00 (599.8s)** — the only
  gap in 6 hours. **No leading indicator this time**: `sample_duration_ms`
  was 7–28ms right up to the last pre-gap sample (unlike 07-31's 40–350×
  spikes). Abrupt onset, with one hiccup at 17:10 — 10 active backends
  (NULL wait event) and the minute-cron jobs starting 8–9s late — then
  clean samples 17:11–17:13, then the hard stall.
- **`cron.job_run_details` shows zero failed rows** — a different
  presentation from 07-31/08-11's `job startup timeout` entries. Jobs 5 and
  13 last ran 17:12:00, then nothing until 17:23:00. Read: the stall was
  ended by a restart, which discards uncommitted in-flight run records —
  so a *silent* cron gap (no failure rows) is what Mode B looks like when
  you restart mid-stall, and it does not rule Mode B out.
- **Zero `wait_event_type = 'Lock'` rows** across the window;
  `io_wait_backends = 0` in every sample. Post-restart `total_conns`
  dropped 62 → 26–34 (fresh pools) — a useful recovery marker.
- **Host metrics** (captured in retention, 16:29–17:29 UTC): memory steady
  3.73 GB with a free band and no swap growth; CPU mostly <10% with a
  cluster of ~25–30% bars carrying a visible **IOwait** component at
  17:15–17:22 — the same "only positive signal is IOwait at onset" as
  07-31; disk IOPS ~7, throughput ~flat vs the 125 MB/s ceiling; network
  spike ~1.5 MB/s at 17:23 = client reconnect burst. Idle-host freeze
  signature, again.
- **Status page**: nothing for us-east-1 database runtime (again). The only
  active incident was "Project access, updating and creation impacted in
  us-east-2" — wrong region, management plane.
- **Gaps hit during response**: `SUPABASE_DB_PASSWORD` is not in
  `.env.local` (contrary to the 08-11 note), so the psql session-pooler
  fallback was unavailable, and the Supabase MCP was unauthenticated in the
  session. The post-mortem ran through the Dashboard SQL editor instead.
  Restore the password to `.env.local` to make Step 2 runnable headless.

Escalated: support ticket filed 2026-08-14 (Database unresponsive /
severity High, project selected, "Allow support access" left on) asking
Supabase to inspect the underlying instance/volume across the three
windows and migrate the project to fresh hardware if suspect. Replies go
to the account email — attach the three incident write-ups when the
acknowledgment email arrives (the form takes no attachments pre-submit).
Note: the confirmation screen said "logged for No specific project"
despite the project being selected; the ticket body leads with the
project ref, but verify the association in the acknowledgment email.

## Known non-issues (checked 2026-07-30, don't re-litigate without new evidence)

- Compute: Medium (t4g.medium) is generously sized. Re-confirmed 2026-07-31 with
  host metrics captured *during* an outage: CPU, IOPS, disk throughput and
  memory were all idle while the database was unreachable. Capacity is not the
  problem — stop proposing an upgrade as the fix.
- Replication slots healthy (0 lag); WAL at the default 1 GB ceiling; vacuum
  current; no bloat; connections ~54/120.
- The `supabase inspect db outliers` view only sees the `postgres` role's
  queries — app (PostgREST) traffic is invisible there; use Dashboard →
  Observability → Query Performance for all-role query stats.
