# 20261117001500_lien_desk_mailed_copies.sql (2026-11-16, v2.7460)

What was mailed, kept with the notice. The owner's ask of 2026-11-16, after the Lien desk's names were settled: "after we print we should have the user upload what they are going to mail for easier reference later of what actually went out." Asked whether the office scans the stack once or a notice at a time, he picked one file per notice. This is PR 1 of two: the column. The press on the run's checklist follows once the column is on prod.

## The column, on `job_lien_desk_items`

| Column | Type | What it holds |
|---|---|---|
| `mailed_copies` | `jsonb NOT NULL DEFAULT '[]'`, an array (`job_lien_desk_items_mailed_copies_is_array`) | The scans or photos of what went in the envelope: `[{ url, driveFileId, name, at, by }]`. Each file is in the job's own Drive folder (Sent), put there by `drive-link`'s `put` as any file added from the Documents tab is. The notice remembers the list here until its mailing is recorded; the record (`job_lien_filings.document_url`) then takes the first link. |

It is a list so one notice can hold the owner's envelope and the GC's apart. The client writes the list whole.

## What it does not touch

- The guard `job_lien_desk_items_guard()` rules on approval and signature only, so it is as 20261023150000 left it.
- The fields hash (`lienFieldsHash`) reads the row's `fields`, not this column, so adding a file never makes a signature read as stale.
- No new table, so no read-only, twin or archived fences to re-apply. RLS on the table already covers the column: the office roles write it, as they write `printed_at`.

Additive and idempotent: `ADD COLUMN IF NOT EXISTS` with a constant default (no table rewrite) and a guarded `ADD CONSTRAINT`. Opens with `SET lock_timeout = '3s'`. Apply with `supabase db push` after the merge; then `npm run gen-types:linked` as a `chore(types)` PR.

**Applied** to prod by 2026-11-18: `npm run check:migration-drift` read 1,366 local files against 1,366 remote versions, fully applied, this version among them (run in the docs pass after #8630).
