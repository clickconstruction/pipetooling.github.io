# 20261116050000_scorecard_hurdle_owner_policy.sql (2026-11-15, v2.7361)

Team scorecard, PR 3 (punch list #360): the owner's own write on `app_settings.scorecard_hurdle_v1`, the target profit per paid field hour the hurdle is built from.

- **`master_or_dev_insert_scorecard_hurdle`** and **`master_or_dev_update_scorecard_hurdle`** on `app_settings`: `key = 'scorecard_hurdle_v1' AND is_master_or_dev()`, the shape the other owner-set keys have. Until now only the devs' blanket policy could write the key. Everyone signed in already reads `app_settings`; no delete policy is added, since the target is changed and never removed.
- No table is created, so there are no fence calls: the read-only, twin and archived fences on `app_settings` stand as they are.

`CREATE POLICY` takes a brief lock on `app_settings`; `lock_timeout` is 3 s, so on a busy moment the push fails fast and is run again.

**Apply order**: any. Until the push the owner's save is refused with the policy's own words and a dev's still lands; nothing else reads differently.

**Applied** to prod by 2026-11-16: `npm run check:migration-drift` read 1326 local files against 1326 applied, this version among them (run in the docs pass after #8111).
