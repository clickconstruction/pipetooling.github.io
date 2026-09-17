SET lock_timeout = '3s';

-- Punch list picks (v2.3559): the Do / Later / Drop and the note on each row of the app's
-- /punch-list board, shared by everyone who can open it. One row per to-do slug (the slug is
-- the to-do's file name, rendered into src/content/punchList.generated.ts); a pick is cleared
-- by writing '' rather than deleting, so the note and the name stay with the row.
-- Until v2.3558 the picks lived on a claude.ai artifact only one account could republish.
CREATE TABLE IF NOT EXISTS public.punch_list_picks (
  slug text PRIMARY KEY,
  pick text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT punch_list_picks_pick_check CHECK (pick IN ('', 'do', 'later', 'drop'))
);

COMMENT ON TABLE public.punch_list_picks IS
  'Punch list (/punch-list) — the shared Do / Later / Drop pick and note per to-do slug, with who last changed it. dev + master read and write (the page''s door).';

ALTER TABLE public.punch_list_picks ENABLE ROW LEVEL SECURITY;

-- The same pair that can open the page (canOpenPunchList): dev + master.
DROP POLICY IF EXISTS "Dev and master read punch_list_picks" ON public.punch_list_picks;
CREATE POLICY "Dev and master read punch_list_picks" ON public.punch_list_picks FOR SELECT
  USING (public.is_master_or_dev());
DROP POLICY IF EXISTS "Dev and master insert punch_list_picks" ON public.punch_list_picks;
CREATE POLICY "Dev and master insert punch_list_picks" ON public.punch_list_picks FOR INSERT
  WITH CHECK (public.is_master_or_dev());
DROP POLICY IF EXISTS "Dev and master update punch_list_picks" ON public.punch_list_picks;
CREATE POLICY "Dev and master update punch_list_picks" ON public.punch_list_picks FOR UPDATE
  USING (public.is_master_or_dev())
  WITH CHECK (public.is_master_or_dev());

-- Who and when are stamped on the server, whatever the client sends.
CREATE OR REPLACE FUNCTION public.punch_list_picks_stamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_by := auth.uid();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS punch_list_picks_stamp ON public.punch_list_picks;
CREATE TRIGGER punch_list_picks_stamp
  BEFORE INSERT OR UPDATE ON public.punch_list_picks
  FOR EACH ROW EXECUTE FUNCTION public.punch_list_picks_stamp();

-- House rules: read-only training mode + the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
