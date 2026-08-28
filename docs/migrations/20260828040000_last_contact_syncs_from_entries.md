# 20260828040000_last_contact_syncs_from_entries.sql (2026-08-28, v2.2413)

Per-GC bids Phase 1 (`docs/PER_GC_BID_PLAN.md`): `bids.last_contact` becomes a DERIVED
roll-up of the communications ledger.

- Row trigger `bids_submission_entries_sync_last_contact` (fn
  `sync_last_contact_from_entries`, INVOKER rights): `bids.last_contact = max(occurred_at)`
  over the bid's `bids_submission_entries` rows **whose `contact_method` is non-blank**
  (owner decision: method-less notes never move the chase clock). NULL when only notes exist.
- Backfill: bids WITH ledger entries converge to the method-entry rule (note-bumped
  last_contacts move backward — intended; those bids honestly reappear in follow-up lenses).
  Bids with no entries keep hand-set values (trigger only fires on ledger activity).
- Function-only + one backfill UPDATE; no tables, columns, or RLS changes.

Client counterpart (same PR): Edit Bid's `BidLogContactControl` + method-conditional
hand-bumps write the identical derived value during the client-deployed → migration-pushed
window; the remaining hand-bumps are removed in the follow-up cleanup PR.
