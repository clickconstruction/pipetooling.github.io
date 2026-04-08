-- Bids "Working" tab: per-user Kanban columns and bid placements (estimator / account manager only)

CREATE TABLE public.bid_working_board_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  system_key text NULL,
  title text NOT NULL,
  position integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bid_working_board_columns_system_key_check CHECK (
    system_key IS NULL OR system_key IN ('inbox', 'ready')
  ),
  CONSTRAINT bid_working_board_columns_user_position_unique UNIQUE (user_id, position)
);

COMMENT ON TABLE public.bid_working_board_columns IS
  'Per-user Kanban columns for Bids Working tab; system_key inbox/ready are fixed endpoints, NULL means custom.';

CREATE UNIQUE INDEX bid_working_board_columns_user_system_key_unique
  ON public.bid_working_board_columns (user_id, system_key)
  WHERE system_key IS NOT NULL;

CREATE INDEX bid_working_board_columns_user_position_idx
  ON public.bid_working_board_columns (user_id, position);

CREATE TABLE public.bid_working_board_placements (
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  bid_id uuid NOT NULL REFERENCES public.bids (id) ON DELETE CASCADE,
  column_id uuid NOT NULL REFERENCES public.bid_working_board_columns (id) ON DELETE RESTRICT,
  position integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, bid_id)
);

COMMENT ON TABLE public.bid_working_board_placements IS
  'Which column a bid appears in on a user''s Working board; bids without a row are treated as Inbox in the app.';

CREATE INDEX bid_working_board_placements_user_column_position_idx
  ON public.bid_working_board_placements (user_id, column_id, position);

CREATE OR REPLACE FUNCTION public.user_is_bid_estimator_or_account_manager(bid_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bids b
    WHERE b.id = bid_uuid
      AND (b.estimator_id = auth.uid() OR b.account_manager_id = auth.uid())
  );
$$;

COMMENT ON FUNCTION public.user_is_bid_estimator_or_account_manager(uuid) IS
  'True if current user is estimator_id or account_manager_id on the bid; used by bid_working_board_placements RLS.';

CREATE OR REPLACE FUNCTION public.user_owns_working_board_column(column_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bid_working_board_columns c
    WHERE c.id = column_uuid
      AND c.user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.user_owns_working_board_column(uuid) IS
  'True if bid_working_board_columns row belongs to auth.uid(); used by placements RLS.';

ALTER TABLE public.bid_working_board_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_working_board_placements ENABLE ROW LEVEL SECURITY;

-- Columns: users manage own rows
CREATE POLICY "Users select own working board columns"
  ON public.bid_working_board_columns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own working board columns"
  ON public.bid_working_board_columns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own working board columns"
  ON public.bid_working_board_columns FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own working board columns"
  ON public.bid_working_board_columns FOR DELETE
  USING (auth.uid() = user_id);

-- Placements: own rows, assigned bid, column owned by same user
CREATE POLICY "Users select own working board placements"
  ON public.bid_working_board_placements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own working board placements"
  ON public.bid_working_board_placements FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.user_is_bid_estimator_or_account_manager(bid_id)
    AND public.user_owns_working_board_column(column_id)
  );

CREATE POLICY "Users update own working board placements"
  ON public.bid_working_board_placements FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND public.user_is_bid_estimator_or_account_manager(bid_id)
    AND public.user_owns_working_board_column(column_id)
  );

CREATE POLICY "Users delete own working board placements"
  ON public.bid_working_board_placements FOR DELETE
  USING (auth.uid() = user_id);

-- Devs can read all (support / debugging)
CREATE POLICY "Devs select any working board columns"
  ON public.bid_working_board_columns FOR SELECT
  USING (public.is_dev());

CREATE POLICY "Devs select any working board placements"
  ON public.bid_working_board_placements FOR SELECT
  USING (public.is_dev());

-- Realtime (optional multi-tab sync)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'bid_working_board_columns'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bid_working_board_columns;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'bid_working_board_placements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bid_working_board_placements;
  END IF;
END
$$;
