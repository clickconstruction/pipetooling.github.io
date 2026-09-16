---
name: "Partnerships: the off toggles"
group: gated
status: owner + attorney gated
summary: >
  Notice delivery, estimating cap, W2 watch (modeled); runway floor (not modeled); the notes
  preview.
next: You + the attorney first; then one scoped PR per toggle.
size: M each
blocker: You + attorney.
ver: plan decision 6
---

# Partnerships: the deal terms that exist only as off toggles

## Where it stands (validated 2026-09-06)

The Partnerships page and partner ledger shipped in full (v2.1903–v2.2000). `src/lib/partnerLedger/partnershipConfig.ts` models three terms that nothing is built behind: `auto_notice` (§8a lapse-notice delivery), the weekly **estimating cap** (§4a, `cap`), and the **W2 transition watch** (§2b, `w2`). All default false; `UNBUILT_MODULE_KEYS` lists `cap` and `w2` so the UI can say so. The **runway floor** (§4c–f) the plan discusses is not modeled at all — no config key exists.

Also waiting (v2.2891): the "what Bryan will read" preview for partner-visible notes — gated on Will's decision 4.

## Decisions before any build

- Notice delivery needs a provider decision and Texas-attorney sign-off on §8a delivery (in-app + printable is what exists).
- Cap / W2 watch / runway floor each want the owner to say whether the Bryan agreement still needs them.

## The plan

One scoped PR per toggle, each behind its existing config key (runway gets a key first); the ledger and statements do not change.
