-- Add 'primary' to user_role enum

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'primary';

COMMENT ON TYPE user_role IS 'User role enum: dev (formerly owner), master_technician, assistant, subcontractor, estimator, primary';
