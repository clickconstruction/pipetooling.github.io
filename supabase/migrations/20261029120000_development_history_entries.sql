SET lock_timeout = '3s';

-- The History look's entries (punch list #208 PR 2h, v2.6042): a dated line a person or a robot
-- keeps about something that happened on a development, at the time it happened (an email, a call,
-- a text, a visit, a letter, a note), about the site, one job, one bid or the customer. A kept line
-- never changes: there is no UPDATE policy, and a correction is a second line that says so. The app
-- writes with via = 'app' as the keeper; the dev seat's MCP wrapper (PR 2m) writes via = 'mcp' with
-- the robot's name in agent_label. The page and get_history read the body whole; the page folds it.

CREATE TABLE IF NOT EXISTS public.development_history_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id uuid NOT NULL REFERENCES public.developments(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs_ledger(id) ON DELETE SET NULL,
  bid_id uuid REFERENCES public.bids(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  happened_at timestamptz NOT NULL,
  source text NOT NULL CHECK (source IN ('email', 'call', 'text', 'on_site', 'letter', 'note')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 20000),
  author_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  via text NOT NULL DEFAULT 'app' CHECK (via IN ('app', 'mcp')),
  agent_label text,
  link_url text,
  file_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT development_history_entries_one_piece CHECK (((job_id IS NOT NULL)::int + (bid_id IS NOT NULL)::int + (customer_id IS NOT NULL)::int) <= 1)
);

COMMENT ON TABLE public.development_history_entries IS 'The Development page''s History entries (v2.6042): what happened on a site, kept at the time it happened, by a person (via app) or a robot through MCP (via mcp, agent_label). Never updated; a correction is a second line.';
COMMENT ON COLUMN public.development_history_entries.happened_at IS 'When it happened, set by the writer: the email''s time, the call''s time. created_at is when it was kept.';
COMMENT ON COLUMN public.development_history_entries.source IS 'email, call, text, on_site, letter or note: the badge and the verb on the line.';
COMMENT ON COLUMN public.development_history_entries.body IS 'What happened, in the writer''s words, whole (up to 20,000 characters); the page folds a long one, MCP reads it whole.';
COMMENT ON COLUMN public.development_history_entries.agent_label IS 'The key''s name when a robot kept it through MCP (the inbox robot); null for a person.';
COMMENT ON COLUMN public.development_history_entries.file_path IS 'Reserved: a file in a bucket (the email itself) once the Evidence-tab pattern is adopted here.';

CREATE INDEX IF NOT EXISTS development_history_entries_site_idx ON public.development_history_entries (development_id, happened_at DESC);
CREATE INDEX IF NOT EXISTS development_history_entries_job_idx ON public.development_history_entries (job_id) WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS development_history_entries_bid_idx ON public.development_history_entries (bid_id) WHERE bid_id IS NOT NULL;

ALTER TABLE public.development_history_entries ENABLE ROW LEVEL SECURITY;

-- The office team reads and keeps; nobody updates or deletes (no policy), so a kept line stands.
DO $$ BEGIN
  CREATE POLICY development_history_entries_office_read ON public.development_history_entries
    FOR SELECT TO authenticated USING (public.gc_office_team());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY development_history_entries_office_keep ON public.development_history_entries
    FOR INSERT TO authenticated WITH CHECK (public.gc_office_team() AND author_user_id = auth.uid() AND via = 'app');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT, INSERT ON public.development_history_entries TO authenticated;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
