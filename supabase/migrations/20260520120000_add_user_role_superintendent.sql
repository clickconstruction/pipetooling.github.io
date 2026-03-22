-- Add 'superintendent' to user_role enum

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'superintendent';
COMMENT ON TYPE user_role IS 'User role enum: dev (formerly owner), master_technician, assistant, subcontractor, estimator, primary, superintendent';
