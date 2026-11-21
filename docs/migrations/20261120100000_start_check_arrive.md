# 20261120100000_start_check_arrive.sql (2026-11-20, v2.8110)

Before we start, on arrival. Punch list #382, PR 10 of eleven: the crew's **Is it as told?**. Until this migration the crew read the list and wrote nothing. It adds two functions and no table, so it carries no closing calls. The rows it writes are in the tables of `20261120033820_start_checks.md`.

Nobody is stopped by it. A person is clocked in, and works, whatever they answer.

## The two functions

| Function | What it does |
|---|---|
| `start_check_arrival_state(job)` | A read, `STABLE`, `SECURITY DEFINER`. It answers the one stage to ask about on this job right now, with the bullets on them that nobody of ours has seen, or `stage: null`. A definer read, since the crew reads no stage window by `job_stage_windows`' own policy. |
| `start_check_arrive(fixture, not_as_told uuid[])` | The one door that keeps the answer, `SECURITY DEFINER`. It answers the arrival's id, the Dispatch line's id when there is one, the trip's id, and the two counts. |

## Which stage is asked about

A stage line of the job that is unfinished (`progress_pct < 100`), whose first day of ours has come (`job_stage_windows.window_start <= app_today()`), that nobody has arrived at yet (no row in `start_check_arrivals`), and that has a bullet on them with no live yes we saw (`know = 'saw'`).

- A stage with no days of ours is never asked about. Nobody was sent to it.
- A stage whose days have passed and is still unfinished is still asked about.
- With two such stages, the one whose days hold today leads, then the newest first day.
- A stage is asked about once. The first of ours to answer has answered for the crew. Since `20261120140000_start_check_arrive_once.md` the door holds that too: a second answer is refused by name and keeps nothing.

## What an answer writes

All in one transaction, under a row lock on the stage line that holds two arrivals apart.

1. One row in `start_check_arrivals`: the day, the bullets that were not as told, the trip the person is on today on the job's site when there is one, and the person's name read from their own roster row.
2. Every bullet looked at has its live yes taken back, in the person's name.
3. Each bullet as told gets a new yes: `know = 'saw'`, `how = 'on arrival'`, `source = 'crew'`, tied to the arrival.
4. A bullet that was not as told is left open.
5. With a No, one row in `dispatch_requests`: `pending_action = 'stage_check'`, `priority = 'high'`, the job and the stage line. Its id is written back on the arrival.

A No names a bullet that is on the list to look at, or the call is refused in words: *The list has changed. Open it again.* A stage with nothing left to look at keeps no arrival.

## The line to Dispatch

It rides the road a stage check built (punch list #245, `20261102113000`), so the inbox, the push, the thread and the red wait line are the ones that exist. It differs in one way: there is no checklist question behind it.

- `pending_payload.stage_check` holds `fixture_id`, `question_id: null`, `reason: 'other'`, `stage_name`, `words`, and three keys of its own: `start_check_arrival_id`, `not_as_told` (the bullet ids) and `told_by`.
- The title reads like a stage check's, so the check window can draw it with no live read: *Rough In · “The slab is poured.” · something else: not as told on arrival, and 1 more. Ray told us it was ready*.
- `told_by` is every name that had a live yes on a bullet that was not as told, read before the yes is taken back.
- The self-close triggers of `20261104170000` key on a question, so nothing closes this line by itself. Dispatch closes it, and so may the person who sent it.
- The client reads the payload in `src/lib/startChecks/arrival.ts` (`notAsToldFrom`) and offers **Open the list**, the job window on its Documents tab.

## Who

- The crew on the job (`start_checks_crew`) and the job's desk (`start_checks_desk`), for both functions. A primary is held to `is_job_people` by those gates, and a job shut by its papers is shut here.
- `start_check_arrive` refuses, in words, a caller who is not signed in, an archived caller, a training account and a digital twin.
- `start_check_arrival_state` answers `{ "ok": false }` to an archived caller, a digital twin and anyone off the job.
- `anon` and `PUBLIC` hold no grant on either. `authenticated` and `service_role` do.
- The crew still holds no insert or update grant on any `start_check_*` table. The function is the only way a crew member writes.

## Deploy

The client calls both functions, so the push goes right after the merge (`npm run check:calls-ahead`). In the gap the card's read fails and the card draws nothing: no other screen reads either function.

## Tested

`supabase/tests/start_checks/30_arrive.sql`, 26 checks since `20261120140000`, in one transaction that rolls back, run by `scripts/pgtest-start-checks.sh` after the tables' scenario (`npm run test:pg:start-checks`, in the SQL beds workflow). The migration is applied twice. It covers which stage is asked about with days today, days ahead, days passed and no days, what is listed, a No with the rest as told, the yes taken back in the person's name, what the office saw before left alone, the line to Dispatch with who told us, a stage asked about once, the desk answering, and each refusal.

**Applied** to prod 2026-11-21 at 02:55 UTC with `bash scripts/db-push.sh`, a minute after #9123 merged. Two later migrations were already on prod, so the plain push asked for `--include-all` and the script's retry applied it. The drift check then read 1,415 versions applied against 1,415 local files. Read back, read only: the API answers an anonymous caller of either function with *permission denied* and not a missing name, so the schema cache holds both and `anon` holds no grant. Called as the dev in a read-only transaction, `start_check_arrival_state` answered `{"ok": true, "stage": null}` for both ZZ test jobs, since prod holds no bullet yet. The deploy of main that carried the card passed its calls-ahead step after the push. The dev seat's `call_read` does not know either name until the seat is deployed with the regenerated catalog.
