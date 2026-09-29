# 20260929230000_bids_alternate_group_tags.sql (2026-09-29, the alternates train PR 1)

`ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS alternate_group_tags text[] NOT NULL DEFAULT '{}'` — the count-row `group_tag` values that are **alternates**: the section a customer wants priced with and without. CountTooling marks a group as an alternate (ALT-GROUPS, its PR #290) and its Copy to /Tooling text puts that group's rows under `--- Alternate: <name> ---`; the Counts import lifts the bracketed group into `bids_count_rows.group_tag` and adds the heading's name here. A row is the alternate's when its `group_tag` is in the list, in every version of the bid.

One list per bid rather than a flag per row, because `clone_count_rows_to_bid_version`, `materialize_bid_version`, `create_bid_version` and `adopt_bid_as_version` already copy `group_tag` and would each have needed a new column. `duplicate_bid_to_service_type` copies `bids` column by column, so it is `CREATE OR REPLACE`d verbatim from `20260823020216_count_rows_unit.sql` with the column added to both lists.

Apply order: this migration first, then the client that reads it (an old client ignores the column; a new client writing it needs the column to exist). Nothing is destructive.

Shipped ahead of the client PR (v2.4167 series).
