# 20261114010000_painted_map_links.sql (2026-11-13, v2.7223)

A link to a painted map (punch list #345, PR 4). A painted map is for people outside the company too: a customer, a delivery driver, another trade. They open it at `/way/<code>` with no sign-in. This migration is the table that says which code opens which map, and until when.

## What it does

One table, **`painted_map_links`**, one row a link.

- `map_id`: the map the link opens. A map may have several links: one sent to the customer, one to a driver. A map that is thrown away takes its links (`ON DELETE CASCADE`).
- `code_hash`: the SHA-256 of the link's ten-letter code, 64 hex characters, unique. The code itself is handed out once by the function and kept nowhere. Nobody who reads the table, or a backup of it, can open a map with what they read.
- `made_by`, `made_at`: who made the link and when. Set null when the account goes: the link stays.
- `expires_at`: the link ends by itself, ninety days after it was made (`PAINTED_MAP_LINK_DAYS`). A way in is used for months, where a receipt link lives fourteen days.
- `ended_at`, `ended_by`: **End this link now**. The row stays, to say that the map was shared and is not any more.
- `opened_at`, `last_opened_at`, `open_count`: whether the link was used. Not who opened it, and not from where: no address and no browser is kept.

## Who may do what

- **Read a row**: whoever can read the map (`painted_map_links_select` asks `painted_maps` under the caller's own RLS), so the map's window can say that a link is out, since when, and how many times it was opened.
- **Write a row**: nobody signed in. `authenticated` holds `SELECT` and nothing else, and `anon` holds nothing. The `painted-map-link` edge function writes as the service role, after it has checked that the caller reads the map and is its maker or the office (`docs/EDGE_FUNCTIONS.md`, *painted-map-link*).
- **Nobody signed out reads any table.** The page asks the function, and the function answers with named fields of the map and nothing else.

The four fence calls close the table to an account in training, a digital twin and anyone archived.

## Locks

One `CREATE TABLE` on a name nothing uses. Its foreign keys take a brief lock on `painted_maps` and `users`. The fence calls create only what is missing. `SET lock_timeout = '3s'` makes a busy moment fail fast.

## Order of deploy

The client's Share sheet reads this table and calls the function, so push this migration and deploy `painted-map-link` right after the merge. Until then **Share** says in words that the link was not made, and every other part of a painted map works as before.

## Checked on a database

- **Locally, on a throwaway Postgres 15 with stub tables** (Docker was not available on this Mac): the file applied twice with no change the second time, and the scenario's assertions that do not need the fences passed.
- **The bed** `supabase/tests/painted_maps/30_links.sql` (run by `npm run test:pg:painted-maps` after the map's own scenario) on the real schema in CI: the fences and the grants; the service role makes a link, counts an open and ends a link; a hash that is not a hash, a hash used twice and a link on no map are refused; the map's maker, a helper on the job's crew, a helper on no crew and someone who left each read what they should; nobody signed in makes, changes or removes a link; a map thrown away takes its links.
