SET lock_timeout = '3s';

-- Training (punch list #111; the owner, 2026-10-15: courses the crew takes at their own pace, each with a clock, red
-- when not done, amber when lapsed, green when caught up, "managed by a dev in settings"). The lessons live in the
-- app's bundle like help guides (src/content/training/<course>/); the database keeps the POLICY and the RECORD:
--
--   * training_courses       one row per course the app ships: on or off, who must take it (user roles), how long a
--                            pass is good for, the amber window, and the retake stamp (Everyone takes it again…).
--                            Seeded for osha-30-refresher switched OFF, so nothing shows until a dev turns it on.
--   * training_lesson_passes one row per lesson a person has passed (every check right), so the course resumes.
--   * training_passes        one row per pass of a course's final check: the day, the score and the content version
--                            the words had (a changed word never voids a pass; only retake_from does).
--
-- Where a person stands is READ, never stored: training_state_for() is the SQL twin of src/lib/training/trainingState.ts
-- (red: on, required, no pass that counts; amber: the newest pass's day plus good_for_months is within due_soon_days or
-- past; green: inside the window). The two write doors are SECURITY INVOKER so RLS, the read-only training-mode fence and
-- the twin fence all apply to the caller's own row. The office team (dev, master, assistant, controller) reads everyone's
-- standing for the People rail and Settings; everyone else reads their own.

-- ---------- who may read everyone's ----------

CREATE OR REPLACE FUNCTION public.training_office()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant', 'controller')
  );
$$;

COMMENT ON FUNCTION public.training_office() IS
  'Training (v2.5565): the office team that reads everyone''s standing on a course, for the People rail and Settings → Training: dev, master, assistant, controller.';

REVOKE EXECUTE ON FUNCTION public.training_office() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.training_office() TO authenticated, service_role;

-- ---------- the policy ----------

CREATE TABLE IF NOT EXISTS public.training_courses (
  -- The content folder's name: src/content/training/<slug>/.
  slug text PRIMARY KEY
    CONSTRAINT training_courses_slug_shape CHECK (slug ~ '^[a-z0-9-]+$' AND length(slug) <= 80),
  title text NOT NULL
    CONSTRAINT training_courses_title_length CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  -- Off until a dev turns it on; an off course shows nowhere and counts for nobody.
  enabled boolean NOT NULL DEFAULT false,
  -- The user roles that must take it (users.role words). Empty: on, but required of nobody.
  required_roles text[] NOT NULL DEFAULT '{}'
    CONSTRAINT training_courses_roles_known CHECK (
      required_roles <@ ARRAY['dev', 'master_technician', 'assistant', 'subcontractor', 'helpers', 'estimator', 'primary', 'superintendent', 'controller']::text[]
    ),
  -- How long a pass is good for. 0 means every pass is already due, which turns everyone amber at once.
  good_for_months integer NOT NULL DEFAULT 12
    CONSTRAINT training_courses_months_range CHECK (good_for_months BETWEEN 0 AND 120),
  -- Amber from this many days before the day it is due.
  due_soon_days integer NOT NULL DEFAULT 30
    CONSTRAINT training_courses_due_soon_range CHECK (due_soon_days BETWEEN 0 AND 365),
  -- Everyone takes it again…: a pass before this day does not count. Null until pressed.
  retake_from date,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.training_courses IS
  'Training (v2.5565, punch list #111): the policy for each course the app ships (the lessons are in the bundle under src/content/training/<slug>/). A dev sets it in Settings → Training: on or off, who must take it, how long a pass is good for, the amber window, the retake stamp.';
COMMENT ON COLUMN public.training_courses.retake_from IS 'Everyone takes it again…: a pass dated before this day no longer counts, so everyone who must take the course turns red until they pass again.';

DROP TRIGGER IF EXISTS training_courses_updated_at_trg ON public.training_courses;
CREATE TRIGGER training_courses_updated_at_trg BEFORE UPDATE ON public.training_courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.training_courses ENABLE ROW LEVEL SECURITY;
-- Everyone signed in reads the catalog (the Dashboard card needs it); only a dev writes it.
DROP POLICY IF EXISTS training_courses_select ON public.training_courses;
CREATE POLICY training_courses_select ON public.training_courses
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS training_courses_insert ON public.training_courses;
CREATE POLICY training_courses_insert ON public.training_courses
  FOR INSERT TO authenticated WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS training_courses_update ON public.training_courses;
CREATE POLICY training_courses_update ON public.training_courses
  FOR UPDATE TO authenticated USING (public.is_dev()) WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS training_courses_delete ON public.training_courses;
CREATE POLICY training_courses_delete ON public.training_courses
  FOR DELETE TO authenticated USING (public.is_dev());

REVOKE ALL ON TABLE public.training_courses FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.training_courses TO authenticated;
GRANT ALL ON TABLE public.training_courses TO service_role;

-- The first course, switched off until a dev turns it on in Settings → Training.
INSERT INTO public.training_courses (slug, title, enabled, required_roles)
VALUES ('osha-30-refresher', 'OSHA 30 refresher', false, ARRAY['helpers', 'subcontractor', 'primary', 'master_technician', 'superintendent'])
ON CONFLICT (slug) DO NOTHING;

-- ---------- the record ----------

CREATE TABLE IF NOT EXISTS public.training_lesson_passes (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_slug text NOT NULL REFERENCES public.training_courses(slug) ON DELETE CASCADE,
  -- The lesson file's name without .md: 19-trenches-soil-and-protection.
  lesson_key text NOT NULL
    CONSTRAINT training_lesson_passes_key_shape CHECK (lesson_key ~ '^[0-9]{2}-[a-z0-9-]+$'),
  passed_at timestamptz NOT NULL DEFAULT now(),
  -- How many times the four checks were tried before all four were right.
  tries integer NOT NULL DEFAULT 1
    CONSTRAINT training_lesson_passes_tries_positive CHECK (tries >= 1),
  PRIMARY KEY (user_id, course_slug, lesson_key)
);

COMMENT ON TABLE public.training_lesson_passes IS
  'Training (v2.5565): one row per lesson a person has passed, every check right, so the course page resumes with its ticks. Written by training_pass_lesson only.';

ALTER TABLE public.training_lesson_passes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS training_lesson_passes_select ON public.training_lesson_passes;
CREATE POLICY training_lesson_passes_select ON public.training_lesson_passes
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.training_office());
DROP POLICY IF EXISTS training_lesson_passes_insert ON public.training_lesson_passes;
CREATE POLICY training_lesson_passes_insert ON public.training_lesson_passes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS training_lesson_passes_update ON public.training_lesson_passes;
CREATE POLICY training_lesson_passes_update ON public.training_lesson_passes
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.training_lesson_passes FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.training_lesson_passes TO authenticated;
GRANT ALL ON TABLE public.training_lesson_passes TO service_role;

CREATE TABLE IF NOT EXISTS public.training_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_slug text NOT NULL REFERENCES public.training_courses(slug) ON DELETE CASCADE,
  -- The hash of the course's words the pass was taken on (courseContent.contentVersion).
  content_version text NOT NULL
    CONSTRAINT training_passes_version_shape CHECK (content_version ~ '^[0-9a-f]{8}$'),
  -- The app's calendar day; the clock runs from it.
  passed_on date NOT NULL DEFAULT public.app_today(),
  passed_at timestamptz NOT NULL DEFAULT now(),
  score integer NOT NULL
    CONSTRAINT training_passes_score_range CHECK (score >= 0),
  total integer NOT NULL
    CONSTRAINT training_passes_total_positive CHECK (total >= 1 AND score <= total),
  -- The final check's picks, question id → the option picked, for the record.
  answers jsonb NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.training_passes IS
  'Training (v2.5565): one row per pass of a course''s final check: who, which course, the content version, the day, the score. The newest that is on or after training_courses.retake_from decides the person''s colour. Written by training_finish_course only; never updated.';

CREATE INDEX IF NOT EXISTS training_passes_user_course_day ON public.training_passes (user_id, course_slug, passed_on DESC);

ALTER TABLE public.training_passes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS training_passes_select ON public.training_passes;
CREATE POLICY training_passes_select ON public.training_passes
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.training_office());
DROP POLICY IF EXISTS training_passes_insert ON public.training_passes;
CREATE POLICY training_passes_insert ON public.training_passes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.training_passes FROM anon;
GRANT SELECT, INSERT ON TABLE public.training_passes TO authenticated;
GRANT ALL ON TABLE public.training_passes TO service_role;

-- ---------- the two write doors (SECURITY INVOKER: the caller's own row, under RLS and the fences) ----------

CREATE OR REPLACE FUNCTION public.training_pass_lesson(p_course_slug text, p_lesson_key text, p_tries integer DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to pass a lesson.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.training_courses c WHERE c.slug = p_course_slug) THEN
    RAISE EXCEPTION 'No course is named %.', p_course_slug USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.training_lesson_passes (user_id, course_slug, lesson_key, passed_at, tries)
  VALUES (auth.uid(), p_course_slug, p_lesson_key, now(), GREATEST(1, COALESCE(p_tries, 1)))
  ON CONFLICT (user_id, course_slug, lesson_key)
  DO UPDATE SET passed_at = now(), tries = EXCLUDED.tries;
END;
$$;

COMMENT ON FUNCTION public.training_pass_lesson(text, text, integer) IS
  'Training (v2.5565): the signed-in person passed a lesson, every check right, after p_tries tries. Upserts their own training_lesson_passes row. SECURITY INVOKER: RLS, the read-only fence and the twin fence apply.';

REVOKE EXECUTE ON FUNCTION public.training_pass_lesson(text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.training_pass_lesson(text, text, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.training_finish_course(
  p_course_slug text,
  p_content_version text,
  p_score integer,
  p_total integer,
  p_pass integer,
  p_answers jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to finish a course.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.training_courses c WHERE c.slug = p_course_slug) THEN
    RAISE EXCEPTION 'No course is named %.', p_course_slug USING ERRCODE = 'P0001';
  END IF;
  IF p_score IS NULL OR p_total IS NULL OR p_pass IS NULL OR p_total < 1 OR p_score < 0 OR p_score > p_total THEN
    RAISE EXCEPTION 'A score is right out of total.' USING ERRCODE = 'P0001';
  END IF;
  IF p_score < p_pass THEN
    RAISE EXCEPTION 'Not a pass: % of % right, % pass.', p_score, p_total, p_pass USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.training_passes (user_id, course_slug, content_version, score, total, answers)
  VALUES (auth.uid(), p_course_slug, p_content_version, p_score, p_total, COALESCE(p_answers, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.training_finish_course(text, text, integer, integer, integer, jsonb) IS
  'Training (v2.5565): the signed-in person passed a course''s final check (p_score of p_total, p_pass right passes). Writes their own training_passes row dated app_today() and returns its id; refuses a score under the bar. SECURITY INVOKER.';

REVOKE EXECUTE ON FUNCTION public.training_finish_course(text, text, integer, integer, integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.training_finish_course(text, text, integer, integer, integer, jsonb) TO authenticated, service_role;

-- ---------- where a person stands: the SQL twin of trainingState.ts ----------

CREATE OR REPLACE FUNCTION public.training_state_for(p_user uuid)
RETURNS TABLE (
  course_slug text,
  title text,
  colour text,
  passed_on date,
  due_on date,
  days_to_due integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT u.id, u.role FROM public.users u WHERE u.id = p_user
  ),
  required AS (
    SELECT c.slug, c.title, c.good_for_months, c.due_soon_days, c.retake_from
    FROM public.training_courses c, me
    WHERE c.enabled AND me.role::text = ANY (c.required_roles)
  ),
  newest AS (
    SELECT r.slug, max(p.passed_on) AS passed_on
    FROM required r
    LEFT JOIN public.training_passes p
      ON p.course_slug = r.slug AND p.user_id = p_user
     AND (r.retake_from IS NULL OR p.passed_on >= r.retake_from)
    GROUP BY r.slug
  ),
  standing AS (
    SELECT r.slug, r.title, n.passed_on,
           CASE WHEN n.passed_on IS NULL THEN NULL
                ELSE (n.passed_on + make_interval(months => r.good_for_months))::date END AS due_on,
           r.due_soon_days
    FROM required r JOIN newest n ON n.slug = r.slug
  )
  SELECT s.slug, s.title,
         CASE WHEN s.passed_on IS NULL THEN 'red'
              WHEN (s.due_on - public.app_today()) <= s.due_soon_days THEN 'amber'
              ELSE 'green' END AS colour,
         s.passed_on, s.due_on,
         CASE WHEN s.due_on IS NULL THEN NULL ELSE (s.due_on - public.app_today()) END AS days_to_due
  FROM standing s
  WHERE p_user = auth.uid() OR public.training_office()
  ORDER BY CASE WHEN s.passed_on IS NULL THEN 0 WHEN (s.due_on - public.app_today()) <= s.due_soon_days THEN 1 ELSE 2 END,
           s.due_on NULLS FIRST, s.title;
$$;

COMMENT ON FUNCTION public.training_state_for(uuid) IS
  'Training (v2.5565): where one person stands on every course their role must take, the SQL twin of src/lib/training/trainingState.ts: red with no pass that counts, amber from due_soon_days before the day a pass runs out and after, green inside the window. Own rows for anyone; everyone''s for the office team (training_office). Empty when the course is off or not required for the role.';

REVOKE EXECUTE ON FUNCTION public.training_state_for(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.training_state_for(uuid) TO authenticated, service_role;

-- Everyone who must take one course, with their colour: the People rail, the Users row and Settings' counts read it.
CREATE OR REPLACE FUNCTION public.training_standings(p_course_slug text)
RETURNS TABLE (
  user_id uuid,
  name text,
  role text,
  colour text,
  passed_on date,
  due_on date,
  days_to_due integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.name, u.role::text, s.colour, s.passed_on, s.due_on, s.days_to_due
  FROM public.users u
  JOIN public.training_courses c ON c.slug = p_course_slug AND c.enabled AND u.role::text = ANY (c.required_roles)
  CROSS JOIN LATERAL public.training_state_for(u.id) s
  WHERE public.training_office()
    AND u.archived_at IS NULL
    AND COALESCE(u.is_sample, false) = false
    AND COALESCE(u.is_digital_twin, false) = false
    AND s.course_slug = p_course_slug
  ORDER BY CASE s.colour WHEN 'red' THEN 0 WHEN 'amber' THEN 1 ELSE 2 END, s.due_on NULLS FIRST, u.name;
$$;

COMMENT ON FUNCTION public.training_standings(text) IS
  'Training (v2.5565): everyone on the team who must take this course, worst first, with the colour training_state_for gives each. Office team only (training_office); samples, twins and archived accounts left out.';

REVOKE EXECUTE ON FUNCTION public.training_standings(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.training_standings(text) TO authenticated, service_role;

-- House rules: read-only training mode and the twin write fence cover the new tables.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
