# 20261116123000_my_sub_sheets_on_job.sql (2026-11-15, v2.7399)

Punch list #355 ([`to-dos/job-window-phone.md`](../../to-dos/job-window-phone.md)). Taunya's pick of 2026-11-15, after the before and after were drawn ([`to-dos/job-window-phone-sub-pay.html`](../../to-dos/job-window-phone-sub-pay.html)): **"Draw it now"**, a Your pay row on a subcontractor's job window.

- **`my_sub_sheets_on_job(p_job_id)`** → `jsonb`: `on_roster`, `sheets`, `items`, `payments`, `portal_slug`, `portal_token`. The rows are the ones the edge function `sub-portal` reads for the person's portal, cut to one job, in the shapes its kernel takes (`SubSheetRow`, `SubItemRow`, `SubPaymentRow` in `supabase/functions/_shared/subPortalStatement.ts`). The client runs that kernel, `buildSubSheets`, so the window states the money the portal states. Nothing is summed in SQL.
- **Whose rows**: the roster person whose account is the caller (`people.account_user_id = auth.uid()`, not archived), and only the sheets `people_labor_job_assignees` ties to that person with `job_ledger_id` the job asked for. An old sheet with several typed names and no junction row is left out, as the portal leaves it out. A caller who is no one on the roster gets `on_roster: false` and empty lists.
- **The portal's address**: the person's own short address (`sub_portal_slugs`), else their newest live link's token (`sub_portal_links`, not revoked). It is the link the office already sends them. None is minted here.
- A payment's `memo` is sent as null: it is the office's note, and the row does not read it.
- `SECURITY DEFINER`, `row_security = off`, `search_path = public`: the sheet tables are the office's. Execute: `authenticated`, `service_role`; revoked from `PUBLIC` and `anon`. No table is created, so the four fence calls are not needed.

**Read on prod before the PR** (2026-11-15, counts only): 12 crew rows put 4 subcontractors on working jobs. All 12 logins are tied to a roster person. 8 of the 12 are on a job that has a sheet; 3 have a sheet of their own on that job.

**The bed.** `plan_sets_author`: Sam, a subcontractor whose roster person is on one of job A's two sheets, reads that sheet with its item, its payment and his portal's address, and none on job B; Hal, who is no one on the roster, reads nothing.

**Apply order**: push right after the merge. The client fails soft: until the push the row is not drawn.
