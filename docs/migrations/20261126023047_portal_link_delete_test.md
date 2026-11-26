# 20261126023047_portal_link_delete_test.sql (2026-11-26, v2.8621)

A developer deletes a turned-off portal link of a test customer. Punch list #443, row 11, the first of the take-backs that need a migration, on the owner's answer of 2026-11-25 (*All eight*), each push on its own yes.

## Why

**Turn off**, then **Turn the portal off**, in a customer's portal window sets `revoked_at` on the `customer_portal_links` row and keeps it for the window's History. The table has one read policy and no delete policy ([`20260821213000_customer_portal_links`](./20260821213000_customer_portal_links.md)), so a direct delete reaches no row and every walk that turned a ZZ Test customer's portal off left a row for good: six stood on one ZZ Test customer on 2026-11-25.

## What it makes

Two functions, both `CREATE OR REPLACE`, both `SECURITY DEFINER`. No table is created, so the four closing calls do not apply. The table's own policies are as they were, and it still has no delete policy of its own, so a direct delete reaches no row: the delete goes through this door and no other.

- **`customer_is_zz_test(p_customer_id uuid) → boolean`**, `STABLE`, `row_security = off`. The ZZ convention in SQL for a customer, as `isZzTestName` says it: the customer's name starts with ZZ after trimming, in any case. Beside `job_is_zz_test` ([`20261120163000`](./20261120163000_settings_on_the_job.md)). Internal: revoked from `PUBLIC`, `anon` and `authenticated`.
- **`delete_test_portal_link(p_link_id uuid) → jsonb`**, granted to `authenticated`. Refuses, in words, a caller who is not signed in, a caller who is not a developer (`is_dev()`), a link that is not there, a link still live (`revoked_at` null), a link of a customer whose name does not start with ZZ, and a link that any `job_paper_proposals` row names (`portal_link_id`, `ON DELETE SET NULL` since [`20261125023655`](./20261125023655_job_paper_gc_proposals.md), which would otherwise forget the link without a word). Then deletes the one row and answers `{ ok, customer_id, audience }`.

## What stays

Who reads, inserts and updates the table. `Turn off`, `Rotate` and `Turn portal back on`. The History, which lists what is left. A real customer's rows, every live row, and every row a GC proposal names.

## Locks

`CREATE OR REPLACE FUNCTION`, `REVOKE`, `GRANT` and `COMMENT` on two functions. No table is locked. `SET lock_timeout = '3s'` opens the file.

## Order

The client calls `delete_test_portal_link` by name, which only this migration creates, so `npm run check:calls-ahead` labels the PR *push right after the merge* and `deploy.yml` holds the client until the push. Until the push a press would be answered with a missing name, read as a refusal; nothing else of the window changes. Push with `bash scripts/db-push.sh` from a checkout of main right after the merge. No types PR follows for the client: it calls the function as an untyped RPC, as the other take-backs call theirs; the generated types gain the two functions on the next `chore(types)` PR.

## Test

`npm run test:pg:portal-link-delete` applies this migration a second time after every migration, which must change nothing, and plays `supabase/tests/portal_link_delete/20_scenario.sql`: an assistant refused at the door and refused a direct delete; a dev refused a live link, a real customer's turned-off link, a link a GC proposal names (with the count) and a link that is not there, and refused a direct delete; the dev deletes the ZZ Test customer's turned-off link, which is gone while the others stand, and a second delete of it is refused; the proposal still names its link; signed out, the door refuses. No Postgres runs on the Mac that built this, so the SQL beds job on the PR is the proof of the SQL.
