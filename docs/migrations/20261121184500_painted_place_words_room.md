# 20261121184500_painted_place_words_room.sql (2026-11-21, v2.8186)

Room for a description on a place. Punch list #413, step 0 ([`to-dos/photo-of-a-spot/README.md`](../../to-dos/photo-of-a-spot/README.md)), on Taunya's ask of 2026-11-21 for an open-ended description on a place. This is the database half. No screen writes a longer description yet.

A place's words were one line for whoever comes next. A plumber marking a buried line needs to say what it is, how deep and which way it runs, and one line does not hold that.

## The check, on `painted_map_places`

| | Before | After |
|---|---|---|
| Name | `painted_map_places_words_check`, the name the database gave an inline check | `painted_map_places_words_room` |
| Rule | `length(words) <= 200` | `length(words) <= 4000` |

No new column. The words a place has are the description it gets, so every reader of a place already reads it: the place's sheet, the list beside a map, the shared link, the printed page and the picture.

The old check was written inside the column's own line, so the migration finds it by what it says (`length(words)`) and not by its name. It drops what it finds and adds the new check under a name of its own. A second run finds that name and changes nothing.

## Who reads and writes it

Nothing changes. The four policies on `painted_map_places` are by row: whoever reads the map reads its places, a place is set by its own setter, and it is changed or removed by its setter or the office. No trigger guards the table's columns.

The app still cuts a place's words at 160 characters (`PAINTED_PLACE_WORDS_MAX` in `src/lib/paintedMap/paintedMap.ts`) until the screens that follow.

## The bed

`supabase/tests/painted_maps/90_words_room.sql`, an eighth scenario in the painted maps bed, run by `scripts/pgtest-painted-maps.sh` with this migration applied a second time first. One check holds the words, by its own name. A description of 201 characters and one of 4,000 are kept, and one of 4,001 is refused. A place with no words is still a place. The words are changed by the place's own setter and the office and by nobody else.

The migration's own block was also run twice on a local Postgres 15 over a stub of the table before the PR: the inline check went, the named one came, and the second run changed nothing.

## Order

Additive: every row that passed the old check passes the new one. No `CREATE TABLE`, so no fence calls. The lock is an `ALTER TABLE` on a small table, with no row on prod on 2026-11-21, under the 3 second timeout. The push can come any time after the merge. **The screens that follow must not merge before the push**: a description past 200 characters would be refused by the table.

**Applied** to prod by 2026-11-23: `npm run check:migration-drift` read 1,454 versions applied against 1,454 local files, this version among them (read in the docs pass after #9274).
