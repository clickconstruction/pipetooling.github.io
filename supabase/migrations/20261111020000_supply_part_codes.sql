SET lock_timeout = '3s';

-- v2.6901 — House numbers: what each supply house calls a part (punch list #308 PR 2;
-- docs/migrations/20261111020000_supply_part_codes.md).
--
-- The parts book knows a part by its name alone, and every supply house writes the name its own way, so a part the
-- search misses gets made a second time. Each house prints its own number for a part on every quote and every bill.
-- This table keeps that number against the part, once, so the next paper from that house finds the part with no
-- press. It is the crosswalk punch list #298 designed as its stage 2 (to-dos/supply-bill-lines/README.md), built here
-- first because a quote teaches sixty numbers in one sitting.
--
--   * supply_part_codes — one row per house and number: the number as printed, a folded key (letters and digits only,
--     upper case, so 77120-B and 77120B are one number), the part it means, or the mark that the number is not a part
--     at all (a house's catch-all code for anything it does not stock), how many of the book's units one of the
--     house's prices covers (100 when the house prices by the hundred and the book by the each, 10 for a ten foot
--     stick against a foot), who taught it, where from, and the paper line it was taught on. One number means one
--     thing at a house; a part may carry several numbers.
--   * may_edit_parts_book() — the role list every parts book policy already repeats, as one function, so this table
--     and the price sheet RPCs that follow ask one question.
--
-- The roles that edit the parts book read and write. Additive and idempotent. One table is new, so the four fence
-- appliers run at the end.

CREATE OR REPLACE FUNCTION public.may_edit_parts_book()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.role = ANY (ARRAY['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent']::public.user_role[])
  );
$$;

COMMENT ON FUNCTION public.may_edit_parts_book() IS
  'True when the caller is one of the roles that edit the parts book (the list the material_part_prices policies carry). Punch list #308.';

REVOKE ALL ON FUNCTION public.may_edit_parts_book() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.may_edit_parts_book() TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.supply_part_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  supply_house_id uuid NOT NULL REFERENCES public.supply_houses(id) ON DELETE CASCADE,
  -- The number as the house prints it.
  code text NOT NULL,
  -- Letters and digits only, upper case: the form two spellings of one number share (foldCode in partMatch.ts).
  code_key text GENERATED ALWAYS AS (upper(regexp_replace(code, '[^A-Za-z0-9]', '', 'g'))) STORED,
  part_id uuid REFERENCES public.material_parts(id) ON DELETE CASCADE,
  -- A house's catch-all number (anything it does not stock, a freight line that prints a code): never matched.
  not_a_part boolean NOT NULL DEFAULT false,
  -- How many of the book's units one of the house's prices covers. The book's price is the house's price over this.
  unit_factor numeric(14, 6) NOT NULL DEFAULT 1,
  taught_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  -- Where the number came from: typed on the part, read out of the part's name or notes, a price sheet, a bill.
  taught_from text NOT NULL DEFAULT 'typed',
  taught_line_id uuid REFERENCES public.supply_paper_lines(id) ON DELETE SET NULL,
  CONSTRAINT supply_part_codes_key_not_empty CHECK (code_key <> ''),
  CONSTRAINT supply_part_codes_part_or_not CHECK ((part_id IS NOT NULL) <> not_a_part),
  CONSTRAINT supply_part_codes_unit_factor_positive CHECK (unit_factor > 0),
  CONSTRAINT supply_part_codes_taught_from CHECK (taught_from IN ('typed', 'name', 'notes', 'sheet', 'bill')),
  CONSTRAINT supply_part_codes_house_key UNIQUE (supply_house_id, code_key)
);

COMMENT ON TABLE public.supply_part_codes IS
  'House numbers (punch list #308 PR 2; the crosswalk of #298 stage 2): what each supply house calls a part. One row per house and number — the number as printed, its folded key, the part it means or the mark that it is not a part, how many book units one house price covers, who taught it and where from. One number means one thing at a house; a part may carry several. The parts book roles read and write.';

CREATE INDEX IF NOT EXISTS supply_part_codes_part_idx ON public.supply_part_codes (part_id) WHERE part_id IS NOT NULL;

ALTER TABLE public.supply_part_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supply_part_codes_read ON public.supply_part_codes;
CREATE POLICY supply_part_codes_read ON public.supply_part_codes
  FOR SELECT TO authenticated USING ((SELECT public.may_edit_parts_book()));

DROP POLICY IF EXISTS supply_part_codes_insert ON public.supply_part_codes;
CREATE POLICY supply_part_codes_insert ON public.supply_part_codes
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.may_edit_parts_book()));

DROP POLICY IF EXISTS supply_part_codes_update ON public.supply_part_codes;
CREATE POLICY supply_part_codes_update ON public.supply_part_codes
  FOR UPDATE TO authenticated USING ((SELECT public.may_edit_parts_book())) WITH CHECK ((SELECT public.may_edit_parts_book()));

DROP POLICY IF EXISTS supply_part_codes_delete ON public.supply_part_codes;
CREATE POLICY supply_part_codes_delete ON public.supply_part_codes
  FOR DELETE TO authenticated USING ((SELECT public.may_edit_parts_book()));

REVOKE ALL ON TABLE public.supply_part_codes FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.supply_part_codes TO authenticated;
GRANT ALL ON TABLE public.supply_part_codes TO service_role;

-- The four fences every CREATE TABLE migration closes with (CLAUDE.md → DB migrations).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
