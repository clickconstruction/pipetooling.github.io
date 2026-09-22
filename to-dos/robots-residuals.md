---
name: Robots residuals (client side)
group: residual
status: low
summary: Client-side leftovers only; the twins program runs from `docs/twins/HANDOFF.md`.
next: Nothing client-side; the rest is CT-side (items 1–4).
size: S
blocker: CT-side work for the rest.
ver: program in HANDOFF · directory check v2.3620
opinion: later — the CI route test shipped v2.3620; what is left waits on CountTooling.
mockup: not required — a CI route / slug test — no screen changes
---

# Robots (digital twins): client-side residuals

## What this file holds

Only the small PipeTooling-side leftovers the twins fragments deferred. Backtests, audits, shadow runs and doctrine belong to the handoff doc.

## The items (validated 2026-09-06; items 1–4 re-checked 2026-09-21 — still open: `ct-bridge` is still 51 lines with no pull, `twinScorecard.ts` has no tag aliasing, no fragment scopes Unsent-Working, the clock quick-pick or Why-we-lost)

1. **R4 — ct-bridge auto-pull** of RFI flags for linked CountTooling projects (replaces the clipboard seam; [`docs/RFI_LOOP_PLAN.md`](../docs/RFI_LOOP_PLAN.md) Phase R4, "later by design"). `supabase/functions/ct-bridge/index.ts` is 51 lines; no auto-pull in it.
2. **Per-question deep link into CountTooling at the sheet's page** (v2.2535) — needs CT-side page-param support on view links first.
3. **Twin scoping on the remaining surfaces** (v2.2500): Followup's four lenses now take `peopleBids` (v2.2893); Unsent-Working and the clock quick-pick stay unscoped and Why-we-lost queue counts still include twin bids. Build only when twin noise shows up there; metrics hygiene (`AND NOT is_digital_twin`) is the same thread in the handoff.
4. **R2-BT-1 stumbles** (v2.2806): `mint_session` returns text not JSON; control characters in responses; `src/lib/twinScorecard.ts` needs tag aliasing (FD vs FD-1); robot-book gaps (gas above 1-1/2", 2-1/2" RPZ, PEX-tier fittings, insulation) are book edits, not code. (The stale `src/lib/bids/takeoffPlacement.ts` path survives only in that fragment — no live doc uses it.)
5. ~~**Phase 4 upkeep**~~ ([`docs/DIGITAL_TWINS_PLAN.md`](../docs/DIGITAL_TWINS_PLAN.md)) — shipped v2.3620: `src/lib/twins/appDirectoryCheck.test.ts` reads every `docs/twins/*.md`, fails on a backticked path no `src/App.tsx` route serves or a `help?g=` slug with no guide; CLAUDE.md carries the line.

## Where it plugs in

- `supabase/functions/twin-mcp/`, `supabase/functions/ct-bridge/`, `src/components/bids/BidsAuditsTab.tsx`, `src/lib/bids/bidAudits.ts`, `src/lib/twinScorecard.ts`, the Bid Board scope kernel (v2.2500).
