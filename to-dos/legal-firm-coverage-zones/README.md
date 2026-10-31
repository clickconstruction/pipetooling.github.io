---
name: "Firms and their coverage: the firm window shows where a firm covers, extends it, hands counties off to another firm, and two firms may share a county"
number: 222
group: close
status: proposed 2026-10-30 · mock-up drawn the same day · the owner asked for the whole train on 2026-10-31, on the defaults this card names · PR 1 built as v2.6195 · PR 2 built as v2.6221 · PR 3 built as v2.6227 · PR 4 built as v2.6233 · all four built; the PR 3 and PR 4 migrations are pushed right after their merges
mockup: to-dos/legal-firm-coverage-zones/mockup.html
summary: >
  The Legal desk's firm window holds a firm's details, Click's particulars and, at the bottom, Replace with a new
  firm…, which retires the firm everywhere and adds a successor with no counties; coverage lives on a separate
  county picker under Firms…, one firm per county. The owner (2026-10-30) did not understand Replace and asked for
  three things: show where a firm appears on the map, replace a firm for a coverage zone rather than everywhere,
  and let a firm's zone be extended, with two firms allowed to share a zone. This card reshapes the window around
  coverage (the real county map with the firm's counties lit, a list with each county's cases and dollars, Extend
  coverage…, Hand off counties…, Show on the desk map), turns Replace into a hand-off of chosen counties to an
  existing or new firm in one transaction with retire as a separate last step, and lets several firms cover one
  county with one first-call firm per county that the office can switch at release. It also names a cliff the
  live app has today: one firm, no county colored, so the first county colored for anyone ends the bridge and
  every other account loses its firm.
next: The two migration pushes right after their merges, then the owner colors Snell's counties (the bridge nudge) and the card closes.
size: L as a train of four (M, M, L+migration, M+migration); one migration for shared coverage, one for the hand-off RPC; no edge function change
blocker: The db pushes for PRs 3 and 4, right after each merge, by the person who pushes.
ver: proposed
opinion: build — the window answers "where does this firm cover" today with nothing, Replace orphans a territory, and the one-firm-per-county rule is ours, not the owner's; PR 1 first because the bridge cliff is live
---

# Firms and their coverage (#222)

## The ask

The owner, 2026-10-30, with the firm window open on Snell Law Firm: *"I don't totally understand the 'replace with a
new firm' as in this part of the app I was thinking we should do a better job showing where a firm appears on the map
and if we're going to replace someone replace them for that coverage zone. I think we should be able to extend coverage
zones for firms and it is okay if multiple firms have the same coverage zones. Help me mock up how this could look,
then ask yourself: is this the best we can do? Present what you think we should build to offer a better flow in this
modal."*

## What exists today, and what this rides on

- **Coverage is counties, one firm per county** (punch list #144, v2.5756–v2.5862): `legal_firm_counties` holds one
  live row per county (`until IS NULL`, held by `legal_firm_counties_live_county_uidx`); a dev colors counties for a
  firm on Settings → Jobs & billing → Collections law firms (`LegalFirmSettingsBlock`, `LegalFirmCountyMap`,
  `firmCounties.ts`: `pressCounty` answers `held` on another firm's county and the screen asks before `moveCounty`);
  the same block opens over the desk under **Firms…** (`LegalFirmsWindow`). The desk picks an account's firm from its
  venue county (`firmForAccount.ts`): a two-county account offers a switch (`others`, `switched`); a county nobody
  covers yields no firm and a held release; while no county at all is colored and one firm stands, that firm takes
  every account (the bridge). The desk's **Map** view (`LegalDeskMapView`) and the portal's **Who covers what**
  (`LegalPortalCoverage`, counts only) draw the same map.
- **The firm window** (`LegalFirmWindow`, opened from the header's firm chip): the firm's intake answers, the details
  form (`LegalFirmCard bare`), the facts chips, Click's particulars for filing, and `LegalFirmReplacePanel`.
- **Replace** (`legal_replace_firm`, v2.4712): retires the old firm (`active = false`, `paused_at`, link revoked) and
  inserts the new one in one transaction; refused while an account is with the old firm. It does not touch
  `legal_firm_counties`, and `liveFirmCountyRows` counts a retired firm's counties as uncovered, so every account in
  them reads *No firm covers … County* with its release held until a dev colors them again.
- **The live database on 2026-10-30:** one firm (Snell Law Firm, PLLC), zero rows in `legal_firm_counties`. The
  desk runs on the bridge, and the header reads *Snell Law Firm, PLLC · no counties colored yet*.

## The decision

**The firm window is reshaped around coverage, Replace becomes a hand-off of chosen counties, and a county may have
several firms with one first call.** Drawn in `mockup.html`, one made-up pair of firms through every frame.

1. **Where this firm covers, first.** Under the facts chips: the real county map in lens mode with this firm's
   counties in its hue, other firms' counties faint, a shared county striped, the cases as dots and the desk Map's
   red flag on a county with a case and no firm; beside it a list, one row per county, with *first call* or *also
   covers*, the cases and the open dollars; under it **Extend coverage…**, **Hand off counties…** and **Show on the
   desk map ↗** (the Map view with this firm's legend row pressed: its counties lit, the rest faint). The window's
   title is the firm's name. The details form and Click's particulars fold to one line each with a door (the
   particulars are Click's, shared by every portal, and only look like the firm's when they sit open). Retire is the
   last section.
2. **The bridge cliff gets a warning before it happens.** With no county colored for any firm, the section reads
   *Snell takes every account today, by default*, says that the first county colored for anyone ends that, and offers
   **Color Snell's counties…** with the area presets. PR 1, before anything else, because the cliff is live.
3. **Extend coverage from the window.** The window's map becomes the Settings picker with this firm fixed and no card
   list: a free county colors, the firm's own county clears, a county another firm covers asks three ways (*Share it*
   — both cover, the other stays first call; *Make this firm first call*; *Move it*, today's only answer). Nothing
   writes until **Save N counties**. **Add by area** chips color a metro's counties in one press (Austin area, San
   Antonio area, the others the owner names) plus *every county with a case and no firm*, the Map view's gap list.
   The Settings picker gains the same three-way question so the two doors agree.
4. **Hand off counties replaces Replace.** A sheet in three steps: which of this firm's counties (ticks, with each
   county's cases and dollars; All / None), to whom (an active firm, or a new firm typed in the sheet), and what
   happens (new releases in those counties go to the receiver, which becomes first call there; what the giver keeps;
   the matters that stay with the giver by name; the accounts under review whose firm changes). The button carries
   the count and the receiver (*Hand off 2 counties to Alamo*), dead with its reason until both are picked. When the
   giver is left with no county, the sheet offers **Retire it too**, held with its reason while a live matter remains.
   One RPC, `legal_hand_off_counties`, in one transaction. **A live matter never moves with a hand-off** (#144's
   decision 3 stands; moving a matter is the receiving firm's consent and its own card).
5. **Shared counties with one first call.** The one-firm-per-county index goes; `legal_firm_counties` gains
   `first_call boolean`, exactly one live first call per covered county (a partial unique index). First call defaults
   to the firm that has covered the county longest; a dev sets another on the held-county question or the list. The
   header chip reads *Alamo Collections Law, PLLC · Comal County · Snell also covers* with the switch segment
   *⇄ Snell instead*; the venue line names both; the release sheet lists every firm covering the county with its fee
   model and what Click keeps, the first call picked; the pick lands on `legal_matters.firm_id` as today. The Map view
   and the portal's Who covers what draw a shared county striped and name the sharing in the counties line; the portal
   stays counts only.
6. **Retire stays retire**, dead with its reason and its door while the firm covers a county or holds a live matter;
   ready, it says what stops and what stays.

Rejected: freehand zones (venue is the county; #144); a per-county split between firms; letting a firm claim counties
on its portal; a Replace that moves live matters without consent; tabs in the window (folds show the facts, tabs hide
them); showing another firm's case names in a shared county (counsel's confidentiality call is still open).

## Where it plugs in

- `src/components/jobs/legal/LegalFirmWindow.tsx` — the title, the coverage section, the folds, Retire last;
  `LegalFirmReplacePanel.tsx` retired in favor of a `LegalFirmHandOffSheet.tsx`; `LegalFirmSettingsBlock.tsx` and
  `LegalFirmCountyMap.tsx` reused in `inWindow` pick mode with a fixed firm and the three-way held question.
- `src/lib/legal/firmCounties.ts` — assignments become county → firms with a first call (`CountyCoverage`), the press
  answers `share` / `first_call` / `move`, the write plan carries `first_call`; area presets as one constant with the
  counties by metro (`firmAreaPresets.ts`), the gap list from `firmMap.ts`'s `uncoveredCounties`.
- `src/lib/legal/firmForAccount.ts` — `covered` carries the county's other firms as `others`; `firmSegmentWords`,
  `venueLineWords`, the release sheet's words; `legalParties.ts`'s venue cell unchanged.
- `src/components/jobs/legal/LegalDeskMapView.tsx`, `LegalCountyContentsCard.tsx` — the striped county, the pressed
  legend row (`?firm=` from the window's Show on the desk map), the counts with a shared county.
- `supabase/functions/_shared/legalFirmCoverage.ts` and `legal-portal` — shared counties in the counts-only shape;
  `LegalPortalCoverage.tsx` names the sharing.
- Migrations: `first_call` and the index change; `legal_hand_off_counties(p_from_firm, p_to_firm, p_new_firm jsonb,
  p_counties text[], p_retire boolean)`.
- Docs: `docs/ACCESS_CONTROL.md` if the controller may extend and hand off; `PROJECT_DOCUMENTATION.md`'s firm window
  section; the guide `review-a-collections-account-before-it-goes-to-your-attorney` (the firm window and Firms…).

## The plan

- **PR 1 — Where this firm covers (M, no migration).** The window's title and coverage section over the existing
  kernels and the map in lens mode; the counties list with cases and dollars; Show on the desk map with the pressed
  legend row; the no-counties nudge with the area presets (presets write through today's save plan); the folds; Retire
  as the last section, dead with reason. The old Replace panel stays until PR 4.
- **PR 2 — Extend coverage from the window (M, no migration).** The picker in the window with the firm fixed; the
  area presets as picks; Save N counties; the held county still asks move-only until PR 3.
- **PR 3 — Shared coverage (L, migration + edge).** `first_call`, the index change, the kernels, the three-way held
  question in both pickers, the chip, the switch, the release sheet's chooser, the Map view's stripes and counts,
  the portal's counts-only sharing. Push right after the merge: the client reads `first_call`.
- **PR 4 — Hand off counties (M, migration).** The RPC in one transaction, the sheet, retire from the sheet when
  nothing is left; `LegalFirmReplacePanel` retired and `legal_replace_firm` left in place for a release.
- **Later, its own card:** move a live matter between firms with the receiving firm's consent on its portal.

## How to verify

- **PR 1.** Open the firm window on a dev login: the title is the firm's name; the map shows its counties lit and the
  list's cases and dollars match the Map view's legend row; Show on the desk map lands on the Map view with that row
  pressed; with zero colored counties the nudge shows and an area chip colors its counties on Save; the details and the
  particulars fold and open; Retire is dead with the reason naming the counties and the live matter.
- **PR 2.** Extend coverage: a free county colors, the firm's own clears, another firm's asks; Save N counties writes
  the same rows the Settings picker writes; another tab's earlier save reads *Another tab saved a county first*.
- **PR 3.** Two firms on one county: the chip names the first call and the other; the switch segment and the release
  sheet offer the other with its fee model; the matter lands on the picked firm; the Map view and the portal draw the
  stripe; the migration's push after the merge is the only moment the client reads a column prod lacks.
- **PR 4.** Hand off 2 counties: the receiver is first call there, the giver keeps the rest, the named matters stay,
  the accounts under review in those counties read the receiver; All to a new firm with Retire ticked retires the
  giver only when it holds no live matter; a refusal names the matter.
- Every sentence a first-timer reads passes `plainWordsFailures`; `check:batch-words`, `check:empty-words`,
  `check:error-words`, `check:dead-press` and `theme-tokenize --check` pass.

## Still open, with the default the build takes

1. **First call in a shared county:** the longest-standing firm with a dev override (default), or a pick at every
   release.
2. **Live matters on a hand-off:** stay with the old firm (default), or move with the receiving firm's consent.
3. **The window's order:** coverage, details folded, particulars folded, retire last (default).
4. **Area presets:** Austin and San Antonio drawn; the owner names the rest, or none.
5. **The live database:** PR 1 colors Snell's counties for the owner the day it ships, or she clicks them herself
   (default: the nudge and the presets, no data change in the PR).
6. **Who may extend and hand off:** a dev only, as every firm write today (default), or the controller too.

## Where it stands

Proposed 2026-10-30 with the mock-up; on 2026-10-31 the owner asked for the whole train ("I really like this,
please help me build it"), so the defaults under *Still open* stand.

- **PR 1, v2.6195** (`docs/recent-features/v2.6195.md`): the window opens on where the firm covers, with the bridge
  nudge, the folds and the firm lit on the Map.
- **PR 2, v2.6221** (`docs/recent-features/v2.6221.md`): Extend coverage in the window, the area presets and the gap
  chip, one save path shared with the Settings picker, and the warning over the first save that names the accounts in
  review it would leave with no firm.
- **PR 3, v2.6227** (`docs/recent-features/v2.6227.md`): shared counties with one first call, the three-answer sheet, the
  stripes, the switch and the release sheet's chooser, and `legal_save_county_coverage` as the one write. The portal needed
  no edge change: its payload already lists each firm's counties, and the page names a shared county.
- **PR 4, v2.6233** (`docs/recent-features/v2.6233.md`): Hand off counties (`legal_hand_off_counties`) in place of Replace for a
  firm that covers counties, Retire as its own step (`legal_retire_firm`, never the only firm), Replace kept for a firm that
  covers no county, the bridge's stand-in.
