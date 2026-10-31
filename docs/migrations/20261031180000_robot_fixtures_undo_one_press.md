# 20261031180000_robot_fixtures_undo_one_press.sql (2026-10-31, v2.6237)

Robot fixtures (punch list #221): Undo on the toast takes back one press. `untake_robot_fixtures(p_pull_id)` took back every robot row of the pull the estimator had not edited, so Undo after a second Add (*1 fixture added from the robot.*) also took back the first Add's fixtures and put an updated row of hers back to her number. Found by the owner-approved walk-through on ZZ b569, 2026-10-31.

- **`untake_robot_fixture_rows(p_pull_id uuid, p_row_ids uuid[] DEFAULT NULL)`**, SECURITY DEFINER, the old body with one more condition: only the given rows (NULL = every taken row). The same gate (`robot_fixture_gate`: can price the bid, the bid is not sent), the same rule for an edited row (kept), an updated row (her number back), the robot source (dropped when no row carries it) and the ledger line.
- **`untake_robot_fixtures(p_pull_id uuid)`** is now `untake_robot_fixture_rows(p_pull_id, NULL)`, so the rule lives in one place and the deployed client keeps working.
- The toast's Undo (`BidsCountsTab` → `useRobotFixtures.untakeRows`) passes the rows the press took. The `robot_fixtures` bed takes the mop sink in a second press and undoes it alone.

Apply order: **push right after the merge** — the new client calls `untake_robot_fixture_rows`, which only this migration creates; until the push its Undo answers with a refusal. No table is created, so the three fences are not called.
