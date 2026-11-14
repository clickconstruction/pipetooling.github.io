SET lock_timeout = '3s';

-- v2.7223 (punch list #345, PR 4): a link to a painted map.
--
-- A painted map is shown to a customer or a driver by a link that needs no sign-in: /way/<code>. The code is ten
-- letters, handed out once and kept here only as its SHA-256, as an estimate's, a First look's and a receipt's are.
-- The page reads the map through one door, the painted-map-link edge function, as the service role. Nothing
-- signed-out reads a table.
--
--   * One row a link. A map may have several: one sent to the customer, one to a driver.
--   * expires_at: a link ends by itself, ninety days after it was made. A way in is used for months.
--   * ended_at, ended_by: End this link now. An ended link, an expired one and a wrong code all read the same on the
--     page, so a guess learns nothing.
--   * opened_at, last_opened_at, open_count: whether the link was used. Not who opened it, and not from where.
--
-- Who may read a row: whoever can read the map, so the map's window can say that it is shared, since when and until
-- when. There is no code in a row to read. Nobody signed in writes one: the function writes as the service role,
-- after checking that the caller painted the map or works in the office.
--
-- Idempotent: IF NOT EXISTS, and the policy is dropped before it is made.

CREATE TABLE IF NOT EXISTS public.painted_map_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id uuid NOT NULL REFERENCES public.painted_maps(id) ON DELETE CASCADE,
  code_hash text NOT NULL CHECK (code_hash ~ '^[0-9a-f]{64}$'),
  made_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  made_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  ended_at timestamptz,
  ended_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  opened_at timestamptz,
  last_opened_at timestamptz,
  open_count integer NOT NULL DEFAULT 0 CHECK (open_count >= 0),
  CONSTRAINT painted_map_links_code_hash_key UNIQUE (code_hash)
);
CREATE INDEX IF NOT EXISTS painted_map_links_map_idx ON public.painted_map_links (map_id, made_at);

COMMENT ON TABLE public.painted_map_links IS 'Paint a map (#345): one row a link. The page at /way/<code> opens the map it names, with no sign-in, until the link is ended or its day comes. Written only by the painted-map-link edge function.';
COMMENT ON COLUMN public.painted_map_links.code_hash IS 'SHA-256 of the link''s ten-letter code. The code is handed out once and never kept.';
COMMENT ON COLUMN public.painted_map_links.expires_at IS 'When the link ends by itself: ninety days after it was made.';
COMMENT ON COLUMN public.painted_map_links.ended_at IS 'When somebody ended the link. An ended link reads on the page as a wrong code does.';
COMMENT ON COLUMN public.painted_map_links.open_count IS 'How many times the page was opened through this link. Not who opened it, and not from where.';

ALTER TABLE public.painted_map_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS painted_map_links_select ON public.painted_map_links;
CREATE POLICY painted_map_links_select ON public.painted_map_links FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.painted_maps m WHERE m.id = map_id));
REVOKE ALL ON TABLE public.painted_map_links FROM anon, authenticated;
GRANT SELECT ON TABLE public.painted_map_links TO authenticated;
GRANT ALL ON TABLE public.painted_map_links TO service_role;

-- House rules for every CREATE TABLE: training-mode blocks, the digital-twin fence and the archived seal.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
