SET lock_timeout = '3s';

-- Messages, residential R8 · 8, PR 1 (to-dos/gc-mode/messages/RESIDENTIAL_BUILD_PLAN.md → R8 on branch spike/gc-mode):
-- the estimate a customer's message became a line on. The kernel is src/lib/estimates/lineFromMessage.ts (v2.5403): a
-- line from a message joins the job's open draft estimate, or starts a new one.
--
--   * messages.estimate_id: the estimate the message became a line on. The plan named estimates.source_message_id; the
--     link moved to the message (the lead, with the owner's yes, 2026-10-12) because many messages feed one draft. A
--     column on estimates holds only the first, and a line in line_items_snapshot keeps no id of its own
--     (normalizeEstimateLineItem rebuilds each line with five fields), so a later message had nowhere to say it.
--   * ON DELETE SET NULL: a draft estimate deleted leaves its messages on the thread, unlinked. Nothing deletes a
--     message on main, so the estimate side never needs to follow one.
--   * messages_estimate: an estimate's messages, for its list of them. Not unique: many messages feed one draft.
--   * No column grant. PR 2's definer writes it with the estimate's save in one call and refuses a message that
--     already has an estimate, as cut 4b's gc_draft_change_order_from_message does for a change order.
--   * No new table, so no fence calls.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS estimate_id uuid REFERENCES public.estimates(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.messages.estimate_id IS
  'Messages (R8 · 8): the estimate this message became a line on (src/lib/estimates/lineFromMessage.ts), on the job''s open draft or a new one. Many messages may feed one estimate. Null when it became none, or its draft was deleted. Written only by the definer that saves the line, never by a client UPDATE.';

CREATE INDEX IF NOT EXISTS messages_estimate ON public.messages (estimate_id) WHERE estimate_id IS NOT NULL;
