# 20261114013000_on_site_teammate_guards.sql (2026-11-13, v2.7240)

What a teammate may change on Materials on site (punch list #344, PR 5). The gate on the on-site tables, `on_site_can_touch_job`, says which job a person may write. It never said which columns. A review of the surface found four things the tables let anyone on a job's team do by hand, none of them from a screen. This file closes them with triggers. It creates no table and changes no policy.

## What was open

1. **A box photo could be pointed at any Drive file.** `job_box_photos_update_own` lets the taker update their own row, every column of it. `box-read` streams the file `drive_file_id` names to a signed-out caller through the app's service account. `storage_path` was as free: it could name another job's object in the bucket, which the page would stream, and the sweep would file under this job and delete.
2. **A box's job could be changed by a direct update**, leaving its ledger rows under the old job: the split v2.6808 closed for every other door.
3. **The ledger's who and when were whatever the phone sent.** `by_user_id` and `by_name` could name a teammate. A clock that ran ahead put a row after presses made later, where a count swallows them.
4. **Nothing said when a row reached the office**, which is later than when it was pressed once a press can wait on the phone for signal (v2.7173).

## What it does

Each guard speaks only to a direct caller: `current_user` is `authenticated` or `anon`, the test the stage checklists' triggers use. The photo sweep and the box page run as the service role. A whole-job combine and the dev seat's move run inside definer functions. None of them is touched.

| Object | What |
|---|---|
| `on_site_caller_name()` | The signed-in caller's own name from `users`. Definer, so a role that cannot read `users` still gets its own name and nothing else. Execute for `authenticated` and `service_role`. |
| `job_material_movements.recorded_at` | A nullable `timestamptz`: when the row reached the office. Null on rows written before this file. `at` stays the time of the press. |
| `job_material_movements_stamp` (BEFORE INSERT) | Sets `recorded_at` for every writer. For a direct caller: `by_user_id` is the caller, `by_name` the caller's own name, and an `at` that is null or ahead of the server's time becomes the server's. An earlier `at` is kept: that is a press that waited. |
| `job_container_moves_stamp` (BEFORE INSERT) | The same who and when for a box's own move. |
| `job_box_photos_guard` (BEFORE INSERT OR UPDATE) | On insert the who is the caller, `fail_why` and `refile_due_at` start null, and a row that arrives with a `drive_file_id`, a `filed_at` or the status `filed` is refused. On update a change to `id`, `job_id`, `container_id` or `by_user_id` is refused, and so is a change to `drive_file_id`, `filed_at`, `refile_due_at`, `fail_why`, or a move to the status `filed`. A `storage_path`, when set or changed, must be `<a job's id>/<this photo's id>.jpg`. |
| `job_containers_keep_job` (BEFORE UPDATE OF job_id) | A direct caller cannot change a box's `job_id`. |

**A dev's `by_name` is kept as sent.** The dev seat writes `<agent> · MCP as <dev>` through `dev_on_site_write`, which is `SECURITY INVOKER` and so runs as the dev. The crew's History then says an agent made the row. Its `by_user_id` is still the dev.

**A refusal is `42501`** with its reason as the message, so a press the outbox sends later keeps the reason on the bar.

**What the phone still does**, unchanged: a photo row made as `sending` at its own place or `on-phone` with none; **Send now** (`status` and `storage_path`); **Share instead** (`status`); a box's place, pin, retire, name, kind and where line.

## Locks and safety

`SET lock_timeout = '3s'` first. `ADD COLUMN IF NOT EXISTS` of a nullable column with no default is a catalog change and rewrites nothing. Each `CREATE OR REPLACE TRIGGER` takes a short lock on its table. Every function is `CREATE OR REPLACE`. A second run changes nothing.

## How it was proved

- `supabase/tests/on_site_guards/20_scenario.sql` (`npm run test:pg:on-site-guards`, in `scripts/sql-beds.txt`): a helper on a job's team through RLS, 26 checks. A row and a box move sent in a teammate's name and ahead of time are the caller's, now. A press that waited keeps its time beside when it landed. A dev keeps the agent's label. A photo cannot be filed by the phone, pointed at a Drive file, at another shot's place, at another box or job, or handed to a teammate. The phone's own changes land. The sweep still files as the service role. A box's job is refused to a direct update and still changes for the office's own code.
- Run on a scratch Postgres 15 with a stand-in for the tables around these, the file applied twice. Docker was not available to the login that wrote it, so the bed over the whole schema is CI's.
- A control: with each trigger disabled in turn, the scenario fails at that trigger's first check.

## After the push

- Regenerate the types: `job_material_movements.recorded_at` is new.
- Deploy `box-read`, which this PR also changes (a locked source is refused a right guess too). It does not depend on the migration.
- No client change waits on this file: no screen reads `recorded_at` yet, and every write the app makes already fits the guards.

## Not in this file

- The gate itself. A superintendent or an estimator on a job's team, who cannot read `jobs_ledger` or their own team row, is still let in only once clocked onto the job. Nobody in that position is on a team that holds boxes today.
- `at` behind the server's time. A phone whose clock runs slow still sorts its press early; `recorded_at` now shows the gap.
