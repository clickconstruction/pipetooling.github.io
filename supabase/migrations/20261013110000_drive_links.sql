SET lock_timeout = '3s';

-- Messages, cut 7a (v2.5372): our own links to a job's Drive files, and how each file on a line we sent went.
--
--   1) drive_links: one row per file's own link (clicktooling.com/f/<link>). It names one Drive file in one job's
--      folder and its half, Plans or Team only. It keeps the link's SHA-256, never the link. It ends 30 days after it is
--      made unless it is cut off sooner. The office team reads; the drive-link function writes, as the service role.
--   2) message_attachments (cut 6) gains how a file on a line we sent went (sent_as: the file, a link or the picture),
--      our link's row (drive_link_id), and the Drive file it is (drive_file_id): a file Save to Drive put there, or the
--      Drive file a line sent. A file that went as the file keeps its bytes in message-attachments under out/, so one
--      office page opens every file on a line.
--   3) public_page_views takes the surface drive_link: each open of our link, entity_id the drive_links row.
--   4) cut_drive_link(): the office team cuts a link off, and its open page reads the turned-off words from then on.
--   5) drive_link_views(): the office's read-back of the opens, the way customer_portal_views reads a page's: how many,
--      the last, and each open's time newest first, never who. A link cannot know who opened it, so no line names one.
-- A new table, so the three house calls end it. See docs/migrations/20261013110000_drive_links.md.

-- 1) Our links.
CREATE TABLE IF NOT EXISTS public.drive_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The link's SHA-256 in hex. The link itself is on the line it went on, never here.
  token_hash text NOT NULL
    CONSTRAINT drive_links_hash_shape CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  -- The job whose folder holds the file: a bid, a GC project or a Pipeline job, as the spine ties a line.
  bid_id uuid REFERENCES public.bids(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.gc_projects(project_id) ON DELETE CASCADE,
  jobs_ledger_id uuid REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  drive_file_id text NOT NULL
    CONSTRAINT drive_links_file_shape CHECK (drive_file_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  -- Plans opens in Drive's viewer, since that half is open to anyone with its link. Team only comes through the function.
  half text NOT NULL
    CONSTRAINT drive_links_half_known CHECK (half IN ('plans', 'team_only')),
  name text NOT NULL
    CONSTRAINT drive_links_named CHECK (length(btrim(name)) BETWEEN 1 AND 300),
  mime text,
  size_bytes bigint
    CONSTRAINT drive_links_size_counted CHECK (size_bytes IS NULL OR size_bytes >= 0),
  -- The line it went on. None: made outside a message.
  message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  made_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- Both from the same now(), so a link ends exactly 30 days after it is made.
  made_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  cut_at timestamptz,
  cut_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT drive_links_one_job CHECK (num_nonnulls(bid_id, project_id, jobs_ledger_id) = 1),
  CONSTRAINT drive_links_ends_after_made CHECK (ends_at > made_at),
  CONSTRAINT drive_links_cut_stamped CHECK (cut_by IS NULL OR cut_at IS NOT NULL)
);

COMMENT ON TABLE public.drive_links IS
  'Messages (cut 7a, v2.5372): our own link to one Drive file of one job (clicktooling.com/f/<link>), by its SHA-256 (token_hash), with the file''s half (plans opens in Drive''s viewer, team_only comes through the drive-link function), the line it went on, and when it ends (30 days) or was cut off. The office team reads; the drive-link function writes as the service role; cut_drive_link cuts one off. Its opens are public_page_views rows, surface drive_link.';

CREATE UNIQUE INDEX IF NOT EXISTS drive_links_hash ON public.drive_links (token_hash);
CREATE INDEX IF NOT EXISTS drive_links_line ON public.drive_links (message_id) WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS drive_links_bid ON public.drive_links (bid_id) WHERE bid_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS drive_links_project ON public.drive_links (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS drive_links_pipeline ON public.drive_links (jobs_ledger_id) WHERE jobs_ledger_id IS NOT NULL;

ALTER TABLE public.drive_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS drive_links_office_reads ON public.drive_links;
CREATE POLICY drive_links_office_reads ON public.drive_links FOR SELECT TO authenticated
  USING ((SELECT public.gc_office_team()));

REVOKE ALL ON TABLE public.drive_links FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.drive_links FROM authenticated;
GRANT SELECT ON TABLE public.drive_links TO authenticated;
GRANT ALL ON TABLE public.drive_links TO service_role;

-- 2) How a file on a line we sent went.
ALTER TABLE public.message_attachments ADD COLUMN IF NOT EXISTS sent_as text;
ALTER TABLE public.message_attachments ADD COLUMN IF NOT EXISTS drive_link_id uuid REFERENCES public.drive_links(id) ON DELETE SET NULL;
ALTER TABLE public.message_attachments ADD COLUMN IF NOT EXISTS drive_file_id text;

COMMENT ON COLUMN public.message_attachments.sent_as IS
  'Messages (cut 7a, v2.5372): how a file on a line we sent went: file (its bytes on the email, kept under out/ in message-attachments), link (our link or their portal''s, in url), or picture (a photo on an email). Null on a line that came in.';
COMMENT ON COLUMN public.message_attachments.drive_link_id IS
  'Messages (cut 7a, v2.5372): our link''s drive_links row, on a file that went as a file''s own link. Null for a link to their portal, which the portal''s link opens.';
COMMENT ON COLUMN public.message_attachments.drive_file_id IS
  'Messages (cut 7a, v2.5372): the Drive file this is: where Save to Drive put a file that came in, or the Drive file a line we sent carried. The job''s one list shows it once, where it lives.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'message_attachments_sent_as_known' AND conrelid = 'public.message_attachments'::regclass) THEN
    ALTER TABLE public.message_attachments ADD CONSTRAINT message_attachments_sent_as_known
      CHECK (sent_as IS NULL OR sent_as IN ('file', 'link', 'picture')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'message_attachments_sent_as_fits' AND conrelid = 'public.message_attachments'::regclass) THEN
    -- A line we sent says how each file went, and the kind agrees: a link went as a link, a file as the file or the picture.
    ALTER TABLE public.message_attachments ADD CONSTRAINT message_attachments_sent_as_fits
      CHECK (sent_as IS NULL OR (sent_as = 'link') = (kind = 'link')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'message_attachments_our_link_is_sent' AND conrelid = 'public.message_attachments'::regclass) THEN
    ALTER TABLE public.message_attachments ADD CONSTRAINT message_attachments_our_link_is_sent
      CHECK (drive_link_id IS NULL OR sent_as IS NOT DISTINCT FROM 'link') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'message_attachments_drive_file_shape' AND conrelid = 'public.message_attachments'::regclass) THEN
    ALTER TABLE public.message_attachments ADD CONSTRAINT message_attachments_drive_file_shape
      CHECK (drive_file_id IS NULL OR drive_file_id ~ '^[A-Za-z0-9_-]{10,200}$') NOT VALID;
  END IF;
END $$;
ALTER TABLE public.message_attachments VALIDATE CONSTRAINT message_attachments_sent_as_known;
ALTER TABLE public.message_attachments VALIDATE CONSTRAINT message_attachments_sent_as_fits;
ALTER TABLE public.message_attachments VALIDATE CONSTRAINT message_attachments_our_link_is_sent;
ALTER TABLE public.message_attachments VALIDATE CONSTRAINT message_attachments_drive_file_shape;

CREATE INDEX IF NOT EXISTS message_attachments_our_link ON public.message_attachments (drive_link_id) WHERE drive_link_id IS NOT NULL;

-- 3) Each open of our link is a page view. The list is main's newest, with drive_link added.
ALTER TABLE public.public_page_views DROP CONSTRAINT IF EXISTS public_page_views_surface_check;
ALTER TABLE public.public_page_views ADD CONSTRAINT public_page_views_surface_check
  CHECK (surface IN ('portal', 'estimate_terms', 'contract_accept', 'hazmat_notice', 'sub_portal', 'legal_portal', 'gc_trade_portal', 'portal_paper', 'drive_link'))
  NOT VALID;
ALTER TABLE public.public_page_views VALIDATE CONSTRAINT public_page_views_surface_check;

-- 4) The office cuts a link off.
CREATE OR REPLACE FUNCTION public.cut_drive_link(p_link_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cut timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to cut a link off.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.gc_office_team() THEN
    RAISE EXCEPTION 'Only the office cuts a link off.' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot cut a link off.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot cut a link off.' USING ERRCODE = '42501';
  END IF;
  SELECT l.cut_at INTO v_cut FROM public.drive_links l WHERE l.id = p_link_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That link is not there.' USING ERRCODE = 'P0001';
  END IF;
  -- A link cut off already stays as it was cut: the same answer, and the first person's name.
  IF v_cut IS NOT NULL THEN
    RETURN v_cut;
  END IF;
  UPDATE public.drive_links SET cut_at = clock_timestamp(), cut_by = auth.uid() WHERE id = p_link_id RETURNING cut_at INTO v_cut;
  RETURN v_cut;
END;
$$;

COMMENT ON FUNCTION public.cut_drive_link(uuid) IS
  'Messages (cut 7a, v2.5372): the office team cuts our link off (drive_links.cut_at, cut_by), and its open page reads the turned-off words from then on. A link cut off already answers its first cut. Refused for anyone outside the office, a training account, a twin and a link not there. SECURITY DEFINER: the table grants no update.';

REVOKE ALL ON FUNCTION public.cut_drive_link(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cut_drive_link(uuid) TO authenticated;

-- 5) The office reads the opens back, outside opens only, as customer_portal_views reads a page's.
CREATE OR REPLACE FUNCTION public.drive_link_views(p_link_ids uuid[])
RETURNS TABLE (
  link_id uuid,
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  opens integer,
  -- Each open's time, newest first, the newest 50.
  opened_at timestamptz[]
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.entity_id, min(v.occurred_at), max(v.occurred_at), count(*)::int,
    (array_agg(v.occurred_at ORDER BY v.occurred_at DESC))[1:50]
  FROM public.public_page_views v
  WHERE v.surface = 'drive_link'
    AND v.entity_id = ANY (coalesce(p_link_ids, '{}'::uuid[]))
    AND coalesce(v.viewer, 'outside') = 'outside'
    AND (SELECT public.gc_office_team())
  GROUP BY v.entity_id
  ORDER BY v.entity_id;
$$;

COMMENT ON FUNCTION public.drive_link_views(uuid[]) IS
  'Messages (cut 7a, v2.5372): the office''s read-back of our links'' opens: per link, the first and last outside open, how many, and each open''s time newest first (the newest 50), never who (the sent line''s chip, the message window''s Files). gc_office_team() only; anyone else gets no rows.';

REVOKE ALL ON FUNCTION public.drive_link_views(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.drive_link_views(uuid[]) TO authenticated, service_role;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
