-- A bid version can be locked by its owner so only they edit it (2026-10-31, v2.6234). The owner: *in
-- versioning a user should have the option to lock down that version so only they can edit, if they
-- choose; this should definitely not be enabled by default.* A version gets an owner (the person who made
-- or adopted it); the owner may lock it; a dev or a master may unlock it. While locked, every write to the
-- version's counts, takeoff, prices, CountTooling projects and plan sets by anyone but the holder, a dev or
-- a master is refused in the database, with words that name who to ask. Reads, sends, adopts and copies are
-- untouched. Additive, idempotent; nothing is locked by this migration.
SET lock_timeout = '3s';

ALTER TABLE public.bid_versions
  ADD COLUMN IF NOT EXISTS owner_user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS locked_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz NULL;
COMMENT ON COLUMN public.bid_versions.owner_user_id IS 'The person who made or adopted the version (2026-10-31): the one who may lock it. Defaults to the signed-in user on insert; older versions took the bid''s estimator.';
COMMENT ON COLUMN public.bid_versions.locked_by IS 'Set while only this person edits the version (2026-10-31); NULL = open, the default. A dev or a master may clear it.';

-- Older versions: the bid's estimator owns them, else whoever made the bid.
UPDATE public.bid_versions bv
   SET owner_user_id = COALESCE(b.estimator_id, b.created_by)
  FROM public.bids b
 WHERE b.id = bv.bid_id AND bv.owner_user_id IS NULL;

CREATE OR REPLACE FUNCTION public.bid_version_lock_may_override()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role])
  );
$$;

-- The refusal for a write to a version by someone the lock keeps out, or NULL when the write may go.
-- The service role (auth.uid() IS NULL — the robots' own fenced verbs) is not kept out.
CREATE OR REPLACE FUNCTION public.bid_version_lock_refusal(p_version uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_locked_by uuid;
  v_name text;
  v_holder text;
BEGIN
  IF p_version IS NULL OR auth.uid() IS NULL THEN RETURN NULL; END IF;
  SELECT bv.locked_by, bv.name INTO v_locked_by, v_name FROM public.bid_versions bv WHERE bv.id = p_version;
  IF v_locked_by IS NULL OR v_locked_by = auth.uid() OR public.bid_version_lock_may_override() THEN RETURN NULL; END IF;
  SELECT u.name INTO v_holder FROM public.users u WHERE u.id = v_locked_by;
  RETURN format('%s locked the version "%s". Only they edit it. Ask them, or a master, to unlock it.', COALESCE(NULLIF(v_holder, ''), 'Someone'), COALESCE(v_name, ''));
END;
$$;

-- Rows that carry bid_version_id: counts, takeoff mappings, rough-in lines, pricing facets, CountTooling projects, plan sets.
CREATE OR REPLACE FUNCTION public.bid_version_write_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_version uuid;
  v_msg text;
BEGIN
  v_version := COALESCE((to_jsonb(NEW)->>'bid_version_id')::uuid, (to_jsonb(OLD)->>'bid_version_id')::uuid);
  v_msg := public.bid_version_lock_refusal(v_version);
  IF v_msg IS NOT NULL THEN RAISE EXCEPTION '%', v_msg; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- Rows that hang off a pricing facet (price_book_versions): its entries, the custom prices, the assignments.
CREATE OR REPLACE FUNCTION public.price_book_version_write_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pbv uuid;
  v_version uuid;
  v_msg text;
BEGIN
  v_pbv := COALESCE(
    (to_jsonb(NEW)->>'price_book_version_id')::uuid, (to_jsonb(OLD)->>'price_book_version_id')::uuid,
    (to_jsonb(NEW)->>'version_id')::uuid, (to_jsonb(OLD)->>'version_id')::uuid);
  IF v_pbv IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT p.bid_version_id INTO v_version FROM public.price_book_versions p WHERE p.id = v_pbv;
  v_msg := public.bid_version_lock_refusal(v_version);
  IF v_msg IS NOT NULL THEN RAISE EXCEPTION '%', v_msg; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- The version row itself: the owner default, and who may turn the lock, rename or retune a locked version.
CREATE OR REPLACE FUNCTION public.bid_versions_set_owner()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.owner_user_id IS NULL THEN NEW.owner_user_id := auth.uid(); END IF;
  IF NEW.locked_by IS NOT NULL AND NEW.locked_at IS NULL THEN NEW.locked_at := now(); END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.bid_versions_lock_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_may boolean;
  v_who text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  v_may := public.bid_version_lock_may_override() OR auth.uid() = OLD.owner_user_id OR auth.uid() = OLD.locked_by;
  IF NEW.locked_by IS DISTINCT FROM OLD.locked_by THEN
    IF NOT v_may THEN
      RAISE EXCEPTION 'Only the version''s owner, a dev or a master may lock or unlock it.';
    END IF;
    IF NEW.locked_by IS NOT NULL AND NEW.locked_by <> auth.uid() AND NOT public.bid_version_lock_may_override() THEN
      RAISE EXCEPTION 'A lock is your own: it may only name you.';
    END IF;
    NEW.locked_at := CASE WHEN NEW.locked_by IS NULL THEN NULL ELSE COALESCE(NEW.locked_at, now()) END;
    SELECT u.name INTO v_who FROM public.users u WHERE u.id = auth.uid();
    INSERT INTO public.bids_submission_entries (bid_id, notes, created_by)
    VALUES (NEW.bid_id,
            format('%s %s the version "%s"%s', COALESCE(NULLIF(v_who, ''), 'Someone'), CASE WHEN NEW.locked_by IS NULL THEN 'unlocked' ELSE 'locked' END, NEW.name,
                   CASE WHEN NEW.locked_by IS NULL AND OLD.locked_by <> auth.uid() THEN ' that someone else held' ELSE '' END),
            auth.uid());
    RETURN NEW;
  END IF;
  -- A version locked by someone else: its own row (name, letter, star, owner) is theirs too.
  IF OLD.locked_by IS NOT NULL AND OLD.locked_by <> auth.uid() AND NOT public.bid_version_lock_may_override() THEN
    RAISE EXCEPTION '%', public.bid_version_lock_refusal(OLD.id);
  END IF;
  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id AND NOT v_may THEN
    RAISE EXCEPTION 'Only the version''s owner, a dev or a master may hand it to someone else.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bid_versions_set_owner ON public.bid_versions;
CREATE TRIGGER bid_versions_set_owner BEFORE INSERT ON public.bid_versions
  FOR EACH ROW EXECUTE FUNCTION public.bid_versions_set_owner();
DROP TRIGGER IF EXISTS bid_versions_lock_guard ON public.bid_versions;
CREATE TRIGGER bid_versions_lock_guard BEFORE UPDATE ON public.bid_versions
  FOR EACH ROW EXECUTE FUNCTION public.bid_versions_lock_guard();

DROP TRIGGER IF EXISTS bid_version_lock_guard ON public.bids_count_rows;
CREATE TRIGGER bid_version_lock_guard BEFORE INSERT OR UPDATE OR DELETE ON public.bids_count_rows
  FOR EACH ROW EXECUTE FUNCTION public.bid_version_write_guard();
DROP TRIGGER IF EXISTS bid_version_lock_guard ON public.bids_takeoff_template_mappings;
CREATE TRIGGER bid_version_lock_guard BEFORE INSERT OR UPDATE OR DELETE ON public.bids_takeoff_template_mappings
  FOR EACH ROW EXECUTE FUNCTION public.bid_version_write_guard();
DROP TRIGGER IF EXISTS bid_version_lock_guard ON public.bids_takeoff_rough_part_lines;
CREATE TRIGGER bid_version_lock_guard BEFORE INSERT OR UPDATE OR DELETE ON public.bids_takeoff_rough_part_lines
  FOR EACH ROW EXECUTE FUNCTION public.bid_version_write_guard();
DROP TRIGGER IF EXISTS bid_version_lock_guard ON public.price_book_versions;
CREATE TRIGGER bid_version_lock_guard BEFORE INSERT OR UPDATE OR DELETE ON public.price_book_versions
  FOR EACH ROW EXECUTE FUNCTION public.bid_version_write_guard();
DROP TRIGGER IF EXISTS bid_version_lock_guard ON public.bid_count_sources;
CREATE TRIGGER bid_version_lock_guard BEFORE INSERT OR UPDATE OR DELETE ON public.bid_count_sources
  FOR EACH ROW EXECUTE FUNCTION public.bid_version_write_guard();
DROP TRIGGER IF EXISTS bid_version_lock_guard ON public.bid_plan_sets;
CREATE TRIGGER bid_version_lock_guard BEFORE INSERT OR UPDATE OR DELETE ON public.bid_plan_sets
  FOR EACH ROW EXECUTE FUNCTION public.bid_version_write_guard();

DROP TRIGGER IF EXISTS bid_version_lock_guard ON public.price_book_entries;
CREATE TRIGGER bid_version_lock_guard BEFORE INSERT OR UPDATE OR DELETE ON public.price_book_entries
  FOR EACH ROW EXECUTE FUNCTION public.price_book_version_write_guard();
DROP TRIGGER IF EXISTS bid_version_lock_guard ON public.bid_count_row_custom_prices;
CREATE TRIGGER bid_version_lock_guard BEFORE INSERT OR UPDATE OR DELETE ON public.bid_count_row_custom_prices
  FOR EACH ROW EXECUTE FUNCTION public.price_book_version_write_guard();
DROP TRIGGER IF EXISTS bid_version_lock_guard ON public.bid_pricing_assignments;
CREATE TRIGGER bid_version_lock_guard BEFORE INSERT OR UPDATE OR DELETE ON public.bid_pricing_assignments
  FOR EACH ROW EXECUTE FUNCTION public.price_book_version_write_guard();
