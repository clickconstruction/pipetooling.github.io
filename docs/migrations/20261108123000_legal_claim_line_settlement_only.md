# 20261108123000 — legal_claim_line_settlement_only (v2.6697)

A claim line marked *settlement only* (punch list #171, `to-dos/legal-desk-claim/`, the owner's call of 2026-11-08 on the card's second open decision): a line the office claims in a settlement offer but not in the demand. Additive and idempotent; no new table, so no fence calls.

- **`legal_matter_claim_lines.settlement_only`** `boolean NOT NULL DEFAULT false`: every line already typed stays in the demand. The kernel (`src/lib/legal/legalClaimLines.ts`) keeps a flagged line out of the demand's figures — *How much?*, *What's left for us?*, the firm's demand, the printed packet's table — and inside the settlement figures — the claim bar's own block, *What each path nets*, the desk's and the firm's table with a chip.
- **`legal_claim_line_save(…, p_settlement_only boolean DEFAULT false)`**: the save takes the flag on add and edit. The ten-argument signature is dropped first so PostgREST resolves one candidate; the default keeps the deployed client (which sends ten arguments) working until the new one arrives.

The client reads the column and sends the argument by name, so `check:calls-ahead` labels the PR *push right after the merge*: push this file right after #171's PR 2 merges, before the Pages deploy finishes. `legal-portal` reads the column with a fallback to the old select until then. Then `npm run gen-types:linked` as its own `chore(types)` PR.
