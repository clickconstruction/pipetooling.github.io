# 20260929170000_submittal_robot_liveness.sql (2026-09-29, v2.4136)

**What**: one new reader, `public.submittal_robot_liveness()` → `jsonb { unrevoked_seats, last_used_at }` over `twin_credentials` (rows with `revoked_at IS NULL`; the newest `last_used_at` among them). `STABLE SECURITY DEFINER`, `search_path = public`; execute granted to `authenticated` and `service_role`, revoked from `public`.

**Why**: Bids → Submittals shows a robot offer only while a robot seat is live (used inside seven days) and says when one last ran (`lib/submittals/robotOffer.ts`); `twin_credentials` is dev-readable only (`twin_credentials_select_dev`, `20260828080000`), so the office roles need a reader that answers two facts and nothing secret.

**Risk**: additive; `CREATE OR REPLACE`; no table touched. A client older than v2.4136 never calls it; a v2.4136 client on a database without it reads "no seat" and shows no offers (the safe side). `SET lock_timeout = '3s'`.

**Deploy with**: `supabase db push` before or after the client — order does not matter (see Risk).
