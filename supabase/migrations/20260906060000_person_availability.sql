SET lock_timeout = '3s';

-- v2.2930: a sub's days off. Marked on their portal ("Your days"), read by the
-- Sub Board (stripes, red outline on a booking over an off day) and the
-- dispatch Subs lanes. One row per (person, day). Written only by the
-- submit-sub-portal function (service role); the office reads.
-- Additive + idempotent.

CREATE TABLE IF NOT EXISTS public.person_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  day date NOT NULL,
  kind text NOT NULL DEFAULT 'off' CHECK (kind IN ('off')),
  note text,
  source text NOT NULL DEFAULT 'portal' CHECK (source IN ('portal', 'office')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT person_availability_person_day_key UNIQUE (person_id, day)
);

COMMENT ON TABLE public.person_availability IS
  'A sub''s days off (kind = off), marked on their portal. The office board stripes them and flags bookings over them.';

CREATE INDEX IF NOT EXISTS person_availability_day_idx ON public.person_availability (day);

ALTER TABLE public.person_availability ENABLE ROW LEVEL SECURITY;

-- Office-readable; writes go through the service-role edge function.
DROP POLICY IF EXISTS "Office can read person availability" ON public.person_availability;
CREATE POLICY "Office can read person availability" ON public.person_availability
  FOR SELECT USING (
    public.is_dev()
    OR public.is_assistant()
    OR public.is_superintendent()
    OR EXISTS (
         SELECT 1 FROM public.users u
         WHERE u.id = (SELECT auth.uid()) AND u.role IN ('master_technician', 'controller', 'estimator')
       )
  );

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
