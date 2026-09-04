# 20260904210406_sub_sheet_stage_trigger_click_number

**Sub sheet stages follow-up (v2.2782)** — the stage → Activity trigger learns click-number jobs.

## What it does

`CREATE OR REPLACE FUNCTION public.people_labor_jobs_stage_to_activity()` (the trigger from `20260904195443` keeps its name and binding). The job lookup becomes: `lower(btrim(coalesce(hcp_number,'')))` = the sheet's trimmed, lower-cased `job_number`, newest first; if nothing matches, the same against `click_number`. An empty key never matches. Everything written (summary, actor, `detail`) is unchanged.

## Order

Push any time after `20260904195443`; nothing else depends on it. No client or function deploy.
