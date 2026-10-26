# 20261026121000_bridge_sheet_rpcs_service_role.sql (2026-10-26, v2.5883)

Five RPCs the Monday sheet reads let the **service role** through their role gate, so `bridge-weekly-sheet` builds on Monday morning the same sheet the page builds for a dev. The shape of `20260924030000_lien_rpcs_service_role.sql`: bodies verbatim from their newest definitions, only the gate changes, `CREATE OR REPLACE` with the same signatures and returns.

## What it does

| function | newest body | the gate before | the gate after |
|---|---|---|---|
| `get_billed_customer_pay_speeds()` | `20261009235900` | `is_dev() OR is_assistant() OR` the master, the controller or a primary | `… OR auth.role() = 'service_role'` |
| `list_job_promised_pay_dates()` | `20260911052931` | `is_dev() OR is_assistant() OR` the master or a primary | `… OR auth.role() = 'service_role'` |
| `list_payment_chase_touches()` | `20260822000000` | `is_dev() OR is_assistant() OR` the master | `… OR auth.role() = 'service_role'` |
| `list_tally_parts_with_po()` | `20260927233000` | the caller's role and job reach | `auth.role() = 'service_role' OR` the same |
| `count_unattributed_noncard_mercury_transactions()` | `20260802220000` | a signed-in dev or banking attributor | the service role, or the same |

Each ends with `REVOKE EXECUTE … FROM PUBLIC, anon; GRANT EXECUTE … TO authenticated, service_role;`, as the lien RPCs do.

## Why

Each of the five answers `NULL`, an empty set or a refusal to a caller with no `auth.uid()`, and the service role has none. The page's loaders read that as "not read" (`paySpeeds: null`, no promises, no touches, no office parts in the overhead pool, no hygiene count), so a sheet built as the service role would read every bill at the default pace, lose the promises and the Collect desk's last touches, and miss the office parts in overhead: a different sheet from the page's. With the gate open the function makes the same reads the page makes.

`count_unlinked_mercury_transactions_for_tally()` stays as it is: it counts the caller's own debit cards, which the service role has none of, and the sheet reads its refusal as "not read", as the page does for a role it refuses.

## Safety

- `SET lock_timeout = '3s'` first.
- The service role already reads every table these functions read (it bypasses RLS), so nothing new is reachable; a signed-in caller's answer is unchanged, since the new clause is an `OR` on the gate and nothing else moves.
- `CREATE OR REPLACE` on the same signatures: no drop, no window, idempotent.
- No table, so no fences.

## Verify on prod (read only)

```sql
SELECT proname, prosrc LIKE '%service_role%' AS lets_service_role
FROM pg_proc WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('get_billed_customer_pay_speeds', 'list_job_promised_pay_dates', 'list_payment_chase_touches', 'list_tally_parts_with_po', 'count_unattributed_noncard_mercury_transactions');
```

Then `bridge-weekly-sheet`'s dry run as a dev: `gaps` names nothing the service role was refused, and the Collect lines read with paces and touches.
