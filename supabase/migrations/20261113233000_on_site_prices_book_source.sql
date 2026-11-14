SET lock_timeout = '3s';

-- A site's materials: a parts-book part's price, taken without the tie (punch list #342).
--
-- The pricing window offers the parts-book parts whose names fit a row. Pressing one ties the row's
-- name to that part, so the row reads the book's name as well as its price. The owner asked for a
-- second press on each offer, "Just price": take the part's price for one and leave the row's name
-- and count as the crew wrote them. That answer is a row of on_site_prices like a bill's or a typed
-- price, with its own source so the screens can say where the number came from:
--   source = 'book', source_words = the part's name as it read, priced_on = the day the book's
--   price was last checked.
--
-- One change: the source check takes 'book' beside 'typed' and 'bill'. No column, no policy and no
-- grant changes. Dropping and adding a CHECK on this table reads its rows once; the table is a few
-- days old and holds a site's answers, so the lock is brief, and lock_timeout fails it fast.

ALTER TABLE public.on_site_prices DROP CONSTRAINT IF EXISTS on_site_prices_source_check;
ALTER TABLE public.on_site_prices ADD CONSTRAINT on_site_prices_source_check CHECK (source IN ('typed', 'bill', 'book'));

COMMENT ON COLUMN public.on_site_prices.source IS
  'Where the person took the price from: typed, a supply house bill''s line (bill), or a parts-book part''s price taken without tying the name to the part (book). source_words holds the supply house for a bill and the part''s name for the book.';
