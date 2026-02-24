-- Fix search_path for trigger function to prevent search path injection
-- See: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
