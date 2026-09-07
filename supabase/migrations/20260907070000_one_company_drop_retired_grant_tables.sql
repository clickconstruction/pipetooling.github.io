SET lock_timeout = '3s';

-- v2.2999 — One company, Phase 5c: drop the retired adoption / sharing tables.
--
-- 20260907050000 renamed master_assistants / master_shares to retired_* and put same-named
-- views in their place; 20260907060000 made the views opaque to PostgREST. Since then nothing
-- names the retired pair: no policy (the 84 that named the old tables were re-bound to the
-- views), no function, no view, no foreign key, no client code. Their 11 + 7 rows are listed
-- by name in docs/migrations/20260907070000_one_company_drop_retired_grant_tables.md.
--
-- No CASCADE, on purpose: if any object still depended on either table the DROP would fail
-- and the push would stop with nothing lost. Idempotent (IF EXISTS).

DROP TABLE IF EXISTS public.retired_master_assistants;
DROP TABLE IF EXISTS public.retired_master_shares;
