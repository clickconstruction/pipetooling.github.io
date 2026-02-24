-- Fix search_path for SECURITY DEFINER function to prevent search path injection
-- See: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

ALTER FUNCTION public.is_assistant() SET search_path = public;
