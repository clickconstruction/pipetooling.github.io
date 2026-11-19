# 20261118080000_painted_place_kind.sql (2026-11-18, v2.7775)

A place on a painted map can say what kind of thing it is. Punch list #393, reading B ([`to-dos/painted-map-pins.md`](../../to-dos/painted-map-pins.md)), on the owner's answer of 2026-11-18, when he ticked all three of the card's readings. This is the database half. No screen reads or writes the column yet.

A place was a numbered dot with a name, a word and a photo (#345), and every dot looked the same. With a kind, a gate, a meter and a hazard can each wear a mark of their own on the map, on the shared page, in the picture and on paper.

## The column, on `painted_map_places`

| Column | Type | What it holds |
|---|---|---|
| `kind` | `text`, nullable, no default | What kind of thing the place is, as one short lowercase word: `gate`, `parking`, `door`, `meter`, `shutoff`, `cleanout`, `hazard`. Null for a plain place. |

## The check: `painted_map_places_kind_check`

`kind IS NULL OR kind ~ '^[a-z][a-z_]{1,23}$'`. A kind is a lowercase letter followed by 1 to 23 lowercase letters or underscores. An empty word is refused, since no kind is null.

The check holds the shape of the word and not the list. The list of kinds lives in the app, where each kind has its mark, so a new kind needs no migration. An app that meets a kind it does not know draws the plain numbered dot. A closed list in the database would have refused a newer app's kind on an older schema and made every new kind a migration.

The constraint is added by name inside a `DO` block that looks for it first, so a second run adds nothing.

## Who reads and writes it

Nothing changes. The four policies on `painted_map_places` are by row: whoever reads the map reads its places, a place is set by its own setter, and it is changed or removed by its setter or the office. So whoever may set or change a place may set or change its kind, and nobody else gains anything. No trigger guards the table's columns.

The shared link's function, `painted-map-link`, names the columns it reads, so a reader of a link does not see the kind until that function reads it.

## The bed

`supabase/tests/painted_maps/70_place_kind.sql`, run by `scripts/pgtest-painted-maps.sh` with this migration applied a second time first. It plays two helpers on a job's crew and the office through the column: set with a kind, set with none, a word the app does not know, five shapes of word refused, and the kind changed by the setter and the office and by nobody else.

## Order

Additive and idempotent. No `CREATE TABLE`, so no fence calls. The lock is an `ALTER TABLE` on a small table, under the 3 second timeout. The push can come any time after the merge. **The client that follows must not merge before the push**: it names the column in the read of every place.

**Applied** to prod by 2026-11-18: the dev seat's `check_migration_ledger` read 1,380 versions applied against 1,381 local files, this version among them and `20261118190000` alone still to push (read in the docs pass after #8710).
