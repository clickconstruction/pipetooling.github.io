-- Helpers user_role enum value, users.helpers_service_type_ids, people.kind 'helper'.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'helpers';

COMMENT ON TYPE user_role IS 'User role enum: dev (formerly owner), master_technician, assistant, subcontractor, estimator, primary, superintendent, helpers';

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS helpers_service_type_ids uuid[] DEFAULT NULL;

COMMENT ON COLUMN public.users.helpers_service_type_ids IS
  'Service types a helpers user can associate with (Clock In, Dispatch). NULL or empty = all types.';

ALTER TABLE public.people
DROP CONSTRAINT IF EXISTS people_kind_check;

ALTER TABLE public.people
ADD CONSTRAINT people_kind_check
CHECK (
  kind IN (
    'assistant',
    'master_technician',
    'sub',
    'dev',
    'estimator',
    'primary',
    'superintendent',
    'helper'
  )
);

COMMENT ON CONSTRAINT people_kind_check ON public.people IS
  'Roster kind; primary/superintendent align with users.role; helper aligns with helpers role users.';
