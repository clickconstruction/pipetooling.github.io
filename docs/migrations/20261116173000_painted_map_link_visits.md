# 20261116173000_painted_map_link_visits.sql (2026-11-15, v2.7411)

Who opened a painted map's link (punch list #345, the link that asks who is looking, step A). Taunya's ask of 2026-11-15: a map's public link stays open to anyone with no sign-in, so long as whoever is not signed in gives their name, and the company keeps the device they were on and where they were when they chose to show it.

This migration is the table alone. Nothing writes it until the `painted-map-link` function's next deploy.

## What it does

One table, **`painted_map_link_visits`**, one row a device a link.

- `link_id`, `map_id`: the link that was opened and its map. A visit goes with either (`ON DELETE CASCADE`).
- `visitor_name`: the name as typed, one to eighty characters. Not proven: anyone can type any name.
- `user_id`: the account, when the reader was signed in. Set null when the account goes.
- `device_id`: an id the page puts on the phone or computer the first time it opens a map's link. It is the nearest a web page has to a fingerprint. It stays the same until the browser's site data is cleared, and a private window reads as a new device. A page cannot read a serial number. `(link_id, device_id)` is unique, so the same phone on the same link is one row.
- `device_words`, `user_agent`, `screen`, `language`, `time_zone`, `ip`: what the browser and the request said, each with a length cap.
- `first_opened_at`, `last_opened_at`, `open_count`: when, and how many times.
- `first_lat`, `first_lng`, `first_accuracy_m`, `first_located_at`, and the same four for `last_`: where the reader was, only after they pressed **Show where I am**, which says the company will see it. The first point and the latest one. Never a trail.

Three checks hold a point whole: both numbers, in range, with its time, or none of the four. Each part is asked `IS NOT NULL` by name, since a `CHECK` that works out to `NULL` passes. The latest point is never there without the first.

## Who may do what

- **Read a row**: the office, and whoever painted the map (`painted_map_link_visits_select` asks `painted_maps` under the caller's own RLS). A crew member who reads a job's map does not read who else opened it or where they stood.
- **Write a row**: nobody signed in. `authenticated` holds `SELECT` and nothing else, and `anon` holds nothing. The `painted-map-link` edge function writes as the service role.

The four fence calls close the table to an account in training, a digital twin and anyone archived.

## Locks

One `CREATE TABLE` on a name nothing uses. Its foreign keys take a brief lock on `painted_map_links`, `painted_maps` and `users`. The fence calls create only what is missing. `SET lock_timeout = '3s'` makes a busy moment fail fast.

## Order of deploy

Nothing in the app reads or writes this table yet, so the push can follow the merge at any time. The function that writes it and the page that asks for a name come after, in that order.

## Checked on a database

- **The bed** `supabase/tests/painted_maps/50_visits.sql` (run by `npm run test:pg:painted-maps` after the three scenarios before it) on the real schema in CI: the fences and the grants; the service role keeps a visit, counts a second open and keeps a point; the same device on the same link is one row; a visit with no name, a device id that is not one, a visit on no link, a point with no time, half a point, a point off the globe and a latest point with no first are each refused; a dev reads every visit; a helper reads the visits of the map he painted and of no other map he can open, and writes, changes and removes none; a helper on no crew and someone who left read none; a visit goes with its link and with its map.
- **Not run on this Mac.** Docker is down here and another account held the one local Postgres. The bed's result is read from CI before the merge.
