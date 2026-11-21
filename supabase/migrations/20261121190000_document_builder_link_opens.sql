SET lock_timeout = '3s';

-- The Document builder (punch list #404): who opened a link, one row an open.
--
-- A link (`document_builder_links`) kept only a count and two days: the first open and the last. Taunya asked on
-- 2026-11-21 for every open to be kept, with who it was. A person signed in to the app is named by their account.
-- A person with no account is kept by what their browser sends: the address it came from, the browser's own name
-- for itself, and the few details the page reports about the device.
--
-- Written only by the edge function `document-builder-link`, with the service role. A dev reads it. Nobody outside
-- reads it and no client writes it.

CREATE TABLE IF NOT EXISTS public.document_builder_link_opens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.document_builder_links(id) ON DELETE CASCADE,
  opened_at timestamptz NOT NULL DEFAULT now(),
  -- Who the open was, as every public page of the app tells them apart: someone outside, a signed-in teammate, or
  -- the office's own preview.
  viewer text NOT NULL CHECK (viewer IN ('outside', 'staff', 'preview')),
  -- The account, when the person was signed in to the app. Null for someone with no account.
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- The revision the open was shown.
  revision integer CHECK (revision IS NULL OR revision >= 1),
  -- Kept only for someone with no account: where the request came from and what the browser calls itself.
  client_ip text CHECK (client_ip IS NULL OR length(client_ip) <= 64),
  user_agent text CHECK (user_agent IS NULL OR length(user_agent) <= 400),
  -- What the page reported about the device, for someone with no account: its language, time zone, screen and
  -- platform. Small, and never a script-made fingerprint.
  device jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(device) = 'object' AND length(device::text) <= 2000)
);

CREATE INDEX IF NOT EXISTS document_builder_link_opens_link_idx ON public.document_builder_link_opens (link_id, opened_at DESC);
COMMENT ON TABLE public.document_builder_link_opens IS 'One row each time a Document builder link is opened (punch list #404). A signed-in person is named by user_id. Someone with no account is kept by the address the request came from, the browser''s name for itself and the device details the page reports. Written only by the edge function document-builder-link, with the service role. A dev reads it.';

ALTER TABLE public.document_builder_link_opens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.document_builder_link_opens FROM anon, authenticated;
GRANT SELECT ON TABLE public.document_builder_link_opens TO authenticated;
GRANT ALL ON TABLE public.document_builder_link_opens TO service_role;
DROP POLICY IF EXISTS document_builder_link_opens_select ON public.document_builder_link_opens;
CREATE POLICY document_builder_link_opens_select ON public.document_builder_link_opens FOR SELECT TO authenticated USING (public.is_dev());

-- Why a link ended. A link that a dev switched off stays off until a dev switches it on. A link that ended because
-- the last trade's send was taken off the page is made again by the next send. The two were one and the same until
-- now: `ended_at` alone. Null on a live link, and on a link that ended before this column.
ALTER TABLE public.document_builder_links ADD COLUMN IF NOT EXISTS ended_why text;
ALTER TABLE public.document_builder_links DROP CONSTRAINT IF EXISTS document_builder_links_ended_why_check;
ALTER TABLE public.document_builder_links ADD CONSTRAINT document_builder_links_ended_why_check
  CHECK (ended_why IS NULL OR (ended_at IS NOT NULL AND ended_why IN ('off', 'replaced', 'last_send_off')));
COMMENT ON COLUMN public.document_builder_links.ended_why IS 'Why the link ended: off (a dev switched it off), replaced (a new link was made), last_send_off (the last send of its sheet was taken off a page). Null on a live link and on one that ended before the column.';

-- The four fences every CREATE TABLE migration closes with (CLAUDE.md, DB migrations).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
