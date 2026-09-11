SET lock_timeout = '3s';

-- Cash App reconciliation (v2.3333): a fifth match rule. The owner records a payment on a
-- report and writes how the cash was split in the memo ("Cashapp 500", "CashApp in 300 and
-- 100", "-500 for motorcycle 1809.20 paid via cashapp"), so the recorded amount often differs
-- from the send while the memo names the send exactly. The matcher (src/lib/cashapp/) now reads
-- the numbers in a memo; a hit is filed with match_rule = 'memo'.

ALTER TABLE public.cashapp_transactions DROP CONSTRAINT IF EXISTS cashapp_transactions_match_rule_check;
ALTER TABLE public.cashapp_transactions ADD CONSTRAINT cashapp_transactions_match_rule_check
  CHECK (match_rule IS NULL OR match_rule IN ('id', 'amount', 'split', 'memo', 'manual'));

COMMENT ON COLUMN public.cashapp_transactions.match_rule IS
  'How the recorded link was made: id (Cash App ID found in the payment memo), amount (person + amount within the window), split (one send = 2–3 recorded payments), memo (a number in the payment memo equals the send — the owner''s split notes), manual (chosen in the queue).';
