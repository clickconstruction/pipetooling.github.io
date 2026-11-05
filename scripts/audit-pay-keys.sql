-- Pay keys audit (punch list #267, PR 1) — read-only, over the pooler (docs/DB_FREEZE_RUNBOOK.md names the recipe):
--   PGPASSWORD=… /usr/local/bin/psql "host=… user=postgres.<ref> sslmode=require" -f scripts/audit-pay-keys.sql
-- The ten name-keyed pay tables carry person_id → people, filled by pay_tables_set_person_id through
-- resolve_pay_person_id (users.name → people.account_user_id first, then a unique unarchived people.name). Before
-- the keys move off person_name (the plan's Phase E), every row must carry a person_id that agrees with its name.
-- Prints counts only — no names, since the repo is public; a dev reads the names on the pooler.
SET default_transaction_read_only = on;
SET statement_timeout = '30s';

-- 1. Per table: rows, rows with no person_id, rows whose person's trimmed name is not the row's person_name.
WITH t AS (
  SELECT 'people_pay_config' AS tbl, count(*) AS rows, count(*) FILTER (WHERE person_id IS NULL) AS no_id,
         count(*) FILTER (WHERE person_id IS NOT NULL AND btrim(person_name) <> (SELECT btrim(name) FROM public.people p WHERE p.id = x.person_id)) AS name_differs
  FROM public.people_pay_config x
  UNION ALL SELECT 'people_hours', count(*), count(*) FILTER (WHERE person_id IS NULL), count(*) FILTER (WHERE person_id IS NOT NULL AND btrim(person_name) <> (SELECT btrim(name) FROM public.people p WHERE p.id = x.person_id)) FROM public.people_hours x
  UNION ALL SELECT 'people_crew_jobs', count(*), count(*) FILTER (WHERE person_id IS NULL), count(*) FILTER (WHERE person_id IS NOT NULL AND btrim(person_name) <> (SELECT btrim(name) FROM public.people p WHERE p.id = x.person_id)) FROM public.people_crew_jobs x
  UNION ALL SELECT 'people_crew_bids', count(*), count(*) FILTER (WHERE person_id IS NULL), count(*) FILTER (WHERE person_id IS NOT NULL AND btrim(person_name) <> (SELECT btrim(name) FROM public.people p WHERE p.id = x.person_id)) FROM public.people_crew_bids x
  UNION ALL SELECT 'pay_stubs', count(*), count(*) FILTER (WHERE person_id IS NULL), count(*) FILTER (WHERE person_id IS NOT NULL AND btrim(person_name) <> (SELECT btrim(name) FROM public.people p WHERE p.id = x.person_id)) FROM public.pay_stubs x
  UNION ALL SELECT 'pay_stub_days', count(*), count(*) FILTER (WHERE person_id IS NULL), 0 FROM public.pay_stub_days x
  UNION ALL SELECT 'person_offsets', count(*), count(*) FILTER (WHERE person_id IS NULL), count(*) FILTER (WHERE person_id IS NOT NULL AND btrim(person_name) <> (SELECT btrim(name) FROM public.people p WHERE p.id = x.person_id)) FROM public.person_offsets x
  UNION ALL SELECT 'hours_reviewed', count(*), count(*) FILTER (WHERE person_id IS NULL), count(*) FILTER (WHERE person_id IS NOT NULL AND btrim(person_name) <> (SELECT btrim(name) FROM public.people p WHERE p.id = x.person_id)) FROM public.hours_reviewed x
  UNION ALL SELECT 'people_team_members', count(*), count(*) FILTER (WHERE person_id IS NULL), count(*) FILTER (WHERE person_id IS NOT NULL AND btrim(person_name) <> (SELECT btrim(name) FROM public.people p WHERE p.id = x.person_id)) FROM public.people_team_members x
  UNION ALL SELECT 'people_hours_display_order', count(*), count(*) FILTER (WHERE person_id IS NULL), count(*) FILTER (WHERE person_id IS NOT NULL AND btrim(person_name) <> (SELECT btrim(name) FROM public.people p WHERE p.id = x.person_id)) FROM public.people_hours_display_order x
)
SELECT * FROM t ORDER BY tbl;

-- 2. The names with no person_id, sorted by what they could match — the owner settles each by hand on the desk.
WITH n AS (
  SELECT DISTINCT btrim(person_name) AS nm FROM (
    SELECT person_name FROM public.people_hours WHERE person_id IS NULL
    UNION ALL SELECT person_name FROM public.people_pay_config WHERE person_id IS NULL
    UNION ALL SELECT person_name FROM public.people_crew_jobs WHERE person_id IS NULL
    UNION ALL SELECT person_name FROM public.people_crew_bids WHERE person_id IS NULL
    UNION ALL SELECT person_name FROM public.pay_stubs WHERE person_id IS NULL
    UNION ALL SELECT person_name FROM public.person_offsets WHERE person_id IS NULL
    UNION ALL SELECT person_name FROM public.hours_reviewed WHERE person_id IS NULL
    UNION ALL SELECT person_name FROM public.people_team_members WHERE person_id IS NULL
    UNION ALL SELECT person_name FROM public.people_hours_display_order WHERE person_id IS NULL
  ) u
), m AS (
  SELECT n.nm,
    (SELECT count(*) FROM public.people p WHERE btrim(p.name) = n.nm) AS people_any,
    (SELECT count(*) FROM public.people p WHERE btrim(p.name) = n.nm AND p.archived_at IS NULL) AS people_live,
    (SELECT count(*) FROM public.users u WHERE btrim(u.name) = n.nm) AS users_any,
    (SELECT count(*) FROM public.users u JOIN public.people p ON p.account_user_id = u.id WHERE btrim(u.name) = n.nm) AS users_with_record
  FROM n
)
SELECT
  count(*) AS names,
  count(*) FILTER (WHERE people_live = 1) AS one_live_record,
  count(*) FILTER (WHERE people_live = 0 AND people_any = 1) AS one_archived_record,
  count(*) FILTER (WHERE people_any > 1) AS several_records,
  count(*) FILTER (WHERE people_any = 0 AND users_any = 1 AND users_with_record = 0) AS a_users_row_with_no_record,
  count(*) FILTER (WHERE people_any = 0 AND users_any > 1) AS several_users_rows,
  count(*) FILTER (WHERE people_any = 0 AND users_any = 0) AS nobody
FROM m;
