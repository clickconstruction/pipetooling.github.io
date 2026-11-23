# 20261122000500_punch_list_claims.sql (2026-11-21, v2.8224)

A tick on `/punch-list` becomes a claim other people can see. Taunya's ask of 2026-11-21, a few hours after the tick went live ([`20261121193000_punch_list_ticks`](./20261121193000_punch_list_ticks.md)). The table held no row when this was written and pushed. It ships alone, ahead of the screen that reads the new column.

## What it does

- **`punch_list_ticks_select` is widened.** Everyone who may open the page reads every row: `is_master_or_dev()` alone, where it was `user_id = auth.uid()` and `is_master_or_dev()`. Insert, update and delete are unchanged, so a person still writes only their own row.
- **`claimer_name`** (`text NOT NULL DEFAULT ''`): the claimer's name as the page prints it. The trigger stamps it from the person's own `users.name`, trimmed, on every insert and update. Whatever the client sends is replaced. A person with no name on file gets `''`.
- **`punch_list_ticks_stamp()`** is replaced: it sets `ticked_at` to `now()` as before, and now the name. It runs as the caller and reads the caller's own `users` row, which every signed-in person may read.
- **`ticked_at` means more.** It is the last time the person said they were on the card: the tick, or the page's **Still on it** press, which is an update of their own row.

## Why the name is on the row

A master cannot read a dev's `users` row, so a name read from `users` beside the claim would be missing for a master looking at a dev's claim. The row carries its own name, and the page needs one read.

## What it does not do

Nothing here expires a row, and no job runs. The page works out the 12 quiet hours at read time, from `ticked_at` and the card file's last change on `main`.

## The live client meanwhile

The screen that was live at the push (v2.8199) reads with `user_id = eq.<its own id>`, so it keeps showing a person their own ticks and nobody else's until the claims screen deploys.

## Who reads a claim

- **A dev or a master:** every claim, with the claimer's name.
- **Every other role:** none. They cannot open the page, and the table answers them no rows.
- **Training mode:** a dev or a master in training mode reads every claim and writes none.
- **Archived:** reads nothing.
- **Signed out:** refused.

## Verified

A stand-in rig on the local Postgres 15, not the app's schema: the first migration, this file twice, then 16 checks with made-up accounts.

- The name is stamped from `users`, whatever the client sends, and trimmed. No name on file is `''`.
- A master reads a dev's claim with its name, changes none of it, takes none of it off and cannot claim as the dev.
- Two people hold one card, a row each.
- An update of a person's own row moves their time forward and leaves the other person's alone.
- A helper reads no claim and makes none. A signed-out caller is refused.
- An untick takes off the person's own row and leaves the other's for them to read.

The rig's `users` table has no row security. On prod the trigger's read of the caller's own row is proved by the first real tick after the push.

## Applied

On the prod ledger, read on 2026-11-23 with the dev seat's `check_migration_ledger` during a docs catch-up. The push's own time and checks were not recorded here. The types followed in #9302.
