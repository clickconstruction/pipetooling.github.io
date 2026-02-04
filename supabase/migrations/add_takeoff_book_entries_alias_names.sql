-- Takeoff book entries: optional additional names (aliases). If a count row's
-- Fixture or Tie-in matches fixture_name or any alias (case-insensitive),
-- this entry's template and stage are applied when applying the takeoff book.
ALTER TABLE public.takeoff_book_entries
  ADD COLUMN IF NOT EXISTS alias_names TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.takeoff_book_entries.alias_names IS 'Alternative fixture/tie-in names; if any of fixture_name or alias_names matches a count row, this entry applies.';
