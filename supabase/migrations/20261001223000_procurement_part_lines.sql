SET lock_timeout = '3s';

-- Submittals · the procurement log, a line per part (2026-10-01). A submittal row's parts are
-- bought one by one (bid_submittal_item_parts, 20261001200000), so the log keeps a line per part:
-- `part_key` is the part's procure_key, which follows it from revision to revision. A line with no
-- part_key is a tag's line (a row with no parts) or a hand row, as before. The one-line-per-tag
-- index is narrowed to the tag lines, and a part's line is one per bid. Additive: the column is
-- nullable and every existing line keeps reading as it did.

ALTER TABLE public.bid_procurement_items ADD COLUMN IF NOT EXISTS part_key uuid NULL;
COMMENT ON COLUMN public.bid_procurement_items.part_key IS
  'The part this line is for (bid_submittal_item_parts.procure_key); NULL = the tag''s own line or a hand row.';

DROP INDEX IF EXISTS public.uq_bid_procurement_items_bid_tag;
CREATE UNIQUE INDEX IF NOT EXISTS uq_bid_procurement_items_bid_tag ON public.bid_procurement_items (bid_id, tag) WHERE tag IS NOT NULL AND part_key IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_bid_procurement_items_bid_part ON public.bid_procurement_items (bid_id, part_key) WHERE part_key IS NOT NULL;
