---
name: db-freeze
description: Live forensics when the app looks "database down" — triage lock pileup vs instance stall before anyone restarts. Runs the docs/DB_FREEZE_RUNBOOK.md playbook.
---

The user reports the app frozen / "database down". Follow
`docs/DB_FREEZE_RUNBOOK.md` (read it first — it carries the evidence from the
2026-07-30 and 2026-07-31 investigations and the reasoning). There are two
failure modes needing opposite responses; your first job is telling them apart.

1. **Step 0 first — the 30-second probe, before any CLI call.** Two `curl`s
   from the runbook (anon key only, no DB password): one DB-touching PostgREST
   query and one HTTP-only control. HTTP-only fast + DB-touching hanging =
   Postgres stalled, edge tier fine. Both hanging = platform/network. Both fast
   = not a DB freeze, look elsewhere.
   Any HTTP *response* — including `400 column does not exist` — means Postgres
   answered. Never poll for exactly `200`.
2. **Do not suggest restarting yet** (unless step 3 says Mode B). Restarts
   destroy live evidence and in Mode A only help by accident.
3. Run, in parallel where possible (all read-only against the linked prod):
   - `supabase inspect db blocking`
   - `supabase inspect db long-running-queries`
   - `supabase inspect db locks`
4. Interpret:
   - **Blocker found (Mode A)** → report its pid, statement, source, and hold
     time. Recommend `select pg_terminate_backend(<pid>);` (Dashboard → SQL
     editor — the user runs it; a single backend kill is data-safe, its
     transaction rolls back). Do NOT run DDL or restarts yourself.
   - **Pooler returns `EAUTHQUERY` / `ECIRCUITBREAKER` (Mode B)** → Supavisor
     cannot authenticate you against Postgres, so live forensics are blind and
     there is no blocker pid to find. Check https://status.supabase.com (its
     component list showed 100% green during a real 8-minute outage — trust
     your probes over the page), then say a restart is justified. Do not burn
     time on `--db-url`: the direct host is IPv6-only on this project.
   - **Nothing blocked, queries genuinely slow** → capacity problem; capture
     `supabase inspect db outliers` + `db-stats` and investigate those queries.
5. **After recovery, run the Step 2 post-mortem queries from the runbook** —
   this is the highest-value step and works even when everything above failed.
   `monitoring.health_checks`, `monitoring.connection_samples` and
   `cron.job_run_details` live inside the database and survive restarts:
   - gaps > 90s in the per-minute sampler → the exact freeze window;
   - `cron.job_run_details` status `failed` / `job startup timeout` → the
     postmaster could not fork workers (Mode B, decisive);
   - `wait_event_type` — `'Lock'` present = Mode A; backends `active` with NULL
     wait event = running, not blocked = Mode B;
   - `sample_duration_ms` normally 10–30ms; sustained >250ms is an early warning.
6. Postgres logs (Dashboard → Logs, or MCP `get_logs` — which only returns the
   last few minutes in practice): `still waiting` names blocker pids
   retroactively (Mode A only), severity=Error timestamps the freeze, and
   `terminated` rules real crashes in or out.
7. If the user restarts, tell them to **expect ~2 minutes of continued failure**
   (Cloudflare 520/525 or more hanging) — that is a normal boot, not a failed
   restart. Re-probe with Step 0 until a real HTTP status returns.
8. Report findings in plain language: what froze, which mode, what was done, and
   whether any standing protection (idle-in-transaction timeout, lock_timeout
   convention) needs adjusting. Add an entry to the runbook's incident log and
   update the playbook if the incident taught something new.
