SET lock_timeout = '3s';

-- Contracts & terms, PR 5 (to-dos/contracts-and-terms): the wording customers agree to gets a
-- history. Five of the texts on Settings → Contracts & terms live in app_settings, which has no
-- date column, and the Contract Book overwrites a document's wording in place — so "when did this
-- last change, and what did it say before" had no answer, and neither did "which terms were in
-- force the day this customer accepted". Two tables:
--
--   contract_text_versions — one row per change to a customer-facing contract text, written by
--     triggers so every write path is covered (Settings, the Book, the standard-terms editor, a
--     future one). Append-only: no client writes.
--   contract_text_reviews  — the office's "I read this and it still stands", per catalog entry,
--     which is what makes "due for review" sayable for wording that never changes.
--
-- Additive. Nothing reads these until the client that follows.

-- ---------------------------------------------------------------------------
-- 1) The history
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.contract_text_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_kind text NOT NULL CHECK (source_kind IN ('app_setting', 'contract_book')),
  -- app_settings.key, or contract_template_documents.id as text.
  source_key text NOT NULL,
  -- The Book document's name at the time; null for a Settings text.
  name text,
  body text NOT NULL DEFAULT '',
  body_format text NOT NULL DEFAULT 'plain',
  -- The Book's version date at the time; null for a Settings text.
  version_date date,
  -- baseline: what it said when the history began. changed: a save that changed it. removed: the row was deleted.
  change_kind text NOT NULL CHECK (change_kind IN ('baseline', 'changed', 'removed')),
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.contract_text_versions IS
  'History of the contract wording customers agree to (Settings → Contracts & terms): one row per change to a customer-facing app_settings text or a customer Contract Book document, written by triggers. Append-only; the office reads it.';

CREATE INDEX IF NOT EXISTS contract_text_versions_source_idx
  ON public.contract_text_versions (source_kind, source_key, changed_at DESC);

ALTER TABLE public.contract_text_versions ENABLE ROW LEVEL SECURITY;

-- The people who see Settings → Contracts & terms: dev, master, assistant-like.
DROP POLICY IF EXISTS contract_text_versions_select_office ON public.contract_text_versions;
CREATE POLICY contract_text_versions_select_office
  ON public.contract_text_versions FOR SELECT TO authenticated
  USING (public.is_dev() OR public.is_master_or_dev() OR public.is_assistant());
-- No INSERT / UPDATE / DELETE policy on purpose: the triggers below write it.

-- The app_settings keys that hold customer-facing contract wording. One list, in one place:
-- src/lib/contracts/contractTextHistory.test.ts fails CI when the catalog names a key that is not here.
CREATE OR REPLACE FUNCTION public.contract_text_setting_keys()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ARRAY[
    'estimate_public_terms_body',
    'estimate_accept_checkbox_label',
    'bid_cover_letter_terms_default_v1',
    'bid_cover_letter_exclusions_default_v1',
    'bid_cover_letter_closing_v1'
  ]::text[]
$$;

COMMENT ON FUNCTION public.contract_text_setting_keys() IS
  'The app_settings keys whose value_text is contract wording a customer agrees to; changes to them are recorded in contract_text_versions.';

CREATE OR REPLACE FUNCTION public.record_contract_setting_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
BEGIN
  -- A history row must never be the reason a Settings save fails.
  BEGIN
    SELECT u.id INTO v_actor FROM public.users u WHERE u.id = auth.uid();
    IF TG_OP = 'DELETE' THEN
      INSERT INTO public.contract_text_versions (source_kind, source_key, body, change_kind, changed_by)
      VALUES ('app_setting', OLD.key, '', 'removed', v_actor);
    ELSIF TG_OP = 'INSERT' THEN
      IF btrim(COALESCE(NEW.value_text, '')) <> '' THEN
        INSERT INTO public.contract_text_versions (source_kind, source_key, body, change_kind, changed_by)
        VALUES ('app_setting', NEW.key, NEW.value_text, 'changed', v_actor);
      END IF;
    ELSIF COALESCE(NEW.value_text, '') IS DISTINCT FROM COALESCE(OLD.value_text, '') THEN
      INSERT INTO public.contract_text_versions (source_kind, source_key, body, change_kind, changed_by)
      VALUES ('app_setting', NEW.key, COALESCE(NEW.value_text, ''), 'changed', v_actor);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'record_contract_setting_version: % (%)', SQLERRM, SQLSTATE;
  END;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- WHEN keeps the function off every other Settings write: it runs for the five keys only.
DROP TRIGGER IF EXISTS contract_setting_version_on_write ON public.app_settings;
CREATE TRIGGER contract_setting_version_on_write
  AFTER INSERT OR UPDATE OF value_text ON public.app_settings
  FOR EACH ROW
  WHEN (NEW.key = ANY (public.contract_text_setting_keys()))
  EXECUTE FUNCTION public.record_contract_setting_version();

DROP TRIGGER IF EXISTS contract_setting_version_on_delete ON public.app_settings;
CREATE TRIGGER contract_setting_version_on_delete
  AFTER DELETE ON public.app_settings
  FOR EACH ROW
  WHEN (OLD.key = ANY (public.contract_text_setting_keys()))
  EXECUTE FUNCTION public.record_contract_setting_version();

CREATE OR REPLACE FUNCTION public.record_contract_book_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
BEGIN
  -- A history row must never be the reason a Book save fails.
  BEGIN
    SELECT u.id INTO v_actor FROM public.users u WHERE u.id = auth.uid();
    IF TG_OP = 'DELETE' THEN
      INSERT INTO public.contract_text_versions (source_kind, source_key, name, body, body_format, version_date, change_kind, changed_by)
      VALUES ('contract_book', OLD.id::text, OLD.document_name, '', COALESCE(OLD.book_body_format, 'plain'), OLD.book_version_date, 'removed', v_actor);
    ELSIF TG_OP = 'INSERT'
      OR OLD.audience IS DISTINCT FROM NEW.audience
      OR COALESCE(NEW.book_body_html, '') IS DISTINCT FROM COALESCE(OLD.book_body_html, '')
      OR COALESCE(NEW.book_body_format, 'plain') IS DISTINCT FROM COALESCE(OLD.book_body_format, 'plain')
      OR NEW.document_name IS DISTINCT FROM OLD.document_name
      OR NEW.book_version_date IS DISTINCT FROM OLD.book_version_date
    THEN
      INSERT INTO public.contract_text_versions (source_kind, source_key, name, body, body_format, version_date, change_kind, changed_by)
      VALUES ('contract_book', NEW.id::text, NEW.document_name, COALESCE(NEW.book_body_html, ''), COALESCE(NEW.book_body_format, 'plain'), NEW.book_version_date, 'changed', v_actor);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'record_contract_book_version: % (%)', SQLERRM, SQLSTATE;
  END;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Customer documents only: staff packets and the subs' General Conditions are not on the tab.
DROP TRIGGER IF EXISTS contract_book_version_on_write ON public.contract_template_documents;
CREATE TRIGGER contract_book_version_on_write
  AFTER INSERT OR UPDATE OF book_body_html, book_body_format, document_name, book_version_date, audience ON public.contract_template_documents
  FOR EACH ROW
  WHEN (NEW.audience = 'customer')
  EXECUTE FUNCTION public.record_contract_book_version();

DROP TRIGGER IF EXISTS contract_book_version_on_delete ON public.contract_template_documents;
CREATE TRIGGER contract_book_version_on_delete
  AFTER DELETE ON public.contract_template_documents
  FOR EACH ROW
  WHEN (OLD.audience = 'customer')
  EXECUTE FUNCTION public.record_contract_book_version();

-- What each text says today, so the history has a first row to compare the next change with.
-- Idempotent: a source that already has a row is left alone.
INSERT INTO public.contract_text_versions (source_kind, source_key, body, change_kind)
SELECT 'app_setting', s.key, s.value_text, 'baseline'
FROM public.app_settings s
WHERE s.key = ANY (public.contract_text_setting_keys())
  AND btrim(COALESCE(s.value_text, '')) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.contract_text_versions v WHERE v.source_kind = 'app_setting' AND v.source_key = s.key
  );

INSERT INTO public.contract_text_versions (source_kind, source_key, name, body, body_format, version_date, change_kind, changed_at)
SELECT 'contract_book', d.id::text, d.document_name, COALESCE(d.book_body_html, ''), COALESCE(d.book_body_format, 'plain'), d.book_version_date, 'baseline', COALESCE(d.updated_at, now())
FROM public.contract_template_documents d
WHERE d.audience = 'customer'
  AND NOT EXISTS (
    SELECT 1 FROM public.contract_text_versions v WHERE v.source_kind = 'contract_book' AND v.source_key = d.id::text
  );

-- ---------------------------------------------------------------------------
-- 2) Reviews
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.contract_text_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The catalog entry's id (src/lib/contracts/customerContractCatalog.ts).
  entry_id text NOT NULL CHECK (entry_id ~ '^[a-z][a-z0-9-]{0,79}$'),
  -- The company-calendar day the office read it.
  reviewed_on date NOT NULL,
  note text CHECK (note IS NULL OR length(note) <= 2000),
  reviewed_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.contract_text_reviews IS
  'The office''s reviews of customer-facing contract wording (Settings → Contracts & terms → Mark reviewed): who read which catalog entry, and when. The newest row per entry, with the newest change, decides when the next review is due.';

CREATE INDEX IF NOT EXISTS contract_text_reviews_entry_idx
  ON public.contract_text_reviews (entry_id, reviewed_on DESC);

ALTER TABLE public.contract_text_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contract_text_reviews_select_office ON public.contract_text_reviews;
CREATE POLICY contract_text_reviews_select_office
  ON public.contract_text_reviews FOR SELECT TO authenticated
  USING (public.is_dev() OR public.is_master_or_dev() OR public.is_assistant());

DROP POLICY IF EXISTS contract_text_reviews_insert_office ON public.contract_text_reviews;
CREATE POLICY contract_text_reviews_insert_office
  ON public.contract_text_reviews FOR INSERT TO authenticated
  WITH CHECK (
    reviewed_by = auth.uid()
    AND (public.is_dev() OR public.is_master_or_dev() OR public.is_assistant())
  );

-- A review marked by mistake: the person who marked it, or a dev, takes it back.
DROP POLICY IF EXISTS contract_text_reviews_delete_own_or_dev ON public.contract_text_reviews;
CREATE POLICY contract_text_reviews_delete_own_or_dev
  ON public.contract_text_reviews FOR DELETE TO authenticated
  USING (public.is_dev() OR reviewed_by = auth.uid());

-- House rules: read-only training mode + the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
