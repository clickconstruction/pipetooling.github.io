# 20260902230000_commitment_offer_signing

**Sub-portal train — sign-to-accept work orders.**

## What it does

`step_commitments` gains:

- `offer_scope_snapshot` jsonb — frozen at offer time (`{lines: [{label, amount}], startsLabel}`): what the sub signs is exactly this scope at this price, under their Master Subcontract Agreement (§1 Work Order). Never edited after offering; re-price = withdraw + re-offer.
- `offer_expires_at` date — stale offers lapse quietly (hidden from the portal, no longer signable).
- The signature record of truth (lien-release precedent — the row stamp is authoritative, the PNG is the audit copy): `signed_at`, `signer_printed_name`, `signer_signature_mode` (`type`|`draw`), `signer_signature_storage_path` (contract-signer-signatures bucket, `commitments/<id>/<uuid>.png`), `signer_consented_at`, and — closing the gap the lien lane left — `signer_ip` + `signer_user_agent`.

No status machine changes (`declined` etc. shipped in `20260801220000_work_order_dispatch`). The portal accept path (service-role, `submit-sub-portal`) writes the signature and the `offered → accepted` transition together; the authenticated `respond_to_work_order` path is untouched.
