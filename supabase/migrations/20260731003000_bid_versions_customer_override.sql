SET lock_timeout = '3s';

-- Multi-GC bids v1 (v2.1159): a bid Version may point at its own GC/Builder
-- (customer). Null = use the bid-level GC, which keeps every existing bid
-- and single-GC flow byte-identical. The cover letter groups included
-- versions by effective GC and generates one document per GC.
ALTER TABLE public.bid_versions
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
