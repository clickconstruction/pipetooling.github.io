-- Bids Working board: add system column "working" between inbox (0) and ready (was 1).

ALTER TABLE public.bid_working_board_columns
  DROP CONSTRAINT bid_working_board_columns_system_key_check;

ALTER TABLE public.bid_working_board_columns
  ADD CONSTRAINT bid_working_board_columns_system_key_check CHECK (
    system_key IS NULL OR system_key IN ('inbox', 'working', 'ready')
  );

COMMENT ON TABLE public.bid_working_board_columns IS
  'Per-user Kanban columns for Bids Working tab; system_key inbox/working/ready are fixed endpoints, NULL means custom.';

-- Per user who has Inbox but not yet Working: bump positions with a large offset (avoids unique
-- (user_id, position) violations during multi-row updates), insert Working at 1, then compact to 0..n-1.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT c.user_id
    FROM public.bid_working_board_columns c
    WHERE c.system_key = 'inbox'
      AND NOT EXISTS (
        SELECT 1
        FROM public.bid_working_board_columns w
        WHERE w.user_id = c.user_id
          AND w.system_key = 'working'
      )
  LOOP
    UPDATE public.bid_working_board_columns
    SET position = position + 1000000
    WHERE user_id = r.user_id
      AND position >= 1;

    INSERT INTO public.bid_working_board_columns (user_id, system_key, title, position)
    VALUES (r.user_id, 'working', 'Working', 1);

    UPDATE public.bid_working_board_columns AS col
    SET position = ranked.new_pos
    FROM (
      SELECT id, row_number() OVER (ORDER BY position ASC) - 1 AS new_pos
      FROM public.bid_working_board_columns
      WHERE user_id = r.user_id
    ) AS ranked
    WHERE col.id = ranked.id;
  END LOOP;
END $$;
