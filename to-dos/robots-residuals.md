# Robots (digital twins): client-side residuals

Status: not started · the program itself is run from [`docs/twins/HANDOFF.md`](../docs/twins/HANDOFF.md) → "Open threads, prioritized" (updated daily — do not duplicate it here)

## What this file holds

Only the small PipeTooling-side leftovers the twins fragments deferred. Backtests, audits, shadow runs and doctrine belong to the handoff doc.

## The items (validated 2026-09-05)

1. **R4 — ct-bridge auto-pull** of RFI flags for linked CountTooling projects (replaces the clipboard seam; [`docs/RFI_LOOP_PLAN.md`](../docs/RFI_LOOP_PLAN.md) Phase R4, "later by design"). `ct-bridge` exists; no auto-pull in it.
2. **Per-question deep link into CountTooling at the sheet's page** (v2.2535) — needs CT-side page-param support on view links first.
3. **Twin scoping on the remaining surfaces** (v2.2500): Followup / Unsent-Working / clock quick-pick stay unscoped and Why-we-lost queue counts still include twin bids. Build only when twin noise shows up there; metrics hygiene (`AND NOT is_digital_twin`) is the same thread in the handoff.
4. **R2-BT-1 stumbles** (v2.2806): `mint_session` returns text not JSON; control characters in responses; `scorecard.ts` needs tag aliasing (FD vs FD-1); the doc path `src/lib/bids/takeoffPlacement.ts` should read `src/lib/takeoffPlacement.ts`; robot-book gaps (gas above 1-1/2", 2-1/2" RPZ, PEX-tier fittings, insulation) are book edits, not code.
5. **Phase 4 upkeep** ([`docs/DIGITAL_TWINS_PLAN.md`](../docs/DIGITAL_TWINS_PLAN.md)): a CI test that `docs/twins/APP_DIRECTORY.md` routes and `/help?g=` slugs exist, and the CLAUDE.md line that a PR adding a page/tab touches the directory. Not built.

## Where it plugs in

- `supabase/functions/twin-mcp/`, `supabase/functions/ct-bridge/`, `src/components/bids/BidsAuditsTab.tsx`, `src/lib/bids/bidAudits.ts`, the Bid Board scope kernel (v2.2500).
