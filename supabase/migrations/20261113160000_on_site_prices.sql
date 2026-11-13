SET lock_timeout = '3s';

-- A site's materials: a price of the site's own (punch list #342, PR 2).
--
-- A name a crew typed on site has no page in the parts book, so it had no price anywhere on the
-- server: the one price it could carry lived in the browser that read an invoice. The site's
-- pricing window lets a person accept a price for such a row: what a supply house bill paid, or
-- a price they type. Each answer is one row here. The same table holds the answer "this row is
-- not a part to price" (scrap, tools, a mixed box), kind 'left_out', so the cover on the site's
-- Worth figure can reach the end.
--
-- A price is a READING, like a tie (on_site_part_ties): it never touches job_material_movements.
-- The on-site price rule (src/lib/materials/sitePrices.ts) reads the newest row of a row key in a
-- scope: a parts-book price checked inside 90 days first, then this, then a stale book price.
--
-- A price belongs to the site where a person accepted it: a development, or one job on no site.
-- The key is the site screen's row key (src/lib/materials/siteRollup.ts, rollKey):
-- 'id:<part id>' for a parts-book part, 'words:<the same-words fold>' for a typed name.
--
-- Reads AND writes: the roles that read the Materials desk with its money, on a scope they may
-- read. A price is money, so a role that sees a job's boxes with no money reads nothing here.
-- Insert and delete only. An answer is undone by deleting its row; nothing is ever updated.

CREATE TABLE IF NOT EXISTS public.on_site_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id uuid REFERENCES public.developments(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  row_key text NOT NULL,
  row_name text NOT NULL DEFAULT '',
  kind text NOT NULL,
  -- The price for one, as counted on site. Null for a row left out.
  unit_price numeric(14, 4),
  source text NOT NULL DEFAULT 'typed',
  -- The bill line the price was read from, when it came from a bill.
  source_line_id uuid REFERENCES public.supply_paper_lines(id) ON DELETE SET NULL,
  -- The source as it read when accepted: the supply house's name for a bill.
  source_words text NOT NULL DEFAULT '',
  -- The day the price is from: the bill's day, or the day it was typed. Stale past 90 days, as a book price is.
  priced_on date NOT NULL DEFAULT public.app_today(),
  by_user_id uuid DEFAULT auth.uid(),
  by_name text NOT NULL DEFAULT '',
  at timestamptz NOT NULL DEFAULT now(),
  -- One scope, never both and never neither. Both branches name IS NOT NULL: a CHECK passes on unknown.
  CONSTRAINT on_site_prices_scope_check CHECK (
    (development_id IS NOT NULL AND job_id IS NULL) OR (development_id IS NULL AND job_id IS NOT NULL)
  ),
  CONSTRAINT on_site_prices_kind_check CHECK (kind IN ('price', 'left_out')),
  CONSTRAINT on_site_prices_price_check CHECK (
    (kind = 'price' AND unit_price IS NOT NULL AND unit_price >= 0 AND unit_price <= 1000000)
    OR (kind = 'left_out' AND unit_price IS NULL)
  ),
  CONSTRAINT on_site_prices_source_check CHECK (source IN ('typed', 'bill')),
  CONSTRAINT on_site_prices_key_check CHECK (row_key ~ '^(id|words):.+'),
  CONSTRAINT on_site_prices_len_check CHECK (
    char_length(row_key) <= 300 AND char_length(row_name) <= 200
    AND char_length(source_words) <= 300 AND char_length(by_name) <= 120
  )
);

COMMENT ON TABLE public.on_site_prices IS
  'A site''s materials (punch list #342): a price a person accepted for a row of the site''s screen, or the answer that the row is not a part to price (kind left_out). Scope is a development or one job on no site. row_key is the screen''s row key (id:<part id> or words:<same-words fold>). The newest row of a key is the one read. A reading only; the on-site ledger is never changed. Insert and delete, never update.';
COMMENT ON COLUMN public.on_site_prices.unit_price IS 'The price for one, as counted on site. Null when kind is left_out.';
COMMENT ON COLUMN public.on_site_prices.priced_on IS 'The day the price is from: the bill''s day, or the day it was typed. The on-site price rule flags it past 90 days.';

-- The newest answer of a key in a scope is the one read.
CREATE INDEX IF NOT EXISTS on_site_prices_site_key_idx
  ON public.on_site_prices (development_id, row_key, at DESC)
  WHERE development_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS on_site_prices_job_key_idx
  ON public.on_site_prices (job_id, row_key, at DESC)
  WHERE job_id IS NOT NULL;

ALTER TABLE public.on_site_prices ENABLE ROW LEVEL SECURITY;

-- A price is money: read by the roles that may write it, on a scope they may read.
DROP POLICY IF EXISTS on_site_prices_select ON public.on_site_prices;
CREATE POLICY on_site_prices_select ON public.on_site_prices
  FOR SELECT TO authenticated
  USING (public.on_site_can_tie_parts() AND public.on_site_can_read_ties(development_id, job_id));

DROP POLICY IF EXISTS on_site_prices_insert ON public.on_site_prices;
CREATE POLICY on_site_prices_insert ON public.on_site_prices
  FOR INSERT TO authenticated
  WITH CHECK (
    by_user_id = (SELECT auth.uid())
    AND public.on_site_can_tie_parts()
    AND public.on_site_can_read_ties(development_id, job_id)
  );

DROP POLICY IF EXISTS on_site_prices_delete ON public.on_site_prices;
CREATE POLICY on_site_prices_delete ON public.on_site_prices
  FOR DELETE TO authenticated
  USING (public.on_site_can_tie_parts() AND public.on_site_can_read_ties(development_id, job_id));

REVOKE ALL ON TABLE public.on_site_prices FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.on_site_prices TO authenticated;
GRANT ALL ON TABLE public.on_site_prices TO service_role;

-- The four fences every CREATE TABLE migration closes with (CLAUDE.md → DB migrations).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
