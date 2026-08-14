SET lock_timeout = '3s';

-- v2.1659: precomputed per-job thread-note stats (chronic statement-timeout fix).
--
-- jobs_ledger_thread_note_stats(p_job_ids) was the #1 chronic timeout offender
-- (26% of all statement timeouts Aug 10-14, the only query timing out on quiet
-- days): it ranked EVERY note of up to 200 jobs per call with a window function
-- + stamp regex, under per-NOTE RLS that chases jobs_ledger -> adoptions/shares/
-- team members for each row. This migration precomputes the notes side into a
-- one-row-per-job cache maintained by trigger, so the RPC does one indexed read
-- + one job-level RLS check per job instead. Reports side is unchanged.
-- The RPC signature and result shape are identical - no client change.

-- 1) Cache table: one row per job that has at least one thread note.
CREATE TABLE IF NOT EXISTS "public"."jobs_ledger_thread_note_stats_cache" (
    "job_id" "uuid" NOT NULL,
    "note_count" bigint NOT NULL,
    "last_note_at" timestamp with time zone NOT NULL,
    "last_note_body" "text" NOT NULL,
    "last_note_author_user_id" "uuid",
    CONSTRAINT "jobs_ledger_thread_note_stats_cache_pkey" PRIMARY KEY ("job_id"),
    CONSTRAINT "jobs_ledger_thread_note_stats_cache_job_id_fkey"
      FOREIGN KEY ("job_id") REFERENCES "public"."jobs_ledger"("id") ON DELETE CASCADE
);

COMMENT ON TABLE "public"."jobs_ledger_thread_note_stats_cache" IS
  'Trigger-maintained per-job rollup of jobs_ledger_thread_notes (count + newest substantive note, stamps deprioritized). Written only by recompute_jobs_ledger_thread_note_stats(); read by jobs_ledger_thread_note_stats().';

ALTER TABLE "public"."jobs_ledger_thread_note_stats_cache" ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE "public"."jobs_ledger_thread_note_stats_cache" TO "anon";
GRANT SELECT ON TABLE "public"."jobs_ledger_thread_note_stats_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."jobs_ledger_thread_note_stats_cache" TO "service_role";

-- SELECT visibility mirrors jobs_ledger_thread_notes_select, evaluated once per
-- job row instead of once per note row. No INSERT/UPDATE/DELETE policies: only
-- the SECURITY DEFINER recompute function (owner) writes.
DROP POLICY IF EXISTS "jobs_ledger_thread_note_stats_cache_select"
  ON "public"."jobs_ledger_thread_note_stats_cache";
CREATE POLICY "jobs_ledger_thread_note_stats_cache_select"
  ON "public"."jobs_ledger_thread_note_stats_cache" FOR SELECT
  USING (((EXISTS ( SELECT 1
   FROM "public"."jobs_ledger" "j"
  WHERE (("j"."id" = "jobs_ledger_thread_note_stats_cache"."job_id") AND (("j"."master_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_dev"() OR (EXISTS ( SELECT 1
           FROM "public"."users"
          WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = 'primary'::"public"."user_role")))) OR (EXISTS ( SELECT 1
           FROM "public"."master_assistants"
          WHERE (("master_assistants"."master_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("master_assistants"."assistant_id" = "j"."master_user_id")))) OR (EXISTS ( SELECT 1
           FROM "public"."master_assistants"
          WHERE (("master_assistants"."master_id" = "j"."master_user_id") AND ("master_assistants"."assistant_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "public"."assistants_share_master"(( SELECT "auth"."uid"() AS "uid"), "j"."master_user_id") OR (EXISTS ( SELECT 1
           FROM "public"."jobs_ledger_team_members"
          WHERE (("jobs_ledger_team_members"."job_id" = "j"."id") AND ("jobs_ledger_team_members"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))))) OR ("public"."auth_uid_is_helpers_or_subcontractor"() AND ((EXISTS ( SELECT 1
   FROM "public"."jobs_ledger_team_members" "jtm"
  WHERE (("jtm"."job_id" = "jobs_ledger_thread_note_stats_cache"."job_id") AND ("jtm"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR (EXISTS ( SELECT 1
   FROM "public"."job_schedule_blocks" "jsb"
  WHERE (("jsb"."job_id" = "jobs_ledger_thread_note_stats_cache"."job_id") AND ("jsb"."assignee_user_id" = ( SELECT "auth"."uid"() AS "uid")))))))));

-- 2) Single-job recompute (SECURITY DEFINER: cache writes bypass note-level RLS;
--    callers only ever reach this through the trigger below).
CREATE OR REPLACE FUNCTION "public"."recompute_jobs_ledger_thread_note_stats"("p_job_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_count bigint;
BEGIN
  IF p_job_id IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.jobs_ledger_thread_notes
  WHERE job_id = p_job_id;

  IF v_count = 0 THEN
    DELETE FROM public.jobs_ledger_thread_note_stats_cache WHERE job_id = p_job_id;
    RETURN;
  END IF;

  -- Newest substantive note wins; newest clock stamp only when the thread
  -- holds nothing else (same ordering as the previous window-function RPC).
  INSERT INTO public.jobs_ledger_thread_note_stats_cache
    (job_id, note_count, last_note_at, last_note_body, last_note_author_user_id)
  SELECT p_job_id, v_count, n.created_at, left(n.body, 400), n.author_user_id
  FROM public.jobs_ledger_thread_notes n
  WHERE n.job_id = p_job_id
  ORDER BY (n.body ~ '— (Arrived at job|Leaving job)$') ASC, n.created_at DESC
  LIMIT 1
  ON CONFLICT (job_id) DO UPDATE SET
    note_count = EXCLUDED.note_count,
    last_note_at = EXCLUDED.last_note_at,
    last_note_body = EXCLUDED.last_note_body,
    last_note_author_user_id = EXCLUDED.last_note_author_user_id;
END;
$_$;

REVOKE ALL ON FUNCTION "public"."recompute_jobs_ledger_thread_note_stats"("uuid") FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."recompute_jobs_ledger_thread_note_stats"("uuid") FROM "anon";
REVOKE ALL ON FUNCTION "public"."recompute_jobs_ledger_thread_note_stats"("uuid") FROM "authenticated";
GRANT ALL ON FUNCTION "public"."recompute_jobs_ledger_thread_note_stats"("uuid") TO "service_role";

-- 3) Keep the cache in sync on every note write.
CREATE OR REPLACE FUNCTION "public"."jobs_ledger_thread_notes_stats_sync"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_jobs_ledger_thread_note_stats(OLD.job_id);
  ELSE
    PERFORM public.recompute_jobs_ledger_thread_note_stats(NEW.job_id);
    IF TG_OP = 'UPDATE' AND NEW.job_id IS DISTINCT FROM OLD.job_id THEN
      PERFORM public.recompute_jobs_ledger_thread_note_stats(OLD.job_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS "trg_jobs_ledger_thread_notes_stats_sync" ON "public"."jobs_ledger_thread_notes";
CREATE TRIGGER "trg_jobs_ledger_thread_notes_stats_sync"
  AFTER INSERT OR DELETE OR UPDATE ON "public"."jobs_ledger_thread_notes"
  FOR EACH ROW EXECUTE FUNCTION "public"."jobs_ledger_thread_notes_stats_sync"();

-- 4) Backfill (idempotent; window count survives DISTINCT ON).
INSERT INTO "public"."jobs_ledger_thread_note_stats_cache"
  ("job_id", "note_count", "last_note_at", "last_note_body", "last_note_author_user_id")
SELECT DISTINCT ON (n.job_id)
  n.job_id,
  count(*) OVER (PARTITION BY n.job_id),
  n.created_at,
  left(n.body, 400),
  n.author_user_id
FROM "public"."jobs_ledger_thread_notes" n
ORDER BY n.job_id, (n.body ~ '— (Arrived at job|Leaving job)$') ASC, n.created_at DESC
ON CONFLICT ("job_id") DO UPDATE SET
  note_count = EXCLUDED.note_count,
  last_note_at = EXCLUDED.last_note_at,
  last_note_body = EXCLUDED.last_note_body,
  last_note_author_user_id = EXCLUDED.last_note_author_user_id;

-- 5) Same-signature RPC now reads the cache for the notes side (job-level RLS,
--    one indexed row per job). Reports side unchanged from 20260728070000.
CREATE OR REPLACE FUNCTION "public"."jobs_ledger_thread_note_stats"("p_job_ids" "uuid"[]) RETURNS TABLE("job_id" "uuid", "note_count" bigint, "last_note_at" timestamp with time zone, "last_note_body" "text", "last_note_author_name" "text", "report_count" bigint, "last_report_at" timestamp with time zone, "last_report_author_name" "text", "last_report_template_name" "text", "last_report_preview" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $_$
  WITH note_one AS (
    SELECT
      c.job_id,
      c.note_count,
      c.last_note_at,
      c.last_note_body,
      u.name AS last_note_author_name
    FROM public.jobs_ledger_thread_note_stats_cache c
    LEFT JOIN public.users u ON u.id = c.last_note_author_user_id
    WHERE p_job_ids IS NOT NULL
      AND c.job_id = ANY (p_job_ids)
  ),
  rep_counts AS (
    SELECT r.job_ledger_id AS job_id, count(*)::bigint AS cnt
    FROM public.reports r
    WHERE p_job_ids IS NOT NULL
      AND r.job_ledger_id = ANY (p_job_ids)
    GROUP BY r.job_ledger_id
  ),
  rep_latest AS (
    SELECT DISTINCT ON (r.job_ledger_id)
      r.job_ledger_id AS job_id,
      r.created_at AS last_report_at,
      u.name AS last_report_author_name,
      rt.name AS last_report_template_name,
      (
        WITH
        has_new_completion_key AS (
          SELECT EXISTS(
            SELECT 1
            FROM jsonb_each_text(COALESCE(r.field_values, '{}'::jsonb)) AS e(key, val)
            WHERE e.key = 'How complete is the job?'
          ) AS v
        ),
        pairs AS (
          SELECT
            t.key,
            btrim(t.val) AS bval
          FROM jsonb_each_text(COALESCE(r.field_values, '{}'::jsonb)) AS t(key, val)
          WHERE t.val IS NOT NULL
            AND btrim(t.val) <> ''
        )
        SELECT (
          SELECT left(z.d, 200)
          FROM (
            SELECT
              CASE
                WHEN p.key = 'Who was on the job?'
                  AND (SELECT h.v FROM has_new_completion_key h)
                  THEN NULL::text
                WHEN
                  p.key IN ('How complete is the job?', 'Who was on the job?')
                  AND p.bval ~ '^[0-9]{1,3}$'
                  AND (p.bval::int) >= 0
                  AND (p.bval::int) <= 100
                  THEN
                    'I think the job is ' || p.bval::int::text || '% complete'
                ELSE left(p.bval, 200)
              END AS d
            FROM pairs p
          ) z
          WHERE z.d IS NOT NULL
          LIMIT 1
        )
      ) AS last_report_preview
    FROM public.reports r
    JOIN public.users u ON u.id = r.created_by_user_id
    JOIN public.report_templates rt ON rt.id = r.template_id
    WHERE p_job_ids IS NOT NULL
      AND r.job_ledger_id = ANY (p_job_ids)
    ORDER BY r.job_ledger_id, r.created_at DESC
  ),
  eligible AS (
    SELECT n.job_id FROM note_one n
    UNION
    SELECT rc.job_id FROM rep_counts rc
  )
  SELECT
    e.job_id,
    coalesce(n.note_count, 0::bigint) AS note_count,
    n.last_note_at,
    n.last_note_body,
    n.last_note_author_name,
    coalesce(rc.cnt, 0::bigint) AS report_count,
    l.last_report_at,
    l.last_report_author_name,
    l.last_report_template_name,
    l.last_report_preview
  FROM eligible e
  LEFT JOIN note_one n ON n.job_id = e.job_id
  LEFT JOIN rep_counts rc ON rc.job_id = e.job_id
  LEFT JOIN rep_latest l ON l.job_id = e.job_id;
$_$;

-- 6) Read-only training-mode coverage for the new table (required after CREATE TABLE).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
