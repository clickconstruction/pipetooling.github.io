---
name: "Robot fixtures: fold a second robot source when a bid is adopted"
number: 226
group: ready
status: found 2026-10-31 on the #221 walk-through · not started
summary: >
  Since v2.6230, adopting a bid as a version moves every CountTooling project row of the adopted bid onto the
  package, the robot's own row too (`bid_count_sources` with `source_kind = 'robot'`). When both bids took robot
  fixtures, the package ends with two robot rows. Every robot lookup takes the first one it finds, so nothing fails,
  but Set aside or Undo can strip the wrong share and leave a row shaded, and the Counts tab's From tile shows two
  Robot chips. The fix folds the adopted bid's robot row into the package's.
next: One migration that re-keys the moved count rows' shares to the package's robot row and deletes the duplicate, with the case added to the bid_copies and robot_fixtures SQL beds.
size: S
blocker: None. It cannot happen until a real bid has a robot pull.
ver: v2.6230 · v2.6237
mockup: not required — a server fix with no screen of its own
---

# Robot fixtures: fold a second robot source when a bid is adopted

## The ask

Found on 2026-10-31 by the session that built #221, while #6637 (adopt carries plan sets and CountTooling projects)
and #6649 (#221's last PR) met in the merge queue. The owner asked the same day to put it on the punch list.

## Where it plugs in

- `adopt_bid_as_version`, latest body in `supabase/migrations/20261031123000_adopt_carries_sets_and_counts.sql`:
  moves the adopted bid's `bid_count_sources` rows onto the package with `bid_version_id`, then deletes what is left.
  The robot's row has no token, so the same-token guard never holds it back.
- `robot_fixtures_follow_adopt` (SECURITY DEFINER, `20261031015000_bid_copies_pull_rows_definer.sql`): moves the
  robot's pull and its rows to the package.
- The robot lookups, all `LIMIT 1`: the take's find-or-create (`20261030230000_robot_fixtures.sql`),
  `set_aside_robot_fixtures`, `untake_robot_fixtures`, and `untake_robot_fixture_rows`
  (`20261031180000_robot_fixtures_undo_one_press.sql`).
- The shade: `bids_count_rows.source_shares`, keyed by the source row's id.

## The plan

One PR. A migration (numbered from `origin/main`, registered with `npm run claim -- --migration`, opening with
`SET lock_timeout = '3s';`) that, when the package already has a robot source row, re-keys `source_shares` on the
moved count rows from the adopted bid's robot row id to the package's, then deletes the duplicate row. Keep it in a
SECURITY DEFINER helper: the copy and adopt functions run as the caller, and the pull tables take no write from
`authenticated` (a SECURITY INVOKER write there once broke bid versions for everyone). Release note, fragment and
`docs/migrations/` doc. The `supabase db push` after the merge needs the owner's yes in chat.

## How to verify

Add a two-robot-sources case to the `bid_copies` and `robot_fixtures` SQL beds (`supabase/tests/`, run locally on
Docker): after the adopt the package has one robot row, every moved share is keyed to it, and Set aside then Undo
leave no row shaded.
