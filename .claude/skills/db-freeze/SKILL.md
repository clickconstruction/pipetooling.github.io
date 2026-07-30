---
name: db-freeze
description: Live forensics when the app looks "database down" — find the lock blocker before anyone restarts. Runs the docs/DB_FREEZE_RUNBOOK.md playbook.
---

The user reports the app frozen / "database down". Follow
`docs/DB_FREEZE_RUNBOOK.md` (read it first — it carries the evidence from the
2026-07-30 investigation and the reasoning). Summary of what you do:

1. **Do not suggest restarting yet.** Restarts destroy the evidence and only
   help by accident (they kill the lock holder).
2. Run, in parallel where possible (all read-only against the linked prod):
   - `supabase inspect db blocking`
   - `supabase inspect db long-running-queries`
   - `supabase inspect db locks`
3. Interpret:
   - **Blocker found** → report its pid, statement, source, and hold time.
     Recommend `select pg_terminate_backend(<pid>);` (Dashboard → SQL editor —
     the user runs it; a single backend kill is data-safe, its transaction
     rolls back). Do NOT run DDL or restarts yourself.
   - **CLI cannot connect at all** → instance-level problem; check
     https://status.supabase.com, then a restart is justified — say so.
   - **Nothing blocked, queries genuinely slow** → capacity/plan problem after
     all; capture `supabase inspect db outliers` + `db-stats` and investigate
     the specific queries.
4. Afterwards (or if the user already restarted): in Dashboard → Logs →
   Postgres search `still waiting` (names blocker pids retroactively),
   severity=Error for the timeout cluster, and `terminated` to rule real
   crashes in or out. Ask the user to open the dashboard in your browser pane
   if you need it.
5. Report findings in plain language: what froze, who blocked it, what was
   done, and whether any standing protection (idle-in-transaction timeout,
   lock_timeout convention) needs adjusting. Update
   `docs/DB_FREEZE_RUNBOOK.md` if the incident taught something new.
