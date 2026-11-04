# 20261103143000 — Materials on site: three small fixes (v2.6456)

Three fixes the dev seat's work on Materials on site turned up (punch list #209, after v2.6367). No table is created, so no fence is owed.

1. **Who made a cage, a box or a place.** The phone's and the office's adds call the store without the signed-in user, and the store sends `created_by: null`, so all 100 containers on prod read null. A column default would not help, since an explicit null skips it. **`on_site_fill_created_by()`** is a `BEFORE INSERT` trigger on `job_containers` and `job_places` (`job_containers_fill_created_by`, `job_places_fill_created_by`) that sets `created_by := auth.uid()` when the insert leaves it null. That covers every client at once, the cached copies on crews' phones too. An insert that names a user keeps it, and a service-role insert stays null. Rows written before stay null: nothing recorded who made them.
2. **`on_site_line_on_hand(p_container_id, p_part_id DEFAULT NULL, p_part_name DEFAULT NULL)`.** Both part arguments now default to null. The dev seat's `call_read` is a GET, which cannot send a null, so it could only read a parts-book line before; now it names `p_part_name` alone for a typed line and `p_part_id` alone for a book line. The body is unchanged, and the wrapper still calls it with all three.
3. **`dev_on_site_write` names the job as the app does.** Its replies and refusals said `972` where the app and `read_on_site` say `JP972`. The job lookup now joins `service_types` and builds the label as `formatJobLedgerNumberLabel` does: the type's `ledger_job_prefix`, else `J`, then the HCP number, else the Click number, else `—`. The wrapper is re-stated whole from its newest definition (`20261102100000`), and only the job lookup changed. `src/lib/devMcp/devMcpWrites.test.ts` now holds the wrapper's rules on whichever migration defines it last.

Proven on a throwaway Postgres 15: the earlier migration and this one applied twice. Every earlier case and refusal passed on the new definition. The label read `JP972` on a typed job and `J1085` on one with no service type and only a Click number. The trigger filled a null or missing `created_by`, kept a given one, and left it null with no user. The on-hand read took one part argument by name.

## Order

Merge, then `supabase db push`. No function to deploy: dev-mcp passes the wrapper's reply through, and `call_read` reaches the defaults as soon as PostgREST reloads its schema. A plan made before the push and applied after it refuses once, since the job's label is in the plan, so plan again.

**Applied** to prod by 2026-11-04: `npm run check:migration-drift` read 1105 local files and 1105 remote versions, fully applied (read in the docs pass after #6888); `check:edge-drift` read every one of the 178 functions deployed and current the same day, `dev-mcp` among them; types regenerated from prod in #6961, and again in #6962.
