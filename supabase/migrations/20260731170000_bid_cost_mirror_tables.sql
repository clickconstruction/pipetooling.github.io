SET lock_timeout = '3s';

-- Bid-side mirrors of the job cost tables, so a job's real costs can be
-- reassigned to a BID instead of another job (Edit Job → "Migrate costs and
-- delete this job"). Crews sometimes put their time and spending against a job
-- when the work was really pre-job bid work; today the only escape hatch moves
-- those costs to another *job*.
--
-- Team labor needs no table here: clock_sessions already carries `bid_id` with
-- the `clock_sessions_job_or_bid_not_both` CHECK ("Optional bid this session is
-- for (pre-job work). Mutually exclusive with job_ledger_id."), and
-- people_crew_bids.bid_assignments already mirrors people_crew_jobs. Only the
-- four material/parts surfaces were job-only:
--
--   jobs_tally_parts                     -> bids_tally_parts
--   jobs_ledger_materials                -> bids_materials
--   supply_house_invoice_job_allocations -> supply_house_invoice_bid_allocations
--   mercury_transaction_job_allocations  -> mercury_transaction_bid_allocations
--
-- Purely additive: nothing reads these yet. The migrate RPC lands separately so
-- this can be pushed ahead of the client with zero behavior change.
--
-- `migrated_from_job_id` is a bare uuid with NO foreign key on purpose — the
-- source job is deleted in the same transaction that moves its costs, so an FK
-- would either block the delete or null the provenance away.

-- ---------------------------------------------------------------- parts rows

CREATE TABLE IF NOT EXISTS public.bids_tally_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bid_id uuid NOT NULL,
    fixture_name text DEFAULT ''::text NOT NULL,
    part_id uuid,
    quantity numeric(10,2) DEFAULT 1 NOT NULL,
    sequence_order integer DEFAULT 0 NOT NULL,
    created_by_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    purchase_order_id uuid,
    fixture_cost numeric(10,2) DEFAULT NULL::numeric,
    migrated_from_job_id uuid
);

COMMENT ON TABLE public.bids_tally_parts IS 'Parts-style cost rows per bid; mirror of jobs_tally_parts for pre-job (bid) work. Rows arrive via migrate_job_ledger_costs_to_bid_and_delete or direct entry.';
COMMENT ON COLUMN public.bids_tally_parts.migrated_from_job_id IS 'Provenance: the jobs_ledger row these costs came from, if migrated. No FK — the source job is deleted in the same transaction.';

DO $$ BEGIN
  ALTER TABLE ONLY public.bids_tally_parts ADD CONSTRAINT bids_tally_parts_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE ONLY public.bids_tally_parts
    ADD CONSTRAINT bids_tally_parts_bid_id_fkey FOREIGN KEY (bid_id) REFERENCES public.bids(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;

-- Same FK targets and delete actions as jobs_tally_parts: material_parts
-- RESTRICT (a part in use cannot be deleted), purchase_orders SET NULL.
DO $$ BEGIN
  ALTER TABLE ONLY public.bids_tally_parts
    ADD CONSTRAINT bids_tally_parts_part_id_fkey FOREIGN KEY (part_id) REFERENCES public.material_parts(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE ONLY public.bids_tally_parts
    ADD CONSTRAINT bids_tally_parts_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE ONLY public.bids_tally_parts
    ADD CONSTRAINT bids_tally_parts_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_bids_tally_parts_bid_id ON public.bids_tally_parts USING btree (bid_id);

-- ------------------------------------------------------------ material lines

CREATE TABLE IF NOT EXISTS public.bids_materials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bid_id uuid NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    amount numeric(12,2) DEFAULT 0 NOT NULL,
    sequence_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    migrated_from_job_id uuid
);

COMMENT ON TABLE public.bids_materials IS 'Billed-materials line items per bid; mirror of jobs_ledger_materials for pre-job (bid) work.';
COMMENT ON COLUMN public.bids_materials.migrated_from_job_id IS 'Provenance: the jobs_ledger row these costs came from, if migrated. No FK — the source job is deleted in the same transaction.';

DO $$ BEGIN
  ALTER TABLE ONLY public.bids_materials ADD CONSTRAINT bids_materials_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE ONLY public.bids_materials
    ADD CONSTRAINT bids_materials_bid_id_fkey FOREIGN KEY (bid_id) REFERENCES public.bids(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_bids_materials_bid_id ON public.bids_materials USING btree (bid_id);

-- ------------------------------------------- supply house invoice allocations

CREATE TABLE IF NOT EXISTS public.supply_house_invoice_bid_allocations (
    invoice_id uuid NOT NULL,
    bid_id uuid NOT NULL,
    pct numeric(5,2) NOT NULL,
    migrated_from_job_id uuid,
    CONSTRAINT supply_house_invoice_bid_allocations_pct_check CHECK (((pct >= (0)::numeric) AND (pct <= (100)::numeric)))
);

COMMENT ON TABLE public.supply_house_invoice_bid_allocations IS 'Percentage allocation of supply house invoices to bids; mirror of supply_house_invoice_job_allocations. The 100%-per-invoice ceiling spans BOTH tables and is enforced by the callers (migrate_job_ledger_costs_to_bid_and_delete), matching how the job-side ceiling has always been enforced.';

DO $$ BEGIN
  ALTER TABLE ONLY public.supply_house_invoice_bid_allocations
    ADD CONSTRAINT supply_house_invoice_bid_allocations_pkey PRIMARY KEY (invoice_id, bid_id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE ONLY public.supply_house_invoice_bid_allocations
    ADD CONSTRAINT supply_house_invoice_bid_allocations_bid_id_fkey FOREIGN KEY (bid_id) REFERENCES public.bids(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE ONLY public.supply_house_invoice_bid_allocations
    ADD CONSTRAINT supply_house_invoice_bid_allocations_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.supply_house_invoices(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_supply_house_invoice_bid_allocations_bid_id ON public.supply_house_invoice_bid_allocations USING btree (bid_id);

-- --------------------------------------------- mercury card spend allocations

CREATE TABLE IF NOT EXISTS public.mercury_transaction_bid_allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mercury_transaction_id uuid NOT NULL,
    bid_id uuid NOT NULL,
    amount numeric(18,4) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    note text,
    migrated_from_job_id uuid
);

COMMENT ON TABLE public.mercury_transaction_bid_allocations IS 'Mercury card spend split onto bids; mirror of mercury_transaction_job_allocations for pre-job (bid) work.';

DO $$ BEGIN
  ALTER TABLE ONLY public.mercury_transaction_bid_allocations ADD CONSTRAINT mercury_transaction_bid_allocations_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE ONLY public.mercury_transaction_bid_allocations
    ADD CONSTRAINT mercury_transaction_bid_allocations_tx_bid_unique UNIQUE (mercury_transaction_id, bid_id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE ONLY public.mercury_transaction_bid_allocations
    ADD CONSTRAINT mercury_transaction_bid_allocations_bid_id_fkey FOREIGN KEY (bid_id) REFERENCES public.bids(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE ONLY public.mercury_transaction_bid_allocations
    ADD CONSTRAINT mercury_transaction_bid_allocations_tx_fkey FOREIGN KEY (mercury_transaction_id) REFERENCES public.mercury_transactions(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;

-- created_by references auth.users, matching mercury_transaction_job_allocations.
DO $$ BEGIN
  ALTER TABLE ONLY public.mercury_transaction_bid_allocations
    ADD CONSTRAINT mercury_transaction_bid_allocations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_mercury_transaction_bid_allocations_bid_id ON public.mercury_transaction_bid_allocations USING btree (bid_id);

-- ------------------------------------------------------------------ row-level

ALTER TABLE public.bids_tally_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_house_invoice_bid_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mercury_transaction_bid_allocations ENABLE ROW LEVEL SECURITY;

-- bids_tally_parts / bids_materials follow the BID-CHILD pattern already used by
-- bids_count_rows: bid roles, plus the bid must be visible. auth.uid() is
-- (select …)-wrapped so it evaluates once per query as an InitPlan, per the
-- 2026-06 RLS perf work.
DO $$
DECLARE
  t text;
  cmd text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bids_tally_parts', 'bids_materials'] LOOP
    FOREACH cmd IN ARRAY ARRAY['select', 'insert', 'update', 'delete'] LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', format('bid_cost_rows_%s_%s', t, cmd), t);
    END LOOP;

    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR SELECT USING (
        (EXISTS (SELECT 1 FROM public.users u
                  WHERE u.id = (SELECT auth.uid())
                    AND u.role = ANY (ARRAY['dev','master_technician','assistant','estimator','primary']::public.user_role[])))
        AND (EXISTS (SELECT 1 FROM public.bids b WHERE b.id = %I.bid_id))
      )$p$, format('bid_cost_rows_%s_select', t), t, t);

    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (
        (EXISTS (SELECT 1 FROM public.users u
                  WHERE u.id = (SELECT auth.uid())
                    AND u.role = ANY (ARRAY['dev','master_technician','assistant','estimator','primary']::public.user_role[])))
        AND (EXISTS (SELECT 1 FROM public.bids b WHERE b.id = %I.bid_id))
      )$p$, format('bid_cost_rows_%s_insert', t), t, t);

    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR UPDATE USING (
        (EXISTS (SELECT 1 FROM public.users u
                  WHERE u.id = (SELECT auth.uid())
                    AND u.role = ANY (ARRAY['dev','master_technician','assistant','estimator','primary']::public.user_role[])))
        AND (EXISTS (SELECT 1 FROM public.bids b WHERE b.id = %I.bid_id))
      )$p$, format('bid_cost_rows_%s_update', t), t, t);

    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR DELETE USING (
        (EXISTS (SELECT 1 FROM public.users u
                  WHERE u.id = (SELECT auth.uid())
                    AND u.role = ANY (ARRAY['dev','master_technician','assistant','estimator','primary']::public.user_role[])))
        AND (EXISTS (SELECT 1 FROM public.bids b WHERE b.id = %I.bid_id))
      )$p$, format('bid_cost_rows_%s_delete', t), t, t);
  END LOOP;
END $$;

-- The two allocation mirrors match their JOB counterparts exactly: staff-role
-- only (dev / master_technician / assistant), no per-entity gate. Deliberate —
-- supply_house_invoice_job_allocations and mercury_transaction_job_allocations
-- have never gated on the job, and diverging here would make bid allocations
-- stricter than job ones for no stated reason.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['supply_house_invoice_bid_allocations', 'mercury_transaction_bid_allocations'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', format('%s_staff_select', t), t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', format('%s_staff_insert', t), t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', format('%s_staff_update', t), t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', format('%s_staff_delete', t), t);

    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.users u
                 WHERE u.id = (SELECT auth.uid())
                   AND u.role = ANY (ARRAY['dev','master_technician','assistant']::public.user_role[]))
      )$p$, format('%s_staff_select', t), t);

    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM public.users u
                 WHERE u.id = (SELECT auth.uid())
                   AND u.role = ANY (ARRAY['dev','master_technician','assistant']::public.user_role[]))
      )$p$, format('%s_staff_insert', t), t);

    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (
        EXISTS (SELECT 1 FROM public.users u
                 WHERE u.id = (SELECT auth.uid())
                   AND u.role = ANY (ARRAY['dev','master_technician','assistant']::public.user_role[]))
      )$p$, format('%s_staff_update', t), t);

    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (
        EXISTS (SELECT 1 FROM public.users u
                 WHERE u.id = (SELECT auth.uid())
                   AND u.role = ANY (ARRAY['dev','master_technician','assistant']::public.user_role[]))
      )$p$, format('%s_staff_delete', t), t);
  END LOOP;
END $$;

GRANT ALL ON TABLE public.bids_tally_parts TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.bids_materials TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.supply_house_invoice_bid_allocations TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.mercury_transaction_bid_allocations TO anon, authenticated, service_role;

-- Training-mode (users.read_only) write blocks. BOTH are required per CLAUDE.md:
-- the first (re)creates the restrictive RLS policies, the second attaches the
-- statement trigger that also stops SECURITY DEFINER RPCs.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
