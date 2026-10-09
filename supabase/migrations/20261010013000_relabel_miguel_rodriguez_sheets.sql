SET lock_timeout = '3s';

-- Five sub sheets carry the keeper's name (v2.5053; the owner's office-data call of 2026-10-09, sent by Punchlist,
-- done as a data migration on the user's word). Doc: docs/migrations/20261010013000_relabel_miguel_rodriguez_sheets.md.
--
-- The five sheets are labelled "Miguel Rodriguez", a name no roster person has, yet each is already linked to the
-- keeper `Miguel "Mike" Rodriguez` (people d1c06d87) in people_labor_job_assignees. Only the label is stale, so
-- neither Combine people's step 3 nor People → Subs' Assign reaches them.
--
-- sync_assignees_on_write rebuilds the link from the new label, which resolve_pay_person_id maps to the keeper,
-- so the five links come back the same. The job link and the stage trigger do not fire on a label change: each sheet
-- already has its job and keeps its stage.
--
-- Data only, and idempotent: the WHERE names the five ids and the old label, so a second run changes nothing.

UPDATE public.people_labor_jobs
SET assigned_to_name = 'Miguel "Mike" Rodriguez'
WHERE id IN (
    'b5c7b32a-b78c-4a87-9420-54ccad410ae6',
    '2c06f9d4-53b5-4515-a155-b916657c9b82',
    'c6dc06c0-8b75-4235-94e5-eb59be49c23e',
    '7084016e-dc02-473a-b10e-cefcab46d9ff',
    '58e432ac-7e0d-4695-84ab-81ffa2dd7264'
  )
  AND assigned_to_name = 'Miguel Rodriguez';
