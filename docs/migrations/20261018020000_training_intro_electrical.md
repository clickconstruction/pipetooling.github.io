# 20261018020000_training_intro_electrical.sql (2026-10-18, v2.5614)

Training (punch list #120, the Intro to electrical course): the third course's seed row. One insert; no column, no function, no table; nothing existing changes.

Apply order: push after v2.5614 merges. The client reads the catalog with `select *` and draws a row only while the course is on, so the order between the push and the deploy does not matter; the course is off either way.

## What it does

1. **The seed row** `intro-electrical`, *Intro to electrical*, **off**, `required_roles` empty, **offered**, good for 120 months (the owner's calls 2 and 3 as decided in `to-dos/intro-electrical/README.md`: offered to every role and required of nobody for the first version; the owner flips helpers to required after the reader signs off). `ON CONFLICT DO NOTHING`. An empty `required_roles` passes the table's check (a subset of the nine role words), `training_state_for()` and `training_standings()` read nothing for it, and `offeredCourses` in `trainingState.ts` lists it for every signed-in role once it is on.

No table is created, so no fence applier; RLS is the row's. `ACCESS_CONTROL.md` → Training carries the row.

## Verify

Read-only on prod after the push: `select slug, enabled, offered, required_roles, good_for_months from training_courses order by slug` reads three rows, the new one off, offered and with no roles; `select * from training_state_for(auth.uid())` as any role reads nothing for it. The bed `npm run test:pg:training` (CI's `sql-beds` job) asserts the seed.
