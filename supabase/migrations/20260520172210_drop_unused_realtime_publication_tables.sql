-- Tier 1 realtime load mitigation: drop tables from supabase_realtime that have
-- zero client-side postgres_changes subscribers. They were broadcasting every
-- row change on the wire for nothing, contributing to Realtime tenant load.
--
-- Re-adding any of these in the future requires landing a client subscriber in
-- the same PR (see .cursor/rules/supabase-realtime.mdc).
--
-- Idempotent: each DROP is wrapped so re-running this migration on a database
-- that has already had the table dropped (or never had it) is a no-op.

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.team_leader_assignments;
EXCEPTION
    WHEN undefined_object THEN NULL;
    WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.user_pinned_tabs;
EXCEPTION
    WHEN undefined_object THEN NULL;
    WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.user_dashboard_preferences;
EXCEPTION
    WHEN undefined_object THEN NULL;
    WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.bid_working_board_columns;
EXCEPTION
    WHEN undefined_object THEN NULL;
    WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.bid_working_board_placements;
EXCEPTION
    WHEN undefined_object THEN NULL;
    WHEN undefined_table THEN NULL;
END $$;
