# 20261116153000_place_sticker_range.sql (2026-11-15, v2.7406)

Stickers before boxes, punch list #329, design section 10, PR 10: **These are on boxes**. Taunya's go of 2026-11-15 for PRs 8 to 10. A sticker printed with a name cannot shift anything, since the tape reads G78 and it goes on the cage painted G78, so a range of them can go on their boxes in one press with no scan.

## What it makes

One function. No table, so no fence call is owed. `CREATE OR REPLACE`, so a second run changes nothing.

- **`place_sticker_range(p_job_id uuid, p_names text[], p_kind text DEFAULT 'cage', p_place_id uuid DEFAULT NULL, p_where_note text DEFAULT '')`** returns `jsonb`. `SECURITY INVOKER`, granted to `authenticated`, revoked from `PUBLIC` and `anon`.

It is a caller of `place_sticker`, once a sticker, and holds no rule of its own about a sticker or a box: the gate, the box rule, the events' judge and every policy run as they do for one scan. For each name, in the order handed:

| The answer's list | When | What is written |
|---|---|---|
| `made` | the site has no live box of the name, and a blank sticker of it | the box, on `p_job_id`, with the kind, the place and the where line, and every blank sticker of the name on it |
| `took` | the site has a live box of the name, and a blank sticker of it | the sticker on that box; the box is not changed |
| `already` | no blank sticker of the name is left, and one is on a box of the site | nothing |
| `no_sticker` | no sticker of the name was printed for the site | nothing: a box with no sticker is Add a container's business |
| `held` (`{ name, why }`) | the name's own writes were refused | nothing: the name's block is undone, and the rest go on |

`stickers` is how many stickers went on a box. The site is the job's development, every job of it, or the job alone (`on_site_site_job_ids`, #351), read as the caller.

## What it refuses, before anything is written

Not signed in, a training account, a digital twin, a job the caller cannot touch (*That job is not one you can reach. Ask the office to add you to its team.*), a kind that is not a cage, a box or a pile, a place of another job, no names (*Name the stickers that are on boxes, like G78 to G150.*), more than 500 names, and a name off the box rule in `box_name_words`' own words.

## Why a subtransaction a name

"Do what is ready" (`CLAUDE.md`): a hold on one name must not stop the rest. Each name runs in its own `BEGIN … EXCEPTION` block, so a refusal undoes that name's box and placings and is answered with the database's words. A range is 500 names at most, the size of a run. The call writes rows of `job_containers`, `box_sticker_events` and, through the events' trigger, `box_stickers`: row locks only, as a scan takes.

## Why the client sends a list and not a range

As the mint does (`20261115050000_sticker_run_names`): the range parser lives on the client (`src/lib/materials/stickerNames.ts`), and the database holds what it can check on the list itself.

## Order and proof

The client's press calls the function, so `supabase db push` follows the merge at once (`npm run check:calls-ahead` labels the PR *push right after the merge* and holds the deploy until then). Proved by CI's `sticker-names` bed, which gains `supabase/tests/sticker_names/30_place_range.sql` and applies this file a second time: the refusals before a write, one press over a site of two jobs (three boxes made with the kind, the place and the where line, a live box on the other job taking its sticker, a name printed twice putting both stickers on one box, a name never printed making nothing), the same range again changing nothing, a new name in a later call taking that call's kind, a refused name held with its reason while the next is made and only the placed sticker counted, a helper who is not on the job refused, and a training account refused. No local Postgres could start on the Mac this was written on, so the bed on the PR is the proof.

## Not changed

`place_sticker`, the events' triggers and every policy. A numbered sticker has no name and is never placed by this function. A retired box of the name is not brought back: a new box is made, as a scan would make one.

**Applied** to prod by 2026-11-16: `npm run check:migration-drift` read 1326 local files against 1326 applied, this version among them (run in the docs pass after #8111); types regenerated in #8324.
