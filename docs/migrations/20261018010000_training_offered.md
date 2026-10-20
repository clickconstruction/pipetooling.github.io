# 20261018010000_training_offered.sql (2026-10-18, v2.5610)

Training (punch list #119, the Intro to plumbing course): an **offered** course, open to every role. Before it a course was either required of a role or invisible to it; the intro course should be required of the people who most need it and open to everyone else, with no clock on the ones who chose to take it. One column and one seed row; nothing existing changes.

Apply order: push after v2.5610 merges. The client reads the catalog with `select *` so a client deployed before the push reads `offered` as false and shows nothing new; a client deployed after it draws the Available row.

## What it does

1. **`training_courses.offered boolean NOT NULL DEFAULT false`**: open to every role. A person whose role is not in `required_roles` sees the course on the Dashboard's Training card under an **Available** line, with no colour and no clock, and may take it. `training_state_for()` and `training_standings()` keep keying on `required_roles`, so an offered course gives no colour, no People chip and no Settings count. The two write doors (`training_pass_lesson`, `training_finish_course`) never checked the policy, so a pass from any role was already accepted; the column changes only what the card draws. State is read, never stored: if the course is later required of a role, every pass those people took while it was offered counts from that day.
2. **The seed row** `intro-to-plumbing`, *Intro to plumbing*, **off**, required of helpers, offered, good for 120 months (the owner's calls 1 and 6 as drawn in `to-dos/intro-plumbing/README.md`). `ON CONFLICT DO NOTHING`.

No table is created, so no fence applier; RLS is the row's and the column rides it. `ACCESS_CONTROL.md` → Training carries the column.

## Verify

Read-only on prod after the push: `select slug, enabled, offered, required_roles, good_for_months from training_courses order by slug` reads two rows, the new one off and offered; `select * from training_state_for(auth.uid())` as a controller reads nothing for it. The bed `npm run test:pg:training` (CI's `sql-beds` job) asserts the seed, that a role the course is not required of reads no colour and may pass it, that the office reads the pass, and that requiring the role later turns that pass green at once.
