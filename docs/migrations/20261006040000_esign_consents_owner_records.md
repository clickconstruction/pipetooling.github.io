# 20261006040000_esign_consents_owner_records.sql (2026-10-06, v2.4650)

Records for an owner, signed on their portal (punch list #86, PR 1). `esign_consents.record_type` accepts a sixth kind, `lien_owner_record_request`, so the `sign-owner-records` function can file the owner's e-sign consent for the acknowledgment on the same ledger the contract, estimate, work-order and bid-room signatures use. Additive: the constraint is dropped and re-added with the new name in the list; no row changes. No order coordination: the client never writes this table.
