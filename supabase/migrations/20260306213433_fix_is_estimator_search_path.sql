-- Fix search_path for SECURITY DEFINER function to prevent search path injection
-- Ensures is_estimator() resolves public.users correctly when used in reports RLS policy

ALTER FUNCTION public.is_estimator() SET search_path = public;;
