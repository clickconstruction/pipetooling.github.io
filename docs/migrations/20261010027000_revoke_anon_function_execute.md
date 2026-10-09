# 20261010027000_revoke_anon_function_execute.sql (2026-10-09, v2.5040)

The blanket revoke, the owner's call of 2026-10-09 (sent by Punchlist): **anon keeps EXECUTE only on the functions granted to it by name.** Supabase's defaults had given every new public function EXECUTE for `PUBLIC` and `anon`. So the publishable key, which ships in the client bundle, could call 524 of prod's 868 public functions.

## What it does

Grants and default privileges only. No table, row or function body changes. `SET lock_timeout = '3s'` comes first, and a second run changes nothing (the bed's grant snapshot is byte-identical after a second apply).

1. `REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon`. `authenticated` and `service_role` keep their own grants.
2. New functions start the same way: `ALTER DEFAULT PRIVILEGES FOR ROLE postgres` revokes EXECUTE from `PUBLIC`, and the public schema's default revokes it from `anon`.
   - `PUBLIC`'s EXECUTE is a global default, so that revoke covers every schema postgres creates a function in.
   - A new public function gets EXECUTE for `authenticated` and `service_role`. A new function anywhere else gets its owner only.
3. Two grants back to `anon`, by name: `get_hazmat_notice_by_token(uuid)` and `list_my_contract_dashboard_prompts()`.
4. Five grants to the two database agent roles. Their reads and writes evaluate these policy helpers, which they reached only through `PUBLIC`:
   - `cost_agent`: `is_primary()` and `primary_can_access_job(uuid)`
   - `hr_agent`: `is_dev()`, `is_digital_twin()` and `is_read_only()`

**Who loses what**, read on prod 2026-10-09 and measured again on the bed after the migration:

| Role | Could run | After | Lost |
|---|---|---|---|
| `anon` | 524 | 2 | everything but the two named grants |
| `authenticated` | 778 | 776 | `sync_controller_banking_attributors()` and its trigger function. `20260804100000` revoked them from `anon` and `authenticated` by name, but `PUBLIC` still held them. Nothing signed-in calls them, and the statement trigger on `users` still fires (row D10). |
| `service_role`, `postgres` | 868 | 868 | nothing |
| `cost_agent` / `hr_agent` | 410 / 409 | 4 / 4 | the `PUBLIC`-only functions. Their entrypoints keep explicit grants, and step 4 adds the helpers their policies evaluate. |
| Supabase's own roles | 408 each | 0 | the 408 `PUBLIC`-only functions. None of them runs a public function as itself. |

More on Supabase's own roles (`authenticator`, `supabase_auth_admin`, `supabase_storage_admin`, `pgbouncer`, `supabase_read_only_user` …):
- PostgREST and Storage switch to `anon`, `authenticated` or `service_role` first.
- `authenticator` has no pre-request function.
- Auth's triggers on `auth.users` are SECURITY DEFINER, and Postgres does not check EXECUTE on a trigger function when it fires (rows F and G).
- The only visible effect: ad-hoc SQL as `supabase_read_only_user` can no longer call a public helper.

## What a signed-out visitor calls

A trace of every route that renders signed out (`src/App.tsx`: the estimate, bid room, submittal room, contract, hazmat notice, customer, sub, legal and trade-partner portals, pay link, sign-in pages) found one database call made as anon from a browser. Every edge function that builds an anon-key client was traced too.

- **`/hazmat-notice` calls `get_hazmat_notice_by_token`** (`HazmatNoticePublic.tsx`). It is the one function a signed-out page needs.
- **Every other public page calls an edge function, and those use the service role**: the portals, the estimate page, the page views, the estimate events, and the legal and sub portals' token reads. No table, view or storage bucket is read or written as anon.
- **`list_my_contract_dashboard_prompts`** runs only signed in. `ContractAccept` checks for a user first, and the Dashboard is behind sign-in. It is granted to anon on the owner's word. For anon it returns nothing (`u.id = auth.uid()`).
- **`court-precinct-nightly`** asks `is_office_staff()` through an anon-key client before it checks for a user. A signed-out caller now gets a permission error instead of `false`. The function reads both as "not staff", so the answer is the same 401 (row A4).

**No third re-grant.** No policy, default or CHECK that a signed-out flow evaluates needs a helper granted to anon.

## The bed

- **Prod's schema:** a schema-only `pg_dump` of prod's public schema, taken 2026-10-09 10:04 UTC (read-only, `--lock-wait-timeout=3s`). It was restored into Homebrew Postgres 15.14, since prod is 17.6.
- **Roles:** prod's 19 roles, with their attributes and memberships. `postgres` is a non-superuser with BYPASSRLS that owns every function, as on prod.
- **Stand-ins:** Supabase's own `auth.uid()` / `auth.role()` / `auth.jwt()`, the `extensions` schema, and stubs for `storage`, `net`, `vault` and `cron`.
- **The restore:** one error, the existing `public` schema. Thirty table grants lost Postgres 17's `MAINTAIN`, which 15 lacks.
- **The counts match prod:** 868 functions, 501 tables, 5 views, 4,449 policies and 862 triggers. Before the migration, anon reaches 524 and `authenticated` 778.
- **How each probe runs:** under its role with PostgREST's claims (`request.jwt.claims`), inside a subtransaction that always rolls back.
- **Fixtures:** one dev, one job with a hazmat notice and a known token, and one person with an HR file and a report. The probes reach the end of each path.
- **Columns:** *Before* is today. *Revoke only* is steps 1–3. *This migration* is all four steps. "Refused by its body" means the function ran and its own check said no (a missing payload, an unknown id): EXECUTE passed.

| Path | Role | Before | Revoke only | This migration |
|---|---|---|---|---|
| **A · what signed-out pages call as anon** | | | | |
| A1 /hazmat-notice: get_hazmat_notice_by_token, the fixture token (asserts a row) | `anon` | pass | pass | pass |
| A2 /hazmat-notice: get_hazmat_notice_by_token, an unknown token | `anon` | pass | pass | pass |
| A3 list_my_contract_dashboard_prompts, signed out (no page calls it so) | `anon` | pass | pass | pass |
| A4 court-precinct-nightly: is_office_staff, a signed-out caller | `anon` | pass | **no EXECUTE on `is_office_staff`** | **no EXECUTE on `is_office_staff`** |
| **B · the tables named for the check, read and written as anon (no page does this)** | | | | |
| B1 public_page_views select | `anon` | pass | pass | pass |
| B2 public_page_views insert | `anon` | refused by RLS | refused by RLS | refused by RLS |
| B3 estimate_customer_events select | `anon` | pass | pass | pass |
| B4 estimate_customer_events insert | `anon` | refused by RLS | refused by RLS | refused by RLS |
| B5 jobs_ledger select | `anon` | denied (`master_assistants` view) | denied (`master_assistants` view) | denied (`master_assistants` view) |
| B6 job_hazmat_incidents select | `anon` | pass | pass | pass |
| **C · the service-role edge functions behind every public page** | | | | |
| C1 portal page view insert (customer-portal, sub-portal, gc-trade-portal, legal-portal) | `service_role` | pass | pass | pass |
| C2 log_estimate_customer_event (accept-estimate, log-estimate-option-view) | `service_role` | pass, refused by its body | pass, refused by its body | pass, refused by its body |
| C3 record_estimate_public_link_view (get-estimate-for-customer) | `service_role` | pass | pass | pass |
| C4 legal_portal_guess_gate (legal-portal, submit-legal-portal) | `service_role` | pass | pass | pass |
| C5 legal_portal_link_token (legal-notify-dispatch) | `service_role` | pass | pass | pass |
| C6 legal_portal_link_token_by_id (legal-send-firm-link) | `service_role` | pass | pass | pass |
| C7 list_schedule_blocks_for_share (schedule-share-dispatch) | `service_role` | pass | pass | pass |
| **D · signed in, through an anon-key client or a page** | | | | |
| D1 list_my_contract_dashboard_prompts (Dashboard, ContractAccept) | `authenticated` | pass | pass | pass |
| D2 is_office_staff (court-precinct-nightly from the map) | `authenticated` | pass | pass | pass |
| D3 legal_office_can_read (legal-portal, legal-send-firm-link) | `authenticated` | pass | pass | pass |
| D4 can_access_bid_for_pricing (file-submittal-package) | `authenticated` | pass | pass | pass |
| D5 user_can_manage_recurring_job_report_scope (recurring-job-report-*) | `authenticated` | pass | pass | pass |
| D6 user_can_work_team_prospect (create-user) | `authenticated` | pass | pass | pass |
| D7 merge_user_accounts, dry run (merge-users) | `authenticated` | pass | pass | pass |
| D8 revert_stripe_oob_invoice_payment (reverse-stripe-invoice-out-of-band-payment) | `authenticated` | pass | pass | pass |
| D9 users read | `authenticated` | pass | pass | pass |
| D10 users update fires the banking-sync statement trigger | `authenticated` | pass | pass | pass |
| D11 jobs_ledger read | `authenticated` | pass | pass | pass |
| **E · the two database agent roles** | | | | |
| E cost_agent reads clock_sessions | `cost_agent` | pass | pass | pass |
| E cost_agent reads cost_batch_ops | `cost_agent` | pass | pass | pass |
| E cost_agent reads cost_batches | `cost_agent` | pass | pass | pass |
| E cost_agent reads customers | `cost_agent` | pass | pass | pass |
| E cost_agent reads jobs_ledger | `cost_agent` | pass | **no EXECUTE on `is_primary`** | pass |
| E cost_agent reads jobs_ledger_invoices | `cost_agent` | pass | **no EXECUTE on `is_primary`** | pass |
| E cost_agent reads jobs_ledger_materials | `cost_agent` | pass | **no EXECUTE on `is_primary`** | pass |
| E cost_agent reads jobs_ledger_payments | `cost_agent` | pass | **no EXECUTE on `is_primary`** | pass |
| E cost_agent reads jobs_ledger_thread_notes | `cost_agent` | pass | **no EXECUTE on `is_primary`** | pass |
| E cost_agent reads mercury_transaction_job_allocations | `cost_agent` | pass | pass | pass |
| E cost_agent reads mercury_transactions | `cost_agent` | pass | pass | pass |
| E cost_agent reads people | `cost_agent` | pass | pass | pass |
| E cost_agent reads supply_house_invoice_job_allocations | `cost_agent` | pass | pass | pass |
| E cost_agent reads supply_house_invoices | `cost_agent` | pass | pass | pass |
| E cost_agent reads supply_houses | `cost_agent` | pass | pass | pass |
| E cost_agent reads users | `cost_agent` | pass | pass | pass |
| E cost_agent: cost_batch_apply dry run | `cost_agent` | pass, refused by its body | pass, refused by its body | pass, refused by its body |
| E cost_agent: cost_batch_revert | `cost_agent` | pass, refused by its body | pass, refused by its body | pass, refused by its body |
| E hr_agent reads people | `hr_agent` | pass | pass | pass |
| E hr_agent reads person_file_attachments | `hr_agent` | pass | pass | pass |
| E hr_agent reads person_file_entries | `hr_agent` | pass | pass | pass |
| E hr_agent reads person_file_revisions | `hr_agent` | pass | pass | pass |
| E hr_agent reads person_files | `hr_agent` | pass | pass | pass |
| E hr_agent reads person_reports | `hr_agent` | pass | **no EXECUTE on `is_dev`** | pass |
| E hr_agent inserts person_files | `hr_agent` | pass | **no EXECUTE on `is_digital_twin`** | pass |
| E hr_agent inserts person_file_entries | `hr_agent` | pass | **no EXECUTE on `is_digital_twin`** | pass |
| E hr_agent inserts person_file_attachments | `hr_agent` | pass | **no EXECUTE on `is_digital_twin`** | pass |
| E hr_agent updates person_files | `hr_agent` | pass | **no EXECUTE on `is_digital_twin`** | pass |
| E hr_agent updates person_reports | `hr_agent` | pass | **no EXECUTE on `is_digital_twin`** | pass |
| E hr_agent: hr_agent_write | `hr_agent` | pass, refused by its body | pass, refused by its body | pass, refused by its body |
| **F · Supabase Auth (GoTrue) on sign-up and sign-in** | | | | |
| F sign-in stamps last_sign_in_at (sync_last_sign_in_at trigger) | `supabase_auth_admin` | pass | pass | pass |
| F a new auth user (handle_new_user trigger) | `supabase_auth_admin` | pass | pass | pass |
| **G · the method: what Postgres checks EXECUTE on** | | | | |
| G method: a policy function, zero rows | `anon` | **no EXECUTE on `f_policy`** | **no EXECUTE on `f_policy`** | **no EXECUTE on `f_policy`** |
| G method: a column default function | `anon` | **no EXECUTE on `f_default`** | **no EXECUTE on `f_default`** | **no EXECUTE on `f_default`** |
| G method: a CHECK function | `anon` | **no EXECUTE on `f_check`** | **no EXECUTE on `f_check`** | **no EXECUTE on `f_check`** |
| G method: the trigger function itself | `anon` | pass | pass | pass |
| G method: a function an INVOKER trigger calls | `anon` | **no EXECUTE on `f_inner`** | **no EXECUTE on `f_inner`** | **no EXECUTE on `f_inner`** |

The G rows are the method. A function in a policy is checked even when the table is empty, and so are a column default and a CHECK, and so is anything an INVOKER trigger calls. The trigger function itself is not checked. So a zero-row probe is enough to show a missing grant.

### Every public table, read as anon

Run on every public table and view, `select 1 … limit 1` as anon:

| | Answers (empty) | Function error | Other refusal |
|---|---|---|---|
| Before | 379 | 13 | 114 |
| After | 190 | 202 | 114 |

- After the migration, a signed-out read of 189 tables gets a permission error instead of an empty answer. The functions are mostly `is_dev`, `is_primary` and `has_payroll_access`.
- No route makes such a read: signed-out pages make the one call above, and the providers wait for a user id. If a page ever queries before its session loads, it will show an error rather than an empty list.

### The SQL beds

The eleven beds that replay the whole migration chain ran their own scripts against copies of this bed: bid changes, bid copies, bid next follow-up, combined copies, GC award, GC building, GC owner billing, GC schedule, materials model flip, pay applications and supply house words.
- The beds ran in en_US collation and UTC, as on the Supabase image. Each script's migration loop was replaced, since the dump is that chain's result.
- All eleven pass without this migration and with it.
- One scenario needed a line. `supabase/tests/bid_changes/20_scenario.sql` creates `pg_temp.price_change()` as postgres and calls it as `authenticated`. A new function no longer carries `PUBLIC` EXECUTE, so the scenario now grants it.

## From now on

- A function a signed-out caller needs is granted to `anon` by name in its migration, with a line in `docs/ACCESS_CONTROL.md` (SECURITY DEFINER RPCs and the anon key).
- A function another role calls is granted to that role by name. That covers a function outside `public`, a bed's helper, and a helper a new policy on the agent roles' tables calls.
- `CREATE OR REPLACE` keeps a function's grants. A `DROP` and `CREATE` starts from the defaults, so it re-grants what anon or an agent role needs.

## Push

This is a quiet-window release Punchlist picks, and the PR merges in that window too. Once the PR is on main, the next `supabase db push` for any other migration applies this one as well. It needs no client deploy, no function deploy and no type regeneration, since grants do not change the generated types.

Before the push, keep the grants as they are, read-only:

```sql
SELECT p.oid::regprocedure, p.proacl FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace ORDER BY 1;
```

## Verify after the push

Read-only:

```sql
SELECT p.oid::regprocedure FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace AND has_function_privilege('anon', p.oid, 'EXECUTE');
```

- That lists exactly `get_hazmat_notice_by_token(uuid)` and `list_my_contract_dashboard_prompts()`.
- `has_function_privilege` is true for `cost_agent` on `is_primary()` and `primary_can_access_job(uuid)`, and for `hr_agent` on `is_dev()`, `is_digital_twin()` and `is_read_only()`.
- `pg_default_acl` for postgres's functions reads `{postgres=X/postgres}` globally, and `{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}` in public.
- Signed in, the Dashboard loads, and a hazmat notice link opens signed out.

**The publishable-key probes.** These send the same two headers supabase-js sends for a signed-out visitor. Run them from a checkout with `.env.local`:

```bash
ANON="$(grep -E '^VITE_SUPABASE_ANON_KEY=' .env.local | cut -d= -f2- | tr -d "\"'")"; U=https://yewfzhbofbbyvkvtaatw.supabase.co/rest/v1/rpc
curl -s -w ' | HTTP %{http_code}\n' -X POST "$U/get_hazmat_notice_by_token" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H 'Content-Type: application/json' -d '{"p_token":"00000000-0000-0000-0000-000000000000"}'
curl -s -w ' | HTTP %{http_code}\n' -X POST "$U/is_dev" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H 'Content-Type: application/json' -d '{}'
curl -s -w ' | HTTP %{http_code}\n' -X POST "$U/is_office_staff" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H 'Content-Type: application/json' -d '{}'
```

| RPC | Before the push (read 2026-10-09 10:57 UTC) | After the push |
|---|---|---|
| `get_hazmat_notice_by_token` | `null`, HTTP 200 | `null`, HTTP 200 (still granted) |
| `is_dev` | `false`, HTTP 200 (anon could run it) | HTTP 401, `"code":"42501"` |
| `is_office_staff` | `false`, HTTP 200 | HTTP 401, `"code":"42501"`. `court-precinct-nightly` reads this as "not staff" and still answers 401. |

## Roll back

- **One function a signed-out flow turns out to need:** `GRANT EXECUTE ON FUNCTION public.<name>(<args>) TO anon;`, then a line in `docs/ACCESS_CONTROL.md`.
- **The whole change:** re-apply the grants kept before the push, then `ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT EXECUTE ON FUNCTIONS TO PUBLIC;` and the same `IN SCHEMA public … TO anon`.
  - `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon` alone over-grants: 868 functions, not the 524 there were.
