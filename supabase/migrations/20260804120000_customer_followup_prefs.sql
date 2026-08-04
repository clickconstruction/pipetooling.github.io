SET lock_timeout = '3s';

-- Followup train PR A (v2.1385): shared per-customer follow-up preferences for
-- the Builder Review / Followup surface.
--
-- Replaces the localStorage-only PIA flag (per-user, per-device, lost on
-- cache clear) with one team-shared row per customer, and adds the snooze
-- fields the upcoming Followup queue uses ("paused until <date>, with a note,
-- visible to everyone"). One row per customer; absence of a row = no flags.

CREATE TABLE IF NOT EXISTS public.customer_followup_prefs (
  customer_id uuid PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  pia boolean NOT NULL DEFAULT false,
  snoozed_until timestamptz,
  snooze_note text,
  snoozed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.customer_followup_prefs IS
  'Team-shared follow-up flags per customer for the Bids Followup surface: PIA (drop from the Oldest-first call queue) and snooze (hide from the queue until a date, with a note). One row per customer; no row = no flags. Replaces the pre-v2.1385 per-browser localStorage PIA list.';

ALTER TABLE public.customer_followup_prefs ENABLE ROW LEVEL SECURITY;

-- Same audience as the bids surfaces: any signed-in office user can read and
-- maintain the shared flags. (Write access for read-only/training users is
-- stripped by the blanket blocks applied below.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'customer_followup_prefs' AND policyname = 'customer_followup_prefs_select'
  ) THEN
    CREATE POLICY customer_followup_prefs_select ON public.customer_followup_prefs
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'customer_followup_prefs' AND policyname = 'customer_followup_prefs_insert'
  ) THEN
    CREATE POLICY customer_followup_prefs_insert ON public.customer_followup_prefs
      FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'customer_followup_prefs' AND policyname = 'customer_followup_prefs_update'
  ) THEN
    CREATE POLICY customer_followup_prefs_update ON public.customer_followup_prefs
      FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'customer_followup_prefs' AND policyname = 'customer_followup_prefs_delete'
  ) THEN
    CREATE POLICY customer_followup_prefs_delete ON public.customer_followup_prefs
      FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_followup_prefs TO authenticated;

-- Required for every CREATE TABLE migration: re-attach the read-only (training
-- mode) write blocks so users.read_only cannot write the new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
