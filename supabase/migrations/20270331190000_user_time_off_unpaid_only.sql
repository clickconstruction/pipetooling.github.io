-- All time off is unpaid; backfill and restrict user_time_off.kind.

UPDATE public.user_time_off
SET kind = 'unpaid'
WHERE kind IS DISTINCT FROM 'unpaid';

ALTER TABLE public.user_time_off DROP CONSTRAINT IF EXISTS user_time_off_kind_check;

ALTER TABLE public.user_time_off
ADD CONSTRAINT user_time_off_kind_check CHECK (kind = 'unpaid');

ALTER TABLE public.user_time_off ALTER COLUMN kind SET DEFAULT 'unpaid';

COMMENT ON COLUMN public.user_time_off.kind IS 'Unpaid time off only (single allowed value).';
