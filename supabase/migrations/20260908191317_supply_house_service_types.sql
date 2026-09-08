SET lock_timeout = '3s';

-- Supply house directory, PR 6 (to-dos/supply-house-directory): the trades a
-- supply house serves. A house with no rows here serves everyone (the owner's
-- ruling: an untagged house never vanishes from a restricted estimator). An
-- estimator restricted to a trade (users.estimator_service_type_ids) sees
-- houses that serve it or are untagged; the RFQ picker defaults to the bid's
-- trade the same way. Links are managed from the vendor form's "Trades
-- served" chips by the same roles that may edit the house.
--
-- Push after the v2.3173 client deploys (the client tolerates the table being
-- absent: it reads no links and writes none).

CREATE TABLE IF NOT EXISTS public.supply_house_service_types (
  supply_house_id uuid NOT NULL REFERENCES public.supply_houses(id) ON DELETE CASCADE,
  service_type_id uuid NOT NULL REFERENCES public.service_types(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (supply_house_id, service_type_id)
);

COMMENT ON TABLE public.supply_house_service_types IS
  'Trades a supply house serves (v2.3173). No rows = serves every trade. Filters the estimator directory and the RFQ picker; never hides an untagged house.';

CREATE INDEX IF NOT EXISTS supply_house_service_types_service_type_idx
  ON public.supply_house_service_types (service_type_id);

ALTER TABLE public.supply_house_service_types ENABLE ROW LEVEL SECURITY;

-- Readers: everyone who may read supply_houses (the six Materials roles).
DROP POLICY IF EXISTS supply_house_service_types_select ON public.supply_house_service_types;
CREATE POLICY supply_house_service_types_select ON public.supply_house_service_types
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.role = ANY (ARRAY[
        'dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role,
        'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role
      ])
  ));

-- Writers: the directory predicate (20260908184533).
DROP POLICY IF EXISTS supply_house_service_types_insert ON public.supply_house_service_types;
CREATE POLICY supply_house_service_types_insert ON public.supply_house_service_types
  FOR INSERT WITH CHECK (public.can_manage_supply_house_directory());

DROP POLICY IF EXISTS supply_house_service_types_update ON public.supply_house_service_types;
CREATE POLICY supply_house_service_types_update ON public.supply_house_service_types
  FOR UPDATE USING (public.can_manage_supply_house_directory())
  WITH CHECK (public.can_manage_supply_house_directory());

DROP POLICY IF EXISTS supply_house_service_types_delete ON public.supply_house_service_types;
CREATE POLICY supply_house_service_types_delete ON public.supply_house_service_types
  FOR DELETE USING (public.can_manage_supply_house_directory());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supply_house_service_types TO authenticated;

-- Seed only the houses that clearly serve one trade (the to-do's classification);
-- every other house stays untagged = visible to everyone. Idempotent.
INSERT INTO public.supply_house_service_types (supply_house_id, service_type_id)
SELECT sh.id, st.id
FROM public.supply_houses sh
JOIN public.service_types st ON st.name = 'Electrical'
WHERE btrim(sh.name) IN ('CED', 'Elliott Electric Supply')
ON CONFLICT DO NOTHING;

INSERT INTO public.supply_house_service_types (supply_house_id, service_type_id)
SELECT sh.id, st.id
FROM public.supply_houses sh
JOIN public.service_types st ON st.name = 'HVAC'
WHERE btrim(sh.name) IN ('Garner Heating & Air Conditioning')
ON CONFLICT DO NOTHING;

-- New table: (re)attach the training-mode read-only guards (both required) and the twin fence.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
