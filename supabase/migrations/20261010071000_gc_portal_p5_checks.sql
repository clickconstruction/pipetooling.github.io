SET lock_timeout = '3s';

-- GC mode, the trade partner portal's P5c-m (to-dos/gc-mode/mockups/portal-p5.md on branch spike/gc-mode): two CHECKs
-- widened for the trade's half of the job, and nothing else. No table, column, function or grant changes.
--   - gc_trade_messages keeps every email we send a company. It gains three kinds: `accepted` (we accepted its work and
--     ask for its final pay application) and `finalIn` (its final pay application came in), P5c-4's, and `punch` (an
--     item added to its punch list or sent back), which waits on the owner's yes and costs nothing until then.
--   - esign_consents keeps the words a signer agreed to. P5c-3's four signatures in the portal write a ledger row as
--     sign_sow does: `gc_draw` for a pay application, a final pay application or an unconditional waiver (keyed by the
--     draw), and `gc_trade_change` for a change order the trade signs (keyed by the change order).
-- Each CHECK is dropped and added again NOT VALID, then validated, so the scan runs without the table's write lock.
-- Doc: docs/migrations/.

ALTER TABLE public.gc_trade_messages DROP CONSTRAINT IF EXISTS gc_trade_messages_kind_known;
ALTER TABLE public.gc_trade_messages
  ADD CONSTRAINT gc_trade_messages_kind_known CHECK (kind IN (
    'invite', 'nudge', 'plans', 'bidTab', 'msa', 'sow', 'start', 'less', 'change', 'paid', 'answer',
    'coi', 'closed', 'vetted', 'preBid', 'changeAsk', 'backCharge', 'dates', 'startSoon', 'paper',
    'accepted', 'finalIn', 'punch')) NOT VALID;
ALTER TABLE public.gc_trade_messages VALIDATE CONSTRAINT gc_trade_messages_kind_known;

ALTER TABLE public.esign_consents DROP CONSTRAINT IF EXISTS esign_consents_record_type_check;
ALTER TABLE public.esign_consents
  ADD CONSTRAINT esign_consents_record_type_check
  CHECK (record_type IN ('estimate', 'job_contract', 'person_contract_document', 'step_commitment', 'bid_proposal_room', 'lien_owner_record_request', 'gc_sow', 'gc_draw', 'gc_trade_change')) NOT VALID;
ALTER TABLE public.esign_consents VALIDATE CONSTRAINT esign_consents_record_type_check;
