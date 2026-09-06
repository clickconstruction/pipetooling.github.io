# 20260906060000_person_availability.sql (2026-09-06, v2.2930)

Your days (PR 4 of the three-party scheduling plan, artifact 3a540149).

- **New table `person_availability`** — one row per (person, day): `kind` (`off` only for now), `note`, `source` (`portal` | `office`), `created_at`. `UNIQUE (person_id, day)`; cascades with the person. Index on `day`.
- **RLS**: select for the office set and superintendents (dev / assistant / superintendent / master / controller / estimator); no client write policy — rows are written by the `submit-sub-portal` function (service role) on `day_off`. Both read-only fence appliers run.

Read by the Forecast Sub Board (stripes; a bar over an off day gets the red outline), the dispatch Subs lanes (hatched cells) and the sub's own portal.

Apply order: **client first, then push**; the portal shows Your days without off days until the table exists, and a mark-off before the push fails with a plain error.
