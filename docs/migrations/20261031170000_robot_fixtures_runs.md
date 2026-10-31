# 20261031170000_robot_fixtures_runs.sql (2026-10-31, v2.6236)

Robot fixtures, PR 4 (punch list #221): `list_shadow_runs()` dropped and recreated with `reference_bid_id`, `assisted_at`, `fixtures_found`, `fixtures_taken`, `fixtures_set_aside` (the newest pull's counts once the run is sealed) and `fixtures_score`, for the dashboard's Needs You card, the Robot Board and the Scoreboard. No money moves: the counts are not a price, and the seal on the money columns is unchanged. Every reader reads columns by name and takes the new ones as optional, so the client and the push can land in either order. The `robot_fixtures` bed asserts the new columns after the take.

Apply: with v2.6236's merge, `supabase db push`.
