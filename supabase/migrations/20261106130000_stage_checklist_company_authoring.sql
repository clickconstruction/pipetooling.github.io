-- 20261106130000_stage_checklist_company_authoring.sql
-- Punch list #237, PR 4 (v2.6581): the company's checklist questions are written on the job's Documents tab now, and
-- Settings → Jobs & billing → Stage checklists reads them back. One thing the schema could not hold: a company
-- question taken off the company's list carries its reason, the way a skip (20261102084500) and a take back
-- (20261106040000) do, since every job of the kind stops asking it and the office should say why.
--
--   1. retired_why and retired_by_name on stage_checklist_templates: the reason a company question came off the
--      company's list and who took it off, as the Settings mirror prints it under *Taken off*. Both NULL on a row the
--      old Settings editor retired, on a job item taken off (no reason is asked there), and on a job item a promote
--      retired. The office writes them under its own update branch; nothing else changes in the gates.
--   2. stage_checklist_item_adder_only_retires() is written again with the two columns among the ones an adder may
--      change, so a later PR can ask the adder of a job item why without another migration.
--
-- Additive and idempotent. No table is created, so no fence call is needed. The ALTER takes a short ACCESS EXCLUSIVE on
-- a table of a few rows; lock_timeout makes a busy moment fail fast.
SET lock_timeout = '3s';

ALTER TABLE public.stage_checklist_templates
  ADD COLUMN IF NOT EXISTS retired_why text CHECK (retired_why IS NULL OR length(retired_why) BETWEEN 3 AND 200),
  ADD COLUMN IF NOT EXISTS retired_by_name text CHECK (retired_by_name IS NULL OR length(retired_by_name) <= 120);

COMMENT ON COLUMN public.stage_checklist_templates.retired_why IS 'Why a company question came off the company''s list (#237 PR 4), 3 to 200 characters; NULL on a job item taken off, on a promote''s retire and on rows the old Settings editor retired.';
COMMENT ON COLUMN public.stage_checklist_templates.retired_by_name IS 'The name of whoever took the row off, as the Settings mirror prints it under Taken off (#237 PR 4). retired_by holds the login.';

CREATE OR REPLACE FUNCTION public.stage_checklist_item_adder_only_retires()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user = 'authenticated'
     AND NOT (public.is_master_or_dev() OR public.is_assistant())
     AND (to_jsonb(NEW) - ARRAY['retired_at', 'retired_by', 'retired_by_name', 'retired_why', 'updated_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['retired_at', 'retired_by', 'retired_by_name', 'retired_why', 'updated_at']) THEN
    RAISE EXCEPTION 'The person who added a check only takes it off.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.stage_checklist_item_adder_only_retires() FROM PUBLIC, anon, authenticated;
