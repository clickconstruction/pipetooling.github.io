# 20261121074500_training_intro_hvac.sql (2026-11-21, v2.8158)

Training (the Intro to HVAC course; Taunya, 2026-11-20: HVAC is the company's trade and the next training to add): the fourth course's seed row. One insert; no column, no function, no table; nothing existing changes.

Apply order: push after v2.8158 merges. The client reads the catalog with `select *` and draws a row only while the course is on, so the order between the push and the deploy does not matter; the course is off either way.

## What it does

1. **The seed row** `intro-hvac`, *Intro to HVAC*, **off**, `required_roles` empty, **offered**, good for 120 months. Offered to every role and required of nobody for the first version, so nobody is clocked on words no licensed HVAC person has read. `ON CONFLICT DO NOTHING`. An empty `required_roles` passes the table's check (a subset of the nine role words), `training_state_for()` and `training_standings()` read nothing for it, and `offeredCourses` in `trainingState.ts` lists it for every signed-in role once it is on.

No table is created, so no fence applier; RLS is the row's. `ACCESS_CONTROL.md` → Training carries the row.

## The switch

The row is seeded off on purpose. The lessons were written from code sections read at the source and from general trade knowledge, and each lesson's `from:` line says which is which. The plan was for the course to go **On** in Settings → Training only after a licensed HVAC reader had read it and the corrections were in. Taunya switched it on for every role on 2026-11-21, before that read (v2.8239). The row stays required of nobody, and the read and its corrections are still owed.

## Verify

Read-only on prod after the push: `select slug, enabled, offered, required_roles, good_for_months from training_courses order by slug` reads four rows, the new one off, offered and with no roles; `select * from training_state_for(auth.uid())` as any role reads nothing for it. The bed `npm run test:pg:training` (CI's `sql-beds` job) asserts the seed.

**Applied** to prod by 2026-11-23: `npm run check:migration-drift` read 1,454 versions applied against 1,454 local files, this version among them (read in the docs pass after #9274).
