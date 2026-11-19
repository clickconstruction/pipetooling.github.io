SET lock_timeout = '3s';

-- One rule for the stage a line's name reads as (punch list #397, PR 6).
--
-- WHY. The app reads a job line's stage from its name in one place, stageRank in
-- src/lib/jobs/stageRecognition.ts, and this function is the database's copy of it, used when a stage's
-- checklist is filed as a record (stage_checklist_record_settle). The two had drifted: the copy here kept a
-- leading "Stage 2 -", so such a line read as no stage, and neither knew two things the owner picked on
-- 2026-11-18 after reading the 35 real lines two readers disagreed on:
--   - "Set trim" is the trim stage said the other way round;
--   - a name that also holds the word of a DIFFERENT stage stands for none. "Rough in, top out and trim"
--     is the whole job on one line, not its rough-in.
--
-- WHAT. The same rule as the app, word for word:
--   1. Lower-case, trim, drop a leading "stage 2 -" / "phase 1:" / "3.".
--   2. The START of the name gives the stage: rough, top out or stack out, trim or finish, or "set trim".
--   3. A word of another stage anywhere in the name makes it none. Ground words sit with rough, and final
--      and punch sit with trim, so "Rough in and underground" and "Trim and final" keep their stage.
-- Ground and Final themselves carry no checklist, as before, so they read NULL.
--
-- One table of names holds this function and the app's in step: STAGE_NAME_TABLE in
-- src/lib/jobs/stageNameTable.ts, checked by the app's unit test and by supabase/tests/stage_kind/.
--
-- CREATE OR REPLACE with the same signature, so nothing that calls it changes and a second run changes
-- nothing. No table is touched and no row is rewritten: a filed record keeps the kind it was filed with.
CREATE OR REPLACE FUNCTION public.stage_checklist_kind_of(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  WITH n AS (
    SELECT regexp_replace(
             regexp_replace(
               lower(regexp_replace(COALESCE(p_name, ''), '^\s+|\s+$', '', 'g')),
               '^(stage|phase|step)\s*\d+\s*[-–—:.]?\s*', ''),
             '^\d+\s*[-–—:.)]\s*', '') AS s
  ), w AS (
    SELECT s,
           (s ~ '\y(under\s*ground|under\s*slab|ground\s*work|groundwork|pre[[:space:]-]?pour|slab)\y' OR s ~ '\yrough') AS names_rough,
           s ~ '\y(top|stack)[[:space:]-]?out\y' AS names_top,
           s ~ '\y(trim|finish(es|ing)?|final|punch)\y' AS names_trim
    FROM n
  )
  SELECT CASE
    WHEN s ~ '^rough' AND NOT names_top AND NOT names_trim THEN 'rough_in'
    WHEN s ~ '^(top|stack)[[:space:]-]?out' AND NOT names_rough AND NOT names_trim THEN 'top_out'
    WHEN (s ~ '^(trim|finish(es|ing)?)\y' OR s ~ '^set\s+trim\y') AND NOT names_rough AND NOT names_top THEN 'trim_set'
    ELSE NULL
  END
  FROM w;
$$;
COMMENT ON FUNCTION public.stage_checklist_kind_of(text) IS 'The checklist kind a stage line''s name reads as: rough_in, top_out, trim_set, or null for a line with no checklist. The same rule as the app''s stageRank (src/lib/jobs/stageRecognition.ts) since punch list #397 PR 6: the start of the name gives the stage, "set trim" is trim, and a name that also holds another stage''s word stands for none. STAGE_NAME_TABLE holds the two in step.';
