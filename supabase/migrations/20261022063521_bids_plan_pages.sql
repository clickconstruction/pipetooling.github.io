SET lock_timeout = '3s';

-- Robot rounds, PR 6 (punch list #142, decision 9): the page text behind the Plans panel. One row
-- per page of a bid's plan set: the sheet number and title from the title block, the page's text
-- layer, whether it had one, and who wrote it — the round (twin-mcp put_plan_text, which writes
-- under the human bid the shell is paired to) or a person's browser (pdf.js, for a set no robot has
-- read). The panel searches these rows and the robot's read (bids_plan_substrates) at once, with
-- no model. Nothing here is money.

BEGIN;

CREATE TABLE IF NOT EXISTS public.bids_plan_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  page integer NOT NULL CHECK (page > 0),
  sheet_no text,
  title text,
  text text,
  has_text boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'browser' CHECK (source IN ('round', 'browser')),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bid_id, page)
);
CREATE INDEX IF NOT EXISTS bids_plan_pages_bid_idx ON public.bids_plan_pages (bid_id, page);
-- A text-search index for the later server-side search; the panel searches client-side today.
CREATE INDEX IF NOT EXISTS bids_plan_pages_text_idx ON public.bids_plan_pages USING gin (to_tsvector('simple', coalesce(text, '')));

ALTER TABLE public.bids_plan_pages ENABLE ROW LEVEL SECURITY;

-- The bid roles read; estimator and up write (the browser's read of a set no robot has read).
-- Twins reach it through these same policies: the fence then confines them to their own shells,
-- and twin-mcp's put_plan_text writes under the human bid with the service role.
DROP POLICY IF EXISTS "Bid pricing users can read bids_plan_pages" ON public.bids_plan_pages;
CREATE POLICY "Bid pricing users can read bids_plan_pages" ON public.bids_plan_pages FOR SELECT
  USING (EXISTS ( SELECT 1 FROM public.users
    WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role])));
DROP POLICY IF EXISTS "Bid pricing users can write bids_plan_pages" ON public.bids_plan_pages;
CREATE POLICY "Bid pricing users can write bids_plan_pages" ON public.bids_plan_pages FOR ALL
  USING (EXISTS ( SELECT 1 FROM public.users
    WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])))
  WITH CHECK (EXISTS ( SELECT 1 FROM public.users
    WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])));

COMMENT ON TABLE public.bids_plan_pages IS 'Robot rounds (v2.5736, punch list #142): one row per page of a bid''s plan set — the sheet number and title, the text layer, who read it (the round or a browser). The Plans panel searches it with the robot''s read; never money.';

-- House rules: read-only training mode + the digital-twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();

COMMIT;
