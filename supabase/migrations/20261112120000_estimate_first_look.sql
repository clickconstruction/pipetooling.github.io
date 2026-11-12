SET lock_timeout = '3s';

-- An estimate remembers the First look it came from (punch list #319 PR 5, v2.7004). Start an estimate on a look's
-- card writes the look on the new draft, so the office's editor draws the customer's photos beside the price and the
-- customer's page says the price was made from their photos. No new table, so no fence call.
--
-- The column is nullable with no default, so adding it is a catalog change. The foreign key is added NOT VALID and
-- validated in a second statement: the first takes its lock for an instant and checks no row, the second reads the
-- table without blocking writes. A look that is removed leaves the estimate as it is (ON DELETE SET NULL).

ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS first_look_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'estimates_first_look_id_fkey' AND conrelid = 'public.estimates'::regclass) THEN
    ALTER TABLE public.estimates
      ADD CONSTRAINT estimates_first_look_id_fkey FOREIGN KEY (first_look_id) REFERENCES public.first_looks(id) ON DELETE SET NULL NOT VALID;
  END IF;
END;
$$;

ALTER TABLE public.estimates VALIDATE CONSTRAINT estimates_first_look_id_fkey;

COMMENT ON COLUMN public.estimates.first_look_id IS
  'First look (punch list #319 PR 5): the look this estimate was started from, when it was started on a look''s card. The office''s editor draws its photos; the customer''s page says the price was made from them.';

CREATE INDEX IF NOT EXISTS estimates_first_look_idx ON public.estimates (first_look_id) WHERE first_look_id IS NOT NULL;
