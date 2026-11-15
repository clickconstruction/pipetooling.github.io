# 20261115050000_sticker_run_names.sql (2026-11-15, v2.7312)

Stickers before boxes, punch list #329, design section 10, PR 7: a run of stickers that names its boxes. The owner asked on 2026-11-15 for stickers that already say G1 to G200 or G78 to G300, so the sticker on the cage is the name painted on it, and took the six calls of section 10 as picked. The mock-up is `to-dos/stickers-before-boxes/mockup-named-runs.html`.

## What it makes

No table, so no fence call is owed. Three columns, one index, one constraint each on two tables, four functions restated, one function dropped and remade with a fourth argument.

- **`sticker_runs.names text[]`** — the run's box names in print order, null for a run of numbers only; **`name_first`** and **`name_last`** generated from it, for a title. `sticker_runs_names_count_check`: as many names as stickers.
- **`box_stickers.box_name text`** — the name printed large on the sticker, under the box rule's regex (`box_stickers_box_name_check`), written by the mint trigger and by nothing else. Never the box's own `label`: a rename leaves this as the tape reads. **`box_stickers_blank_name_idx`** on the blank, not-lost, named ones, for the window's second notice (names printed and not yet on boxes, PR 8) and the scan sheet's read by name (PR 9).
- **`sticker_runs_stamp()`** restated: a named run's names hold to the box rule (`box_name_words`, #351), are as many as its stickers and name each box once, saved in capitals and trimmed; an empty list is a numbered run. Refused in words before a number is taken: *A run's names are as many as its stickers: 2 names for 3 stickers.*, *G0 is not a name. A name is one to three letters and a number from 1 to 999, like R76.*, *A run names each box once. G90 is in it twice.*
- **`sticker_runs_mint()`** restated: each sticker takes `names[i]` in number order.
- **`box_sticker_facts()`** restated with `box_name`; `sticker_by_code` answers through it and is not touched.
- **`mint_sticker_run(p_job_id, p_count, p_copies, p_names text[] DEFAULT NULL)`** — the three-argument shape is dropped first and this one answers the old call through its default, so the client of today keeps calling it; two shapes side by side would leave PostgREST to choose on every call. The answer's run row carries `names`, `name_first`, `name_last`; each sticker `box_name`.
- **`place_sticker()`** restated whole with one change: a new box typed no name takes the sticker's own name, and the number as before only when the sticker has none. The box rule refuses a number as a name, so the Sticker is new sheet keeps sending a name for a numbered sticker, as it does today.

The mint refuses nothing about names the site already carries: a name that is a live box is the backfill of the card's section 7, and the window's two notices (PR 8) say so before the press. A sticker placed on a new box whose name the site holds is refused by the box-name trigger with *G12 is already on this site*, and the screen sends the known box instead.

## Why the client sends a list and not a range

The range parser (`src/lib/materials/stickerNames.ts`: `G78-300`, `A1-D50`, `G78B-D`, `G1-100C`) lives on the client, and the database takes the expanded list. Two parsers would drift on the shorthand, and what the database must hold it can check on the list itself: each name under the rule, as many as the stickers, each once.

## Order and proof

The client calls nothing new until PR 8, so this push can follow the merge at leisure; `npm run check:calls-ahead` warns on the replaced functions as it does for every restated body, and the old call keeps answering until then. Proved by CI's new `sticker-names` bed (`scripts/pgtest-sticker-names.sh`, `supabase/tests/sticker_names/20_scenario.sql`): a numbered run as before, the old call shape, a named run's stickers in number order with the run's first and last, names saved as the rule saves them, the four refusals before a number is taken, an empty list as a numbered run, G1 to G100C's three hundred names in print order, a blank sticker typed no name making a box of its own name, a typed name winning, a name the site holds refused and the known box taking the sticker, and a numbered sticker typed no name refused by the rule. The file is applied a second time by the bed and must change nothing.

## Not changed

A run's names are not checked against the site at the mint. `on_site_carry_job` does not carry a run's job or names. `job_containers.label` is still the box's name, and `job_container_names` still keeps its history.
