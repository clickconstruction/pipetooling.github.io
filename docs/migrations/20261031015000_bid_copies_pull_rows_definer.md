# 20261031015000_bid_copies_pull_rows_definer.sql (2026-10-31, v2.6235)

Making a bid version works again. `20261031010000_robot_fixtures_copies.sql` (v2.6188, punch list #221) taught `clone_count_rows_to_bid_version` to re-key the robot's take onto the cloned rows and `adopt_bid_as_version` to move the robot's pull with the rows. Each did it with a plain `UPDATE` of `bid_fixture_pull_rows` / `bid_fixture_pulls`. Both functions are SECURITY INVOKER, and `20261030230000_robot_fixtures.sql` closed the two pull tables to INSERT, UPDATE and DELETE from `authenticated` on purpose. Postgres checks that privilege when the statement starts, whether or not a row matches. So from the `20261031010000` push (2026-10-31 05:27 UTC) every new version and every adopt failed for every signed-in user with *permission denied for table bid_fixture_pull_rows*. That covers Add GC, Try a variant, the Pricing tab's new version and the Workbench's adopt. The live test of v2.6188's copies found it on 2026-10-31: `materialize_bid_version` worked on a ZZ Test bid, and `create_bid_version` answered 403.

## What it does

1. **`robot_fixtures_follow_clone(p_bid_id, p_target_bid_version_id, p_map)`**, SECURITY DEFINER, `search_path = public`. It re-keys the bid's pull rows from each source row to its clone and sets `taken_version_id` to the target. It writes only onto rows of that bid on the target version. A signed-in caller who cannot price the bid re-keys nothing, as RLS would show them no pull row, so they still get their version and the take stays where it was.
2. **`robot_fixtures_follow_adopt(p_source_bid_id, p_target_bid_id, p_new_version_id)`**, SECURITY DEFINER. It moves the pull and its rows to the package, with `taken_version_id` set to the adopt's new version. It acts only into a version of the package, and only once the adopted bid has no count row left. It refuses a signed-in caller who cannot price both bids, as `adopt_bid_as_version` already does first.
3. **`clone_count_rows_to_bid_version` and `adopt_bid_as_version`** are redefined to `PERFORM` the helpers in place of the two updates. Their bodies are otherwise verbatim from `20261031010000`.

Both helpers: `REVOKE ALL … FROM public, anon`, `GRANT EXECUTE … TO authenticated, service_role`. The pull tables stay closed to `authenticated`. No table is created, so the three fences are not called. Idempotent: `CREATE OR REPLACE` throughout.

## Release order

Merge, then `supabase db push` at once on Taunya's go. Until the push, nobody can make a bid version or adopt a bid on prod. No client change rides with it, and no signature changes.

## Verify

Live on prod after the push, on a ZZ Test bid as the dev: add two count rows, one with a `plan_tag`. Run `materialize_bid_version`, then `create_bid_version` from the base, and read the new version's rows: the tag is there and no 403 comes back. Delete the ZZ rows. A take re-key needs a robot pull, which only the service role writes, so it is not part of the live check.
