-- Add 'estimator' to user_role enum

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'estimator';

COMMENT ON TYPE user_role IS 'User role enum: dev (formerly owner), master_technician, assistant, subcontractor, estimator';
