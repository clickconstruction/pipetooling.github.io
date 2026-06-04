-- Drop the insecure claim_dev_with_code function (hardcoded promotion code).
-- Replaced by claim-dev Edge Function which reads DEV_PROMOTION_CODE from Supabase secrets.
DROP FUNCTION IF EXISTS public.claim_dev_with_code(text);
