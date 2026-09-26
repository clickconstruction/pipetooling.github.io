SET lock_timeout = '3s';

-- Supply-house invoices: the payment / receipt link gets its own column (v2.3843).
--
-- Supplies → Supply Houses → Apply Payment asks for an optional "Payment or receipt link…"
-- and wrote it into `link` — but `link` is the invoice's own paper (the scan the invoice form
-- saves, opened by the detail table's View), so a typed payment link replaced the invoice scan
-- on every selected bill (v2.3830 stopped a BLANK link from nulling it). The owner's call
-- (2026-09-25): keep the scan in `link` and store the payment link beside it.
--
-- Additive and idempotent; nothing reads the column until the v2.3843 client ships.
ALTER TABLE public.supply_house_invoices
  ADD COLUMN IF NOT EXISTS payment_link text;

COMMENT ON COLUMN public.supply_house_invoices.payment_link IS
  'Payment or receipt link recorded by Supply Houses → Apply Payment (v2.3843). The invoice paper stays in link.';
