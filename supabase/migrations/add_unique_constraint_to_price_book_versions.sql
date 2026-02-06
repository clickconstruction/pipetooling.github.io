-- Add unique constraint to price_book_versions.name to prevent duplicate price book names

-- Add unique constraint to price_book_versions.name
ALTER TABLE public.price_book_versions 
  ADD CONSTRAINT price_book_versions_name_unique UNIQUE (name);

COMMENT ON CONSTRAINT price_book_versions_name_unique ON public.price_book_versions 
  IS 'Ensures each price book version has a unique name';
