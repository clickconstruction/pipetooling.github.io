# 20261123192240_permit_pulls_issued_reading.sql (2026-11-23)

Permits, punch list #405 (v2.8400). Each reading of a feed keeps its own start on the pull's ledger row. Two nullable columns on `permit_pulls`: no new table, no function, no grant, no data moved.

## Why

San Antonio's applications are read twice a night (`feedPasses`): by filing day, then by issued day. v2.8328 works out both starts before either reading writes, and the second looks back 30 days from the newest issued day held. The first reading writes issued days too, so on a night the second reading fails, its start still moves on with the first reading's writes. Thirty days of failed second readings while the first kept running would leave permits issued in that month reading as waiting.

## What it does

- `issued_since date`: the start of the run's second reading, on a feed read twice. Null on a feed read once and on every older row.
- `issued_whole boolean`: true when the second reading read to its end; false when an error or the time budget stopped it, or the first reading's error kept it from beginning.
- Starts with `SET lock_timeout = '3s'`; both `ADD COLUMN IF NOT EXISTS`, so a second run changes nothing. Adding a nullable column with no default rewrites nothing, but it takes a brief `ACCESS EXCLUSIVE` lock on `permit_pulls`, which only the nightly pull and the Permits page's two reads touch.

## Who reads it

- `permit-pull` (v2.8402, its own PR): before a feed's readings start, it reads that source's newest row with `issued_whole` set. When that value is false, the second reading starts no later than its `issued_since`, so a run of failures carries its start until a reading finishes. It writes both columns on every run of a feed read twice. Deployed before this push, the function reads no kept start and writes its row without the two columns.
- Nothing in the client reads the columns. `permitResearchIo.ts` reads `since`, `ran_at` and `error` only.

## Owed after the push

- A `chore(types)` PR: `npm run gen-types:linked`, which also rewrites the edge kernel copy's slim types.
