# Salaried clock sessions (`salary_schedule`)

> **Audience**: Developers and operators changing pay, My Time, or salary Settings.  
> **Companion**: [`PROJECT_DOCUMENTATION.md`](./PROJECT_DOCUMENTATION.md) (`clock_sessions` + salary tables), [`EDGE_FUNCTIONS.md`](./EDGE_FUNCTIONS.md) (**sync-salary-sessions**), [`MIGRATIONS.md`](./MIGRATIONS.md) (salary migrations).

---

## What this subsystem does

Salaried users get **auto materialized** `clock_sessions` rows with `origin = 'salary_schedule'` from their **workday template** (and optional **per-day override**). Authoritative implementation is **`salary_sync_one_user_clock_sessions`** (latest cumulative replace: **`20270421140000`**, **`20270516120000`** for continuous indexed fragments—see migrations list below).

**High level**

- **`salary_schedule` canonical rows**: For **continuous** templates, sync maintains a **single NULL**-index row per **`work_date`** when present; **split** templates (`mode = split`) maintain up to **two canonical** indexed rows (**`salary_segment_index` 1 then 2**). Rows **close** when **`p_now`** has passed each template block end (**`t_end`** / **`t_end2`**) (**half-open** slot math; **split-mode INSERT** guarded by overlap **`NOT EXISTS`**).
- **`user_punch`**: Ordinary punches are **not** force-closed at template boundaries by the current deployed body (older **`20260404050204`** “mass-close everyone” wording is stale).
- My Time **may split** a **continuous** `salary_schedule` parent into multiple **indexed** `salary_schedule` rows (**`1..N`**). Sync **still skips** inserting a duplicate NULL-index row (**`20270402100000`**) — and **`20270516120000`** closes **open** indexed fragments at **continuous** **`t_end`** once **`p_now ≥ t_end`** (see **[Continuous template mode](#continuous-template-mode)**).
- **Catch-up**: after **`t_end`**, if no canonical **`salary_schedule`** row covers the continuous slot yet (and **`20270402100000`** does not forbid it), INSERT a **closed** **`[t_start, t_end]`** row—or slot 1/slot 2 parallels in split mode—as in the migration SQL.

---

## `clock_sessions` fields (salary-specific)

| Column | Meaning |
|--------|---------|
| `origin` | `user_punch` — hand clock-in/out. `salary_schedule` — created/updated only by sync (and split/replace RPCs for continuous parents). **RLS**: client INSERT must be `user_punch`. |
| `salary_segment_index` | **`NULL`** — one **continuous** canonical row for the day. **`1` / `2`** — **split-template** canonical slots only. Splitting **that** **`NULL`**-index row in My Time can yield **additional** indexed **`salary_schedule`** rows (**`salary_segment_index`** **`1..N`**, same `origin`). Splitting **indexed slot 1 or 2** turns children into **`user_punch`** with **`NULL`** index (see [Split RPCs](#split--cluster-rpcs)). |

Partial unique indexes enforce one continuous row per user/day and one row per (user, day, segment index) for split mode (`20270331140000`).

---

## Configuration tables

- **`salary_work_schedule_templates`** — per-user default: continuous vs split, segment start times and durations, jobs/bids, `exclude_weekends`, timezone default.
- **`salary_work_schedule_day_overrides`** — optional row per `(user_id, work_date)`. A day override is **meaningful** when `mode` or `segment_a_start_local` is set (used to allow weekend work when `exclude_weekends` is true).
- **`user_time_off`** — unpaid inclusive ranges; sync **DELETE**s non-final **`salary_schedule`** rows for that **`work_date`** and **returns**. **Current deployed body**: it does **not** then set **`clocked_out_at`** on **`user_punch`** rows (contrast **`20270331180000`**-era docs). Operators should treat lingering opens separately if needed.

Resolution order for calendar display: **time off → weekend exclusion (when template says weekdays-only and override not meaningful) → day override → template**.

---

## Sync entry points

1. **`salary_sync_one_user_clock_sessions`** — all business rules (SECURITY DEFINER).
2. **`sync_salary_clock_sessions_for_day(p_work_date)`** — `service_role`; loops users with a template. Called by Edge **`sync-salary-sessions`** for the current **America/Chicago** calendar date (cron, ~1–5 min).
3. **`sync_salary_clock_sessions_for_user_day(p_user_id, p_work_date)`** — authenticated; invoked after saving **Settings → Salaried workday**.

---

## Continuous template mode

- Single window `[t_start, t_end)`.
- **After `t_end`:** the **NULL-index** canonical row (if present and editable) is closed at **`t_end`** when **`p_now ≥ t_end`**. **Indexed** fragments from splitting the continuous row are also closed here (**`20270516120000`**). If no NULL-index row exists **and** there are **no** pending indexed `salary_schedule` splits for the day, **catch-up** inserts one closed row `[t_start, t_end]` (when **`NOT EXISTS`** does not forbid it).
- **Inside the window:** if nothing is open, **INSERT** or **UPDATE** (reopen) the single NULL-index row (`approved_at` must be null to reopen).
- **Indexed pending `salary_schedule` rows** (non-final, `salary_segment_index` not null): **no** NULL-index catch-up or open — preserves continuous days that were **split** into multiple `salary_schedule` segments without duplicating a day-start row.
- **Closing those fragments at `t_end`:** when **`p_now ≥ continuous t_end`**, sync sets **`clocked_out_at = t_end`** on **open** (**`clocked_out_at IS NULL`**) **`salary_schedule`** rows that have **`salary_segment_index IS NOT NULL`** for that user/day, only when **`approved_at` / rejected / revoked** are unset and **`clocked_in_at < t_end`** (`20270516120000`). Rows with non-null **`clocked_out_at`** are left unchanged (no clamp past the template end).

---

## Split template mode (two canonical slots)

- Slot **1**: `[t_start, t_end)`. Slot **2**: `[t_start2, t_end2)`.
- **Closes**: each canonical **slot row** (**`salary_schedule`**, **`salary_segment_index` 1 or 2**) is set to **`clocked_out_at = t_end`** / **`t_end2`** when **`p_now`** has passed that slot end (**non-final**, open rows only—for **slot semantics** compare migration **`20270421140000`**).
- **Catch-up** closed rows for slot 1 / 2 if missing after the respective end.
- **Opens** when inside each window and **no** session is open on that day; uses `salary_segment_index` **1** or **2** and segment B job/bid when `use_split_focus`.

Split-mode **NOT EXISTS** overlap checks for canonical slots **1** / **2** treat a session as on the sync day when **`work_date`** matches **`p_work_date`** **or** the **clock-in** civil date in the effective template timezone matches **`p_work_date`** (`20270408153000` — avoids a duplicate empty slot **1** when **`work_date`** and sync day disagree at a boundary).

### Half-open intervals (split overlap)

Canonical INSERT is skipped when **any** non-rejected/non-revoked row **overlaps** the slot window in **half-open** form (`20270408162000` documents this explicitly in SQL):

- Template slot: **`[t_open, t_close)`** (inclusive open, exclusive close).
- Session (for overlap only): **`[clocked_in_at, s_out_eff)`** with **`s_out_eff = COALESCE(clocked_out_at, p_now)`**.
- Overlap test: **`clocked_in_at < t_close AND t_open < s_out_eff`** (slot 1 uses `t_start`/`t_end`; slot 2 uses `t_start2`/`t_end2`).

So a session that ends exactly when the next block begins (**`clocked_out_at = t_end`** and **`t_start2 = t_end`**) does **not** block slot 2. A session **still open** at **`p_now`** blocks canonical slot 2 when **`t_start2 < p_now`** (effective end is **`p_now`**) and **`clocked_in_at < t_end2`** — e.g. a punch that runs past the afternoon block start. A morning-only open session at 11:00 with slot 2 starting at 13:00 does **not** overlap **`[t_start2,t_end2)`** because **`t_start2 < p_now`** is false.

Orphan **NULL-index** `salary_schedule` rows are **deleted** when the effective template for that day is **split** (non-final only).

---

## Split / cluster RPCs

Used from **My Time** and **People Hours** to replace one session or a contiguous same-job cluster with multiple segments:

| RPC | Who |
|-----|-----|
| `split_own_clock_session_segments` | Session owner |
| `split_own_clock_session_cluster` | Owner; cluster must share job/bid |
| `leader_split_clock_session_segments` | Pay/lead editors (`can_edit_clock_sessions_for_user`) |
| `leader_split_clock_session_cluster` | Same; must be same user + job/bid |

**Origin / `salary_segment_index` on new rows (`20270403180000`):**

- Parent **`salary_schedule`** with **`salary_segment_index IS NOT NULL`**: new segments are **`user_punch`**, **`salary_segment_index NULL`**.
- Parent **`salary_schedule`** with **`salary_segment_index IS NULL`** (continuous day): new segments stay **`salary_schedule`** with indices **`1..N`** when `N ≥ 2`; sync **skips** NULL-index inserts while those pending rows exist (see Continuous above).

Week editability uses **America/Chicago** (current week for single session; this or previous week for cluster — see migration comments on each function).

---

## UI references

- **Settings**: [`SalaryWorkScheduleSettings.tsx`](src/components/SalaryWorkScheduleSettings.tsx), [`salaryScheduleEndTimeDisplay.ts`](src/lib/salaryScheduleEndTimeDisplay.ts) (Day end / session end labels, `+1 day`, split first-block default).
- **Dashboard**: [`ClockInOutButton.tsx`](src/components/ClockInOutButton.tsx) — On shift / Off shift when salaried.
- **Calendar**: scheduled salary projection — PTO and template resolution; see [`calendarClockedHoursByDate.ts`](src/lib/calendarClockedHoursByDate.ts) and related.

---

## Staging verification (after deploy)

- Continuous: mid-block first tick opens; end tick mass-closes at `t_end`; late cron inserts fully closed day.
- Split: gap between blocks; second block opens when no open; ends mass-close.
- Manual `user_punch` during a salary day overlaps template windows per **half-open overlap** guards (split-slot INSERT rules); punches are **not** automatically rewritten to **`t_end`** here.
- PTO / no template / excluded weekend: non-final `salary_schedule` deleted, then opens closed at `p_now`.
- **Payroll**: confirm impact when an **approved** session was still open and sync sets **`clocked_out_at`** (product allows this).

---

## Operator notes (Supabase CLI)

- **`supabase db push --linked`** and **`supabase migration list --linked`** work **without Docker**.
- **`supabase db pull`** / **`supabase db diff --linked`** use a **shadow** Postgres (Docker). If you do not use Docker, treat **`supabase/migrations/`** as source of truth and use **Dashboard SQL** or **Supabase MCP `execute_sql`** for one-off verification.
- If remote **`supabase_migrations.schema_migrations`** drifts from local filenames, the CLI will suggest **`supabase migration repair`**; see [`MIGRATIONS.md`](./MIGRATIONS.md).

---

## My Time: cross-row merge (mixed punch / salary rows)

When My Time **merges** multiple `clock_sessions` rows into **one** visual segment while rows differ by **`origin` / `salary_segment_index`**, Save can apply an **affine partition** of that segment onto each row (clock times + shared focus note; job/bid per row unchanged). **Re-sync risk:** a later **`salary_sync_one_user_clock_sessions`** run can still **rewrite or recreate** template-driven **`salary_schedule`** rows for that calendar day (block boundaries; **continuous** indexed fragment closes at **`t_end`**). Product/ops should treat mixed clusters as potentially affected by the next sync.

---

## Migration index (salary session behavior)

| Version | What it changes |
|---------|-----------------|
| `20270331140000` | `origin`, `salary_segment_index`, templates/overrides, initial `salary_sync_*` |
| `20270331180000` | PTO: delete non-final salary rows + skip |
| `20270331191000` | `exclude_weekends` + meaningful override |
| `20270403101000` | No template: delete non-final salary rows for day |
| `20270402100000` | Continuous: conceptually “no duplicate NULL row when indexed split children exist” — behavior kept in `20260404050204` via `v_skip_continuous_null_inserts` |
| `20270403180000` | Split RPCs: indexed parent → `user_punch` children; **sync** overlap guard later **replaced** by boundary model (`20260404050204`) |
| `20270408153000` | Split sync: slot **1** / **2** overlap **NOT EXISTS** uses **`work_date`** **or** **clock-in date in template `tz`** vs `p_work_date` |
| `20270408162000` | Same split overlap math, documented as **half-open** (`clocked_in_at < t_close AND t_open < coalesce(out, now)`); boundary matrix in SQL |
| `20260404050204` | Historical **boundary sync** narrative (**mass-close all origins** at block end, PTO path mass-close at `p_now`); **later** cumulative replaces (**`20270421140000`**) implement **canonical + half-open overlap** behavior without **user_punch** mass-close—read current SQL, not this heading alone |
| `20270516120000` | **Continuous + split fragments**: when `p_now ≥ t_end`, open indexed `salary_schedule` rows close at `t_end`; top-of-file **What this subsystem does** updated for shipped body |

---

## See also

- [`RECENT_FEATURES.md`](./RECENT_FEATURES.md) — v2.419 continuous-split close at `t_end`; v2.249 split overlap TZ; historical v2.228 / v2.229 notes
- [`GLOSSARY.md`](./GLOSSARY.md) — Clock Sessions
