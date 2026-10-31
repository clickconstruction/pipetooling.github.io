# 20261031010000_robot_fixtures_copies.sql (2026-10-31, v2.6188)

Robot fixtures, PR 3 (punch list #221): the three copy paths carry what v2.6180 added. `clone_count_rows_to_bid_version` and `duplicate_bid_to_service_type` carry `bids_count_rows.plan_tag`; a new version re-keys the robot's take (`bid_fixture_pull_rows.count_row_id`, `taken_version_id`) to the cloned rows, so the window reads the take on the newest version made from the rows it landed on; `adopt_bid_as_version` moves `bid_fixture_pulls` and their rows with the count rows. A duplicate to another service type leaves the pull behind on purpose: the robot's fixtures are its read of one bid's plans for its own division, and the robot reads the duplicate itself (`bidCopySql.test.ts` records the decision in `NOT_CARRIED_YET`). Bodies otherwise verbatim from the previous definitions.

Apply order: with v2.6188's merge, `supabase db push`; nothing in the client depends on it.
