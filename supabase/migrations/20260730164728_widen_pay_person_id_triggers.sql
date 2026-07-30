SET lock_timeout = '3s';

-- Person-identity trigger widening (FRAGILITY_REMEDIATION_PLAN.md step C0.4,
-- folding in C0.3; docs/PERSON_IDENTITY_PLAN.md).
--
-- The Phase B/B2 triggers (20260722268000 / 20260722270000) fired on INSERT
-- only, so a later person_name UPDATE never re-resolved person_id:
--   * PersonOffsetFormModal edit: swapping the person rewrites person_name but
--     leaves person_id pointing at the previous person (silent cross-person
--     attribution once readers go id-first).
--   * Rename cascades / Combine-people rewrite names in bulk; rows whose
--     person_id was NULL at insert time stayed NULL forever.
--
-- New behavior, BEFORE INSERT OR UPDATE OF person_name on all ten pay tables:
--   * INSERT with NULL person_id  -> resolve from person_name (unchanged).
--   * UPDATE that changes person_name while the writer did NOT choose a new
--     person_id -> re-resolve, keeping the old id when the new name is
--     unresolvable: COALESCE(resolve(new_name), old id). Rationale: for a
--     same-person rename the resolver can transiently miss (the users/people
--     row may not be renamed yet in the same client sequence) and keeping the
--     id is correct; for a person swap the pickers only offer existing roster
--     people, so the resolver hits. The only wrong-id case left is a swap to
--     an ambiguous duplicate active name — Phase A measured zero of those,
--     and Phase D's unique indexes will make it impossible.
--   * UPDATE that explicitly sets person_id (changed vs OLD) -> trust the
--     writer; never overwrite.

CREATE OR REPLACE FUNCTION public.pay_tables_set_person_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.person_id IS NULL THEN
    NEW.person_id := public.resolve_pay_person_id(NEW.person_name);
  ELSIF TG_OP = 'UPDATE'
        AND NEW.person_name IS DISTINCT FROM OLD.person_name
        AND NEW.person_id IS NOT DISTINCT FROM OLD.person_id THEN
    NEW.person_id := COALESCE(public.resolve_pay_person_id(NEW.person_name), NEW.person_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate the trigger on all ten tables (five Phase B + five Phase B2) under
-- the accurate name set_person_id_on_write; drop the old insert-only name.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'people_pay_config',
    'people_hours',
    'people_crew_jobs',
    'pay_stubs',
    'people_team_members',
    'people_crew_bids',
    'pay_stub_days',
    'people_hours_display_order',
    'person_offsets',
    'hours_reviewed'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_person_id_on_insert ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS set_person_id_on_write ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER set_person_id_on_write BEFORE INSERT OR UPDATE OF person_name ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.pay_tables_set_person_id()',
      t
    );
  END LOOP;
END;
$$;

-- No CREATE TABLE in this migration, so the read-only sweep calls are not
-- required. Idempotent: CREATE OR REPLACE + drop-if-exists/recreate.
