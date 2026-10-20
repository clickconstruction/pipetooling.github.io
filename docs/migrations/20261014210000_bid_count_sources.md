# 20261014210000_bid_count_sources.sql (2026-10-13, v2.5517)

Combine two CountTooling counts on one bid, PR 1 of 3 (the owner's 2026-10-13 ask; the design on the canvas https://claude.ai/artifact/SbTjnk5bEZ9yPRY3pcLU6L). Two people count parts of one plan in separate CountTooling projects and combine them on one bid. Until now the bid held one CountTooling link, overwritten by every import, and a count row did not know where its count came from, so a second counter's copy read as a re-copy and the review proposed replacing the matching counts and removing the other counter's rows.

## What it does

**`bid_count_sources`**: one row per CountTooling project on a bid — `link` (the view link as the copy's footer carried it), `token` (the project's own `t=<uuid>`; null for a link typed by hand), `project_name` (from the copy's heading `--- Counts, <project> · every sheet · every layer ---`), `scope` (`all` · `partial` · `unknown`, the last copy's), `imported_by`, `first_imported_at`, `last_imported_at`. One token per bid (a partial unique index; hand links without a token may repeat). The first by `first_imported_at` stays mirrored on `bids.count_tooling_plans_link`, which the Bid Board, the bid flow, the pricing package, the sub portal and twin-mcp keep reading. RLS: the four verbs gated by `can_access_bid_for_pricing(bid_id)`, as `bid_versions` and the pricing overlay tables are; `authenticated` reads and writes, `anon` nothing, `service_role` all. The bid going away takes its sources.

**`bids_count_rows.source_shares jsonb`**: each project's share of the row's count, `{"<bid_count_sources id>": <count>}`; `NULL` means no project (typed by hand, or imported before this and not yet adopted). A row both people counted holds two shares, so a later re-copy of either project moves only its own share and removes only the rows that are its alone. A CHECK keeps it an object (`NOT VALID` then validated, so the table is not rewritten).

Three house calls at the end, since there is a new table.

## Checked before the push

The SQL bed `count-sources` (`npm run test:pg:count-sources`) runs every migration on Supabase Postgres 17, then this one a second time, which must change nothing, then the scenario. Docker does not run on the office Mac, so it runs in the SQL beds workflow once the PR is ready.

- The bid's estimator registers two projects and stamps a row with both shares; the shares sum to the count; a re-copy bumps `last_imported_at` and keeps the first day.
- Refused: a second source with the same token on one bid, a link that is not a link, a malformed token, an unknown scope, an array of shares.
- Two hand links without a token may share the bid.
- The office reads the bid's sources; a superintendent outside the bid reads none and cannot insert one.
- Deleting the bid deletes its sources.

## After the push

Nothing to run. The generated types were hand-added for the new table and column (`src/types/database.ts`); the next gen-types chore regenerates them. The client starts writing sources and shares in PR 2 (the review modal and the Counts tab); until then the table stays empty and the column `NULL`.
