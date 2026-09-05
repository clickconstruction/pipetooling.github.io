# Partnerships: the deal terms that exist only as off toggles

Status: owner + attorney gated · plan: [`docs/PARTNERSHIPS_PLAN.md`](../docs/PARTNERSHIPS_PLAN.md) → Out of scope / Decision 6

## Where it stands (validated 2026-09-05)

The Partnerships page and partner ledger shipped in full (v2.1903–v2.2000). `src/lib/partnerLedger/partnershipConfig.ts` models four terms that nothing is built behind: `auto_notice` (email/SMS notice delivery), the weekly **estimating cap** (§4a), the **runway floor** (§4c–f), and the **W2 transition watch** (§2b). All default false and are tested to stay so.

## Decisions before any build

- Notice delivery needs a provider decision and Texas-attorney sign-off on §8a delivery (in-app + printable is what exists).
- Cap / runway / W2 watch each want the owner to say whether the Bryan agreement still needs them.

## The plan

One scoped PR per toggle, each behind its existing config key; the ledger and statements do not change.
