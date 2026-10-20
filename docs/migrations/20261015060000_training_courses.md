# 20261015060000_training_courses.sql (2026-10-15, v2.5565)

Training (punch list #111): the policy and the record behind courses the crew takes at their own pace, each with a clock. The lessons themselves ship in the app's bundle (`src/content/training/<slug>/`, v2.5564); the database keeps who must take a course, how long a pass is good for, which lessons a person has passed and the passes themselves. Everything here is new; nothing existing changes.

Apply order: push after v2.5564 (the content) merges and before the course page (PR 3) merges. The Dashboard card and the People rail fail soft on a missing table until then.

## What it does

1. **`training_office()`**: the office team that reads everyone's standing: dev, master, assistant, controller.
2. **`training_courses`**: one row per course the app ships, keyed by the content folder's `slug`. `enabled` (off by default), `required_roles text[]` (user role words, checked against the nine), `good_for_months` (0 to 120, default 12), `due_soon_days` (0 to 365, default 30), `retake_from date` (the *Everyone takes it again…* stamp: a pass before it does not count), `updated_by`, `updated_at` by `update_updated_at_column()`. Everyone signed in reads it; only a dev (`is_dev()`) writes it. Seeded: `osha-30-refresher`, **off**, required for helpers, subcontractor, primary, master_technician and superintendent.
3. **`training_lesson_passes`**: `(user_id, course_slug, lesson_key)` primary key, `passed_at`, `tries`. Own rows to read, insert and update; the office reads all.
4. **`training_passes`**: a pass of the final check: `content_version` (eight hex characters, the hash of the course's words), `passed_on` (`app_today()`), `passed_at`, `score`, `total`, `answers jsonb`. Own rows to read and insert, the office reads all; nobody updates or deletes through the API.
5. **`training_pass_lesson(p_course_slug, p_lesson_key, p_tries)`** and **`training_finish_course(p_course_slug, p_content_version, p_score, p_total, p_pass, p_answers)`**: SECURITY INVOKER, the caller's own row, so RLS, the read-only fence and the twin fence apply. The finish refuses a score under `p_pass` with the words *Not a pass*. The finish returns the pass's id.
6. **`training_state_for(p_user)`**: the SQL twin of `src/lib/training/trainingState.ts`: for every enabled course the person's role must take, the newest pass on or after `retake_from`, the day it runs out (`passed_on + good_for_months` months, clamped to the month's end as the client does), and the colour: red with no pass, amber when `due_on - app_today() <= due_soon_days`, green otherwise. Own rows for anyone, everyone's for the office.
7. **`training_standings(p_course_slug)`**: everyone active who must take the course (samples, twins and archived accounts left out) with their colour, worst first. Office only.
8. The three fence appliers close the migration.

## Why the shape

- Policy in a table and words in the repo, because CI holds the words (plain words, four checks a lesson, Appendix B) and a dev sets the policy without a deploy.
- State read, never stored, so a dev changing the window recolours everyone at once, and the client and SQL agree because both are the same rule.
- A pass records the content version, so a changed word never voids a pass; `retake_from` is the one press that does.
- SECURITY INVOKER on the two writes, so a training-mode account and a twin are refused by the house fences with the house words.

## Verify

Read-only on prod after the push: `select slug, enabled, required_roles from training_courses` reads the one seeded row, off; `select * from training_state_for(auth.uid())` as a helper reads nothing while the course is off; the bed `npm run test:pg:training` (CI's `sql-beds` job runs it) asserts red → green → amber, the retake stamp, the office read and the refusals.
