# 20261114050000_dev_on_site_rename.sql (2026-11-13, v2.7241)

Materials on site: the dev seat edits a box and fixes a part's typed name. The app does both since v2.7179 and v2.7212. The seat could not, so a site's names could not be tidied through it.

## What it makes

No table. Three new functions and two re-stated ones.

- **`dev_on_site_rename(p jsonb, p_dry_run boolean DEFAULT true)`**, the seat's write, `SECURITY INVOKER`. Its gate is `dev_on_site_write`'s: a dev, not a training account, not a twin, with `agent_label`, on a job `on_site_can_touch_job` allows. Three actions:
  - **`edit_container`**: `{ container, label?, kind?, where? }`. A live box that is not Unsorted. The name in capitals, 1 to 24 characters, refused when another live box of the job carries it. The kind `cage`, `box` or `loose`. The where line 120 at most, and empty clears it. Refused when nothing would change. One `UPDATE` of `job_containers`.
  - **`rename_part`**: `{ from, to }`. The job's typed ledger rows (`part_id IS NULL`) whose cleaned name matches `from` without case. Refused for a parts-book part, an unknown name, a name past 160, and when every row already reads `to`. One `INSERT` into `job_part_renames`; its own triggers do the rest.
  - **`undo_part_rename`**: `{ rename_id }`. Refused when the rename is not on the job, was already undone, or none of its rows still carry its name. One `INSERT` with `undo_of`.
- **`on_site_by_name()`**, the name a rename record is kept under. The caller's own name. Inside `dev_on_site_rename`, which sets `on_site.by_name` for its own transaction and clears it after each write, the seat's stamp `<agent_label> · MCP as <dev>`, and for a dev alone.
- **`on_site_typed_names_on_hand(container, names[])`**, what a box holds of several typed names read as one line, by the arithmetic of `on_site_line_on_hand`. The dry run of a rename that merges two lines reads it.
- **`job_containers_keep_names()`** and **`job_part_renames_judge()`**, re-stated whole from `20261113020000` and `20261113230000` with one change each: the who is `on_site_by_name()` where it was `box_sticker_caller_name()`. `by_user_id` stays `auth.uid()`.

## What a dry run replies

- **An edit**: the box, its code, each field `before` and `after`, what it reads after, and a note on the printed label when the name changes.
- **A rename**: `rows`, `spelled_now` (each spelling the rows carry and how many), `boxes`, `undo_restores` (the spelling most rows carry, which the record keeps as the old name), and `merges`: for each box where `to` is already a line, the two counts and what the one line `becomes`.
- **An undo**: the two names, `rows` against `rows_first_changed`, the boxes, who renamed it and when.

The seat hashes that reply with the ask. An apply runs the dry run again and writes only when the hash is the same.

## Who may do what

| Function | Who |
|---|---|
| `dev_on_site_rename` | `authenticated` may call it; inside, a dev only, never a training account or a twin, and only on a job the on-site gate allows. Every row it writes lands under the caller's own RLS |
| `on_site_by_name` | `authenticated` and `service_role`. It returns the caller's own name, or the setting for a dev |
| `on_site_typed_names_on_hand` | `authenticated`, as the caller: it reads the ledger under the caller's RLS |
| the two trigger functions | nobody directly, as before |

## Locks

`CREATE OR REPLACE FUNCTION` only: no table, column, index, policy or trigger is made or dropped, so nothing waits on a table lock. The two re-stated functions are swapped in place; a press in flight finishes on the old body. `SET lock_timeout = '3s'` is the file's first line all the same.

## Checked before the push

Applied twice to a throwaway local Postgres 15 over stub tables, with the real `on_site_line_on_hand`, `dev_on_site_container`, the name-history trigger and all of `20261113230000`. The walk is listed in `docs/recent-features/v2.7241.md`. What a stub cannot show: the real `job_containers` policies and the fence triggers, which the wrapper leaves to decide as they do for the app.

## Release order

Nothing in the client calls these, so the merge needs no push first. Push on the owner's yes, then deploy `dev-mcp`. Until the push the seat's four verbs answer with PostgREST's refusal of a function it cannot find.

## Verify

Read-only on prod after the push:

- `select proname, prosecdef from pg_proc where proname in ('dev_on_site_rename', 'on_site_by_name', 'on_site_typed_names_on_hand') order by 1` lists the three, with `prosecdef` false, true, false.
- `select pg_get_functiondef('public.job_containers_keep_names'::regproc) like '%on_site_by_name()%'` reads `t`, and the same for `job_part_renames_judge`.
- `select has_function_privilege('anon', 'public.dev_on_site_rename(jsonb, boolean)', 'execute')` reads `f`.
- From the seat, after the deploy: `plan_part_rename` on a ZZ test job, which writes nothing.
