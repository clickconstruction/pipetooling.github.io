-- The schedule builder's rows (v2.6020, punch list #204 PR 2, migration *_gc_schedule_builder): a first draft
-- carries each bar's and date's phase and the phases in order, and refuses a phase it does not list; a template
-- saved as a new row from nothing, with its rows, phases, kind and working days, then as a new version that marks
-- the one it replaced and keeps the name; the save's refusals in the kernel's words; the old shape straight to the
-- table, and the table's own checks; the append-only grant; training mode and a subcontractor. Presses run as a
-- dev through RLS on a job of its own, made as postgres, inside one transaction that rolls back. Raises on the
-- first failed assertion; ends with "gc_schedule builder PASSED". See scripts/pgtest-gc-schedule.sh. Never
-- against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Who: a dev, a dev in training mode, and a subcontractor (no policy on the schedule's tables lets one in).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000009d1', 'dev@builder.test'),
  ('00000000-0000-0000-0000-0000000009d2', 'trainee@builder.test'),
  ('00000000-0000-0000-0000-0000000009d3', 'sub@builder.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000009d1', 'dev@builder.test', 'Builder Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000009d2', 'trainee@builder.test', 'Builder Trainee', 'dev'),
  ('00000000-0000-0000-0000-0000000009d3', 'sub@builder.test', 'Builder Sub', 'subcontractor')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-0000000009d2';

-- One GC job in buyout: P with Plumbing (Underground, Rough-in) and Electrical (Rough-in).
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-0000000009c1', 'Builder Test Owner', '00000000-0000-0000-0000-0000000009d1');
INSERT INTO public.projects (id, name, customer_id) VALUES ('00000000-0000-0000-0000-0000000009a1', 'Builder test P', '00000000-0000-0000-0000-0000000009c1');
INSERT INTO public.gc_projects (project_id, stage) VALUES ('00000000-0000-0000-0000-0000000009a1', 'buyout');
INSERT INTO public.gc_trade_packages (id, project_id, trade, position) VALUES
  ('00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-0000000009a1', 'Plumbing', 0),
  ('00000000-0000-0000-0000-0000000009b2', '00000000-0000-0000-0000-0000000009a1', 'Electrical', 1);
INSERT INTO public.gc_scope_items (id, package_id, position, label) VALUES
  ('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', 0, 'Underground'),
  ('00000000-0000-0000-0000-0000000009e2', '00000000-0000-0000-0000-0000000009b1', 1, 'Rough-in'),
  ('00000000-0000-0000-0000-0000000009e3', '00000000-0000-0000-0000-0000000009b2', 0, 'Rough-in');

CREATE SCHEMA gsb;
CREATE FUNCTION gsb.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused with words that hold `want`. Its own writes go with the refusal (a subtransaction).
CREATE FUNCTION gsb.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION '% was refused for another reason: %', label, SQLERRM; END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION gsb.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- The job's bars and dates to meet, each with its phase or "-", and the phases on the schedule.
CREATE FUNCTION gsb.bars(p_project uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT string_agg(coalesce(a.label, right(a.id::text, 3)) || ' ' || coalesce(a.phase, '-'), E'\n' ORDER BY a.position)
  FROM public.gc_schedule_activities a WHERE a.project_id = p_project $$;
CREATE FUNCTION gsb.dates(p_project uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT string_agg(m.label || ' ' || coalesce(m.phase, '-'), E'\n' ORDER BY m.position)
  FROM public.gc_schedule_milestones m WHERE m.project_id = p_project $$;
CREATE FUNCTION gsb.phases(p_project uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(s.phases::text, 'null') FROM public.gc_schedules s WHERE s.project_id = p_project $$;
-- A saved template, in one line.
CREATE FUNCTION gsb.template(p_id uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.name || ' · ' || coalesce(t.kind, '-') || ' · ' || t.working_days::text || ' · ' || coalesce(jsonb_array_length(t.rows)::text, '-') || ' rows · '
      || coalesce(jsonb_array_length(t.phases)::text, '-') || ' phases · ' || jsonb_array_length(t.lines) || ' lines · from '
      || coalesce(t.from_name, '-') || ' ' || coalesce(t.from_done_pct::text, '-') || ' · version of ' || coalesce(t.version_of::text, '-')
      || ' · superseded ' || coalesce(t.superseded_on::text, '-') || ' · aside ' || coalesce(t.aside_on::text, '-') || ' · by ' || coalesce(t.saved_by::text, '-')
  FROM public.gc_schedule_templates t WHERE t.id = p_id $$;
GRANT USAGE ON SCHEMA gsb TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gsb TO authenticated;
-- What a press returned, for the steps after it.
CREATE TEMP TABLE ids (k text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON ids TO authenticated;

SELECT gsb.as_user('00000000-0000-0000-0000-0000000009d1');
SET LOCAL ROLE authenticated;

-- 1 · A first draft drawn from a template with rows: every bar and date to meet in its phase by name, the job's
-- own work the template had no row for with none, and the phases in order on the schedule. A phase's spaces are trimmed.
SELECT gsb.same('a draft with phases makes version 1', public.gc_schedule_draft('00000000-0000-0000-0000-0000000009a1', NULL,
  'Drew a first draft of the schedule on Builder test P: 4 activities from Mon Nov 2.',
  $j${"phases": ["Sitework and utilities", "MEP rough-in"],
      "bars": [
        {"kind": "line", "scopeItemId": "00000000-0000-0000-0000-0000000009e1", "packageId": "00000000-0000-0000-0000-0000000009b1", "start": "2026-11-02", "finish": "2026-11-06", "after": [], "phase": "Sitework and utilities"},
        {"kind": "line", "scopeItemId": "00000000-0000-0000-0000-0000000009e2", "packageId": "00000000-0000-0000-0000-0000000009b1", "start": "2026-11-09", "finish": "2026-11-13", "after": [{"id": "00000000-0000-0000-0000-0000000009e1", "gap": 0}], "phase": "MEP rough-in"},
        {"kind": "line", "scopeItemId": "00000000-0000-0000-0000-0000000009e3", "packageId": "00000000-0000-0000-0000-0000000009b2", "start": "2026-11-09", "finish": "2026-11-13", "after": [], "phase": " MEP rough-in "},
        {"kind": "added", "id": "00000000-0000-0000-0000-0000000009f1", "label": "Paving", "who": "Paving", "start": "2026-11-16", "finish": "2026-11-20", "after": []}],
      "milestones": [
        {"id": "00000000-0000-0000-0000-0000000009f2", "label": "Start date", "planned": "2026-11-02", "phase": "Sitework and utilities"},
        {"id": "00000000-0000-0000-0000-0000000009f3", "label": "Substantial completion", "planned": "2026-11-27"}]}$j$::jsonb)::text, '1');
SELECT gsb.same('each bar in its phase, the job''s own work in none', gsb.bars('00000000-0000-0000-0000-0000000009a1'),
  E'9e1 Sitework and utilities\n9e2 MEP rough-in\n9e3 MEP rough-in\nPaving -');
SELECT gsb.same('each date to meet in its phase', gsb.dates('00000000-0000-0000-0000-0000000009a1'), E'Start date Sitework and utilities\nSubstantial completion -');
SELECT gsb.same('the phases in order on the schedule', gsb.phases('00000000-0000-0000-0000-0000000009a1'), '["Sitework and utilities", "MEP rough-in"]');

-- 2 · A bar in a phase the draft does not list, a date to meet in one, a phase named twice, a phase with no name:
-- refused before anything is written, and the first draft stands.
SELECT gsb.refused('a bar in a phase the draft does not list', $q$SELECT public.gc_schedule_draft('00000000-0000-0000-0000-0000000009a1', 1, 'Drew it again.',
  '{"phases": ["Sitework and utilities"], "bars": [{"kind": "inspection", "id": "00000000-0000-0000-0000-0000000009f9", "label": "Final inspection", "start": "2026-11-25", "finish": "2026-11-26", "after": [], "phase": "Closeout"}]}')$q$,
  'A bar names a phase the draft does not list.');
SELECT gsb.refused('a date to meet in a phase the draft does not list', $q$SELECT public.gc_schedule_draft('00000000-0000-0000-0000-0000000009a1', 1, 'Drew it again.',
  '{"bars": [{"kind": "inspection", "id": "00000000-0000-0000-0000-0000000009f9", "label": "Final inspection", "start": "2026-11-25", "finish": "2026-11-26", "after": []}],
    "milestones": [{"id": "00000000-0000-0000-0000-0000000009f8", "label": "Certificate of occupancy", "planned": "2026-11-27", "phase": "Closeout"}]}')$q$,
  'A bar names a phase the draft does not list.');
SELECT gsb.refused('a phase listed twice', $q$SELECT public.gc_schedule_draft('00000000-0000-0000-0000-0000000009a1', 1, 'Drew it again.',
  '{"phases": ["Closeout", "Closeout"], "bars": [{"kind": "inspection", "id": "00000000-0000-0000-0000-0000000009f9", "label": "Final inspection", "start": "2026-11-25", "finish": "2026-11-26", "after": [], "phase": "Closeout"}]}')$q$,
  'A phase is listed twice.');
SELECT gsb.refused('a phase with no name', $q$SELECT public.gc_schedule_draft('00000000-0000-0000-0000-0000000009a1', 1, 'Drew it again.',
  '{"phases": ["Closeout", "  "], "bars": [{"kind": "inspection", "id": "00000000-0000-0000-0000-0000000009f9", "label": "Final inspection", "start": "2026-11-25", "finish": "2026-11-26", "after": [], "phase": "Closeout"}]}')$q$,
  'Each phase needs its name');
SELECT gsb.same('the first draft stands', gsb.phases('00000000-0000-0000-0000-0000000009a1') || ' · ' || gsb.dates('00000000-0000-0000-0000-0000000009a1'),
  E'["Sitework and utilities", "MEP rough-in"] · Start date Sitework and utilities\nSubstantial completion -');

-- 3 · Drawn again before Start with no phases: the phases go, and no bar or date carries one.
SELECT gsb.same('drawn again with no phases, as version 2', public.gc_schedule_draft('00000000-0000-0000-0000-0000000009a1', 1, 'Drew the schedule on Builder test P again.',
  '{"bars": [{"kind": "line", "scopeItemId": "00000000-0000-0000-0000-0000000009e1", "packageId": "00000000-0000-0000-0000-0000000009b1", "start": "2026-11-02", "finish": "2026-11-06", "after": []}],
    "milestones": [{"id": "00000000-0000-0000-0000-0000000009f4", "label": "Substantial completion", "planned": "2026-11-20"}]}')::text, '2');
SELECT gsb.same('no phase anywhere', gsb.bars('00000000-0000-0000-0000-0000000009a1') || ' | ' || gsb.dates('00000000-0000-0000-0000-0000000009a1') || ' | ' || gsb.phases('00000000-0000-0000-0000-0000000009a1'),
  '9e1 - | Substantial completion - | null');

-- 4 · A template saved from nothing (New template): rows, phases, a kind and working days; no job it came from
-- and no lines. Who saved it is the signed-in person.
INSERT INTO ids SELECT 'one', public.gc_schedule_template_save($j${"name": " ZZ  quick-lube shell ", "kind": "Quick lube", "on": "2026-10-28", "workingDays": true, "weeks": 2,
  "phases": [{"key": "precon", "name": "Preconstruction and procurement"}, {"key": "site", "name": "Sitework and utilities"}],
  "rows": [{"phase": "precon", "label": "Notice to proceed", "who": {"kind": "office"}, "days": 5, "after": [], "offset": 0, "milestone": false},
           {"phase": "site", "label": "Underground", "who": {"kind": "us"}, "days": 10, "after": [{"row": "Notice to proceed"}], "offset": 0, "milestone": false},
           {"phase": "site", "label": "Start date", "who": {"kind": "trade", "trade": "Sitework"}, "days": 1, "after": [], "offset": 0, "milestone": true}]}$j$::jsonb);
SELECT gsb.same('the template as saved', gsb.template((SELECT id FROM ids WHERE k = 'one')),
  'ZZ quick-lube shell · Quick lube · true · 3 rows · 2 phases · 0 lines · from - - · version of - · superseded - · aside - · by 00000000-0000-0000-0000-0000000009d1');

-- 5 · The same name again, whatever the case, and the shapes the save refuses, each in the kernel's words.
SELECT gsb.refused('another template with that name', $q$SELECT public.gc_schedule_template_save('{"name": "zz QUICK-LUBE shell", "on": "2026-10-28", "weeks": 1, "phases": [{"key": "a", "name": "A"}], "rows": [{"phase": "a", "label": "One", "who": {"kind": "office"}, "days": 1}]}')$q$,
  'Another template has that name.');
SELECT gsb.refused('a template with no name', $q$SELECT public.gc_schedule_template_save('{"name": "  ", "on": "2026-10-28", "weeks": 1, "phases": [{"key": "a", "name": "A"}], "rows": [{"phase": "a", "label": "One", "who": {"kind": "office"}, "days": 1}]}')$q$,
  'Give it a name.');
SELECT gsb.refused('a template with no day', $q$SELECT public.gc_schedule_template_save('{"name": "ZZ no day", "weeks": 1, "phases": [{"key": "a", "name": "A"}], "rows": [{"phase": "a", "label": "One", "who": {"kind": "office"}, "days": 1}]}')$q$,
  'A save needs its day.');
SELECT gsb.refused('a template with no phases', $q$SELECT public.gc_schedule_template_save('{"name": "ZZ no phases", "on": "2026-10-28", "weeks": 1, "phases": [], "rows": [{"phase": "a", "label": "One", "who": {"kind": "office"}, "days": 1}]}')$q$,
  'A template needs at least one phase.');
SELECT gsb.refused('a template with no rows', $q$SELECT public.gc_schedule_template_save('{"name": "ZZ no rows", "on": "2026-10-28", "weeks": 1, "phases": [{"key": "a", "name": "A"}], "rows": []}')$q$,
  'A template needs at least one row.');
SELECT gsb.refused('a row with no name', $q$SELECT public.gc_schedule_template_save('{"name": "ZZ bare row", "on": "2026-10-28", "weeks": 1, "phases": [{"key": "a", "name": "A"}], "rows": [{"phase": "a", "label": " ", "who": {"kind": "office"}, "days": 1}]}')$q$,
  'Each row needs its name.');
SELECT gsb.refused('a row in a phase the template does not have', $q$SELECT public.gc_schedule_template_save('{"name": "ZZ lost row", "on": "2026-10-28", "weeks": 1, "phases": [{"key": "a", "name": "A"}], "rows": [{"phase": "b", "label": "One", "who": {"kind": "office"}, "days": 1}]}')$q$,
  'A row is in a phase the template does not have.');
SELECT gsb.refused('a row with no days', $q$SELECT public.gc_schedule_template_save('{"name": "ZZ no days", "on": "2026-10-28", "weeks": 1, "phases": [{"key": "a", "name": "A"}], "rows": [{"phase": "a", "label": "One", "who": {"kind": "office"}, "days": 0}]}')$q$,
  'Each row needs its days, one or more.');
SELECT gsb.refused('a row assigned to a person', $q$SELECT public.gc_schedule_template_save('{"name": "ZZ a person", "on": "2026-10-28", "weeks": 1, "phases": [{"key": "a", "name": "A"}], "rows": [{"phase": "a", "label": "One", "who": {"kind": "person", "name": "Robert"}, "days": 1}]}')$q$,
  'Each row names a trade, Us or Office.');
SELECT gsb.refused('a trade row with no trade', $q$SELECT public.gc_schedule_template_save('{"name": "ZZ no trade", "on": "2026-10-28", "weeks": 1, "phases": [{"key": "a", "name": "A"}], "rows": [{"phase": "a", "label": "One", "who": {"kind": "trade", "trade": " "}, "days": 1}]}')$q$,
  'Each row names a trade, Us or Office.');
SELECT gsb.refused('a template under a week', $q$SELECT public.gc_schedule_template_save('{"name": "ZZ no weeks", "on": "2026-10-28", "weeks": 0, "phases": [{"key": "a", "name": "A"}], "rows": [{"phase": "a", "label": "One", "who": {"kind": "office"}, "days": 1}]}')$q$,
  'It makes under a week to build.');
SELECT gsb.refused('a kind too long', $q$SELECT public.gc_schedule_template_save('{"name": "ZZ long kind", "kind": "A kind of job whose name runs on and on past forty letters", "on": "2026-10-28", "weeks": 1, "phases": [{"key": "a", "name": "A"}], "rows": [{"phase": "a", "label": "One", "who": {"kind": "office"}, "days": 1}]}')$q$,
  'Keep the kind to 40 letters.');
SELECT gsb.same('nothing of those was written', (SELECT count(*) FROM public.gc_schedule_templates WHERE name LIKE 'ZZ %')::text, '1');

-- 6 · A save makes a new version (call 2): the one it replaces is marked, keeps its rows and its name for the jobs
-- drawn from it, and leaves the current ones; the new one names it and carries the name.
INSERT INTO ids SELECT 'two', public.gc_schedule_template_save($j${"name": "ZZ quick-lube shell", "kind": "Quick lube", "on": "2026-10-29", "workingDays": true, "weeks": 3,
  "phases": [{"key": "precon", "name": "Preconstruction and procurement"}, {"key": "site", "name": "Sitework and utilities"}, {"key": "slab", "name": "Foundations and slab"}],
  "rows": [{"phase": "precon", "label": "Notice to proceed", "who": {"kind": "office"}, "days": 5, "after": [], "offset": 0, "milestone": false},
           {"phase": "site", "label": "Underground", "who": {"kind": "us"}, "days": 10, "after": [{"row": "Notice to proceed"}], "offset": 0, "milestone": false},
           {"phase": "site", "label": "Start date", "who": {"kind": "trade", "trade": "Sitework"}, "days": 1, "after": [], "offset": 0, "milestone": true},
           {"phase": "slab", "label": "Slab on grade", "who": {"kind": "trade", "trade": "Concrete"}, "days": 5, "after": [{"row": "Underground", "gap": 2}], "offset": 0, "milestone": false}]}$j$::jsonb,
  (SELECT id FROM ids WHERE k = 'one'));
SELECT gsb.same('the old version is marked and keeps its rows', gsb.template((SELECT id FROM ids WHERE k = 'one')),
  'ZZ quick-lube shell · Quick lube · true · 3 rows · 2 phases · 0 lines · from - - · version of - · superseded 2026-10-29 · aside - · by 00000000-0000-0000-0000-0000000009d1');
SELECT gsb.same('the new version names it and carries the name', gsb.template((SELECT id FROM ids WHERE k = 'two')),
  'ZZ quick-lube shell · Quick lube · true · 4 rows · 3 phases · 0 lines · from - - · version of ' || (SELECT id::text FROM ids WHERE k = 'one') || ' · superseded - · aside - · by 00000000-0000-0000-0000-0000000009d1');
SELECT gsb.same('one current template of that name', (SELECT count(*) FROM public.gc_schedule_templates WHERE lower(name) = 'zz quick-lube shell' AND superseded_on IS NULL)::text, '1');

-- 7 · A save on a version already replaced, and on one that is gone: refused, nothing marked.
SELECT gsb.refused('a save on the replaced version', format($q$SELECT public.gc_schedule_template_save('{"name": "ZZ quick-lube shell", "on": "2026-10-30", "weeks": 1, "phases": [{"key": "a", "name": "A"}], "rows": [{"phase": "a", "label": "One", "who": {"kind": "office"}, "days": 1}]}', %L)$q$, (SELECT id FROM ids WHERE k = 'one')),
  'saved again since you opened it');
SELECT gsb.refused('a save on a template that is gone', $q$SELECT public.gc_schedule_template_save('{"name": "ZZ gone", "on": "2026-10-30", "weeks": 1, "phases": [{"key": "a", "name": "A"}], "rows": [{"phase": "a", "label": "One", "who": {"kind": "office"}, "days": 1}]}', '00000000-0000-0000-0000-000000000999')$q$,
  'That template is gone.');
SELECT gsb.same('the current version stands', (SELECT coalesce(superseded_on::text, '-') FROM public.gc_schedule_templates WHERE id = (SELECT id FROM ids WHERE k = 'two')), '-');

-- 8 · A template saved from a job (today's Save as a template, straight to the table) and then saved again from the
-- editor keeps the job it came from when the save says nothing of it, and the day it was set aside.
INSERT INTO public.gc_schedule_templates (id, name, from_project_id, from_name, from_done_pct, saved_on, saved_by, lines, stages, weeks, aside_on) VALUES (
  '00000000-0000-0000-0000-000000000991', 'ZZ from Builder test P', '00000000-0000-0000-0000-0000000009a1', 'Builder test P', 40, DATE '2026-10-27', '00000000-0000-0000-0000-0000000009d1',
  '[{"trade": "Plumbing", "label": "Underground", "stage": "underground", "days": 5, "after": [], "offset": 0}]', '[]', 1, DATE '2026-10-28');
INSERT INTO ids SELECT 'three', public.gc_schedule_template_save('{"name": "ZZ from Builder test P", "on": "2026-10-29", "weeks": 1, "phases": [{"key": "underground", "name": "Underground"}], "rows": [{"phase": "underground", "label": "Underground", "who": {"kind": "trade", "trade": "Plumbing"}, "days": 5, "after": [], "offset": 0, "milestone": false}]}',
  '00000000-0000-0000-0000-000000000991');
SELECT gsb.same('the new version keeps the job it came from and its being set aside', gsb.template((SELECT id FROM ids WHERE k = 'three')),
  'ZZ from Builder test P · - · false · 1 rows · 1 phases · 0 lines · from Builder test P 40 · version of 00000000-0000-0000-0000-000000000991 · superseded - · aside 2026-10-28 · by 00000000-0000-0000-0000-0000000009d1');
SELECT gsb.same('the new version carries the job''s id too', (SELECT from_project_id::text FROM public.gc_schedule_templates WHERE id = (SELECT id FROM ids WHERE k = 'three')), '00000000-0000-0000-0000-0000000009a1');

-- 9 · Straight to the table: the old shape still saves; no lines and no rows is refused, as before; rows with no lines
-- passes; a kind of nothing and a job's name with no percent are refused.
SELECT gsb.refused('a template with no lines and no rows, straight to the table', $q$INSERT INTO public.gc_schedule_templates (name, from_name, from_done_pct, saved_on, lines, stages, weeks)
    VALUES ('ZZ nothing', 'Builder test P', 0, DATE '2026-10-28', '[]', '[]', 1)$q$, 'gc_schedule_templates_lines_listed');
SELECT gsb.refused('a template with a kind of nothing, straight to the table', $q$INSERT INTO public.gc_schedule_templates (name, saved_on, lines, stages, weeks, kind)
    VALUES ('ZZ blank kind', DATE '2026-10-28', '[{"trade": "Electrical", "label": "Service"}]', '[]', 1, '  ')$q$, 'gc_schedule_templates_kind_short');
SELECT gsb.refused('a template with a job''s name and no percent, straight to the table', $q$INSERT INTO public.gc_schedule_templates (name, from_name, saved_on, lines, stages, weeks)
    VALUES ('ZZ half a job', 'Builder test P', DATE '2026-10-28', '[{"trade": "Electrical", "label": "Service"}]', '[]', 1)$q$, 'gc_schedule_templates_from_named');
SELECT gsb.refused('a template with no rows in its rows, straight to the table', $q$INSERT INTO public.gc_schedule_templates (name, saved_on, lines, stages, weeks, phases, rows)
    VALUES ('ZZ empty rows', DATE '2026-10-28', '[]', '[]', 1, '[]', '[]')$q$, 'gc_schedule_templates_rows_listed');
INSERT INTO public.gc_schedule_templates (name, saved_on, lines, stages, weeks, phases, rows) VALUES
  ('ZZ rows only', DATE '2026-10-28', '[]', '[]', 1, '[{"key": "a", "name": "A"}]', '[{"phase": "a", "label": "One", "who": {"kind": "office"}, "days": 1, "after": [], "offset": 0, "milestone": false}]');
SELECT gsb.same('a template with rows and no lines, straight to the table', (SELECT count(*) FROM public.gc_schedule_templates WHERE name = 'ZZ rows only')::text, '1');

-- 10 · Append only: a saved row's rows, lines, kind and version never change, and no row goes; its name, the day
-- it was set aside and the day a new version replaced it may.
SELECT gsb.refused('a template''s rows changed in place', $q$UPDATE public.gc_schedule_templates SET rows = '[]' WHERE name = 'ZZ rows only'$q$, 'permission denied');
SELECT gsb.refused('a template''s kind changed in place', $q$UPDATE public.gc_schedule_templates SET kind = 'Tenant finish' WHERE name = 'ZZ rows only'$q$, 'permission denied');
SELECT gsb.refused('a template''s version changed in place', $q$UPDATE public.gc_schedule_templates SET version_of = NULL WHERE name = 'ZZ rows only'$q$, 'permission denied');
SELECT gsb.refused('a template deleted', $q$DELETE FROM public.gc_schedule_templates WHERE name = 'ZZ rows only'$q$, 'permission denied');
UPDATE public.gc_schedule_templates SET aside_on = DATE '2026-10-28', name = 'ZZ rows only, aside' WHERE name = 'ZZ rows only';
SELECT gsb.same('set aside and renamed, as before', (SELECT aside_on::text || ' ' || name FROM public.gc_schedule_templates WHERE name = 'ZZ rows only, aside'), '2026-10-28 ZZ rows only, aside');

-- 11 · Training mode and a subcontractor: no save, nothing written.
SELECT gsb.as_user('00000000-0000-0000-0000-0000000009d2');
SELECT gsb.refused('a save in training mode', $q$SELECT public.gc_schedule_template_save('{"name": "ZZ trainee", "on": "2026-10-28", "weeks": 1, "phases": [{"key": "a", "name": "A"}], "rows": [{"phase": "a", "label": "One", "who": {"kind": "office"}, "days": 1}]}')$q$,
  'Read-only (training) mode: changes are blocked.');
SELECT gsb.as_user('00000000-0000-0000-0000-0000000009d3');
SELECT gsb.refused('a save by someone the policies keep out', $q$SELECT public.gc_schedule_template_save('{"name": "ZZ sub", "on": "2026-10-28", "weeks": 1, "phases": [{"key": "a", "name": "A"}], "rows": [{"phase": "a", "label": "One", "who": {"kind": "office"}, "days": 1}]}')$q$,
  'row-level security');
RESET ROLE;
SELECT gsb.same('only the four templates above were written', (SELECT count(*) FROM public.gc_schedule_templates WHERE name LIKE 'ZZ %')::text, '5');

-- 12 · The catalog: the name is unique among the current versions only, and the old index is gone.
SELECT gsb.same('the name index holds current versions only', pg_get_indexdef('public.gc_schedule_templates_name_once_current'::regclass),
  'CREATE UNIQUE INDEX gc_schedule_templates_name_once_current ON public.gc_schedule_templates USING btree (lower(name)) WHERE (superseded_on IS NULL)');
SELECT gsb.same('the old name index is gone', (SELECT count(*) FROM pg_class WHERE relname = 'gc_schedule_templates_name_once')::text, '0');
SELECT gsb.same('authenticated may update name, aside_on and superseded_on alone',
  (SELECT string_agg(column_name, ' ' ORDER BY column_name) FROM information_schema.column_privileges
   WHERE table_schema = 'public' AND table_name = 'gc_schedule_templates' AND grantee = 'authenticated' AND privilege_type = 'UPDATE'),
  'aside_on name superseded_on');

DO $$ BEGIN RAISE NOTICE 'gc_schedule builder PASSED'; END $$;
ROLLBACK;
