SET lock_timeout = '3s';

-- Bid Board → Reply book (owner ask, 2026-09-28): the estimators answer GCs with the same few
-- letters — a decline for a project too far from the office, a follow-up a week after a bid
-- went out — and each of them keeps those letters somewhere of their own. One table holds the
-- wording they share:
--
--   bid_reply_book_entries — one row per reply: what it is for, its kind, the wording, and
--     whether a copy ends with "Thank you," and the copier's name (the author's name is not
--     part of the wording, so nobody sends a letter signed by someone else).
--
-- Everyone who opens the Bids page reads and posts. Only the person who posted a reply, or a
-- dev, changes or deletes it — enforced here, not only by what the window draws.
--
-- Additive. Nothing reads this until the client that follows.

-- The roles that open the Bids page (src/lib/bids/bidsTabAccess.ts → canOpenBids).
CREATE OR REPLACE FUNCTION public.can_open_bid_reply_book()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role = ANY (ARRAY['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent']::public.user_role[])
  )
$$;

COMMENT ON FUNCTION public.can_open_bid_reply_book() IS
  'True when the current user opens the Bids page (dev, master, assistant, controller, estimator, primary, superintendent): who reads and posts in the Bid Board''s Reply book.';

CREATE TABLE IF NOT EXISTS public.bid_reply_book_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- What the reply is for, e.g. "Declining: too far from the office".
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  kind text NOT NULL DEFAULT 'other' CHECK (kind IN ('declining', 'following_up', 'asking', 'after_decision', 'other')),
  -- The wording, without the sender's name.
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 4000),
  -- A copy ends with "Thank you," and the name of whoever copied it.
  sign_with_sender boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- The author's name when it was posted: it stays readable after the account is gone.
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.bid_reply_book_entries IS
  'Bid Board → Reply book: wording the estimators reuse when they answer a GC. Everyone who opens the Bids page reads and posts; the person who posted a reply, or a dev, changes or deletes it.';

CREATE INDEX IF NOT EXISTS bid_reply_book_entries_created_idx
  ON public.bid_reply_book_entries (created_at DESC);

-- The server says who posted a reply and when: the author, the author's name and the posting
-- time are stamped on insert and cannot be changed by an update.
CREATE OR REPLACE FUNCTION public.stamp_bid_reply_book_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  NEW.title := btrim(NEW.title);
  NEW.body := btrim(NEW.body, E' \t\n\r');
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.created_by := auth.uid();
    END IF;
    SELECT u.name INTO v_name FROM public.users u WHERE u.id = NEW.created_by;
    NEW.created_by_name := COALESCE(NULLIF(btrim(v_name), ''), NULLIF(btrim(NEW.created_by_name), ''), '');
    NEW.created_at := now();
    NEW.updated_at := NEW.created_at;
    NEW.updated_by := NEW.created_by;
    RETURN NEW;
  END IF;

  -- The author can be cleared (the account was removed: ON DELETE SET NULL arrives here as an
  -- UPDATE) and never handed to someone else.
  IF NEW.created_by IS NOT NULL THEN
    NEW.created_by := OLD.created_by;
  END IF;
  NEW.created_by_name := OLD.created_by_name;
  NEW.created_at := OLD.created_at;
  IF (NEW.title, NEW.kind, NEW.body, NEW.sign_with_sender)
     IS DISTINCT FROM (OLD.title, OLD.kind, OLD.body, OLD.sign_with_sender) THEN
    NEW.updated_at := now();
    NEW.updated_by := auth.uid();
  ELSE
    -- Nothing a reader sees changed: not an edit.
    NEW.updated_at := OLD.updated_at;
    IF NEW.updated_by IS NOT NULL THEN
      NEW.updated_by := OLD.updated_by;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bid_reply_book_entries_stamp ON public.bid_reply_book_entries;
CREATE TRIGGER bid_reply_book_entries_stamp
  BEFORE INSERT OR UPDATE ON public.bid_reply_book_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.stamp_bid_reply_book_entry();

ALTER TABLE public.bid_reply_book_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bid_reply_book_entries_select ON public.bid_reply_book_entries;
CREATE POLICY bid_reply_book_entries_select
  ON public.bid_reply_book_entries FOR SELECT TO authenticated
  USING (public.can_open_bid_reply_book());

DROP POLICY IF EXISTS bid_reply_book_entries_insert ON public.bid_reply_book_entries;
CREATE POLICY bid_reply_book_entries_insert
  ON public.bid_reply_book_entries FOR INSERT TO authenticated
  WITH CHECK (public.can_open_bid_reply_book() AND created_by = auth.uid());

-- The person who posted it, or a dev. An author whose role no longer opens Bids loses the door.
DROP POLICY IF EXISTS bid_reply_book_entries_update_own_or_dev ON public.bid_reply_book_entries;
CREATE POLICY bid_reply_book_entries_update_own_or_dev
  ON public.bid_reply_book_entries FOR UPDATE TO authenticated
  USING (public.is_dev() OR (created_by = auth.uid() AND public.can_open_bid_reply_book()))
  WITH CHECK (public.is_dev() OR (created_by = auth.uid() AND public.can_open_bid_reply_book()));

DROP POLICY IF EXISTS bid_reply_book_entries_delete_own_or_dev ON public.bid_reply_book_entries;
CREATE POLICY bid_reply_book_entries_delete_own_or_dev
  ON public.bid_reply_book_entries FOR DELETE TO authenticated
  USING (public.is_dev() OR (created_by = auth.uid() AND public.can_open_bid_reply_book()));

-- House rules: read-only training mode + the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
