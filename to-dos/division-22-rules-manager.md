# Division 22 (Copy fixtures for text): the rules manager and the audit badge

Status: not started, owner-gated · sources: fragments v2.2587, v2.2598

## The ask

Copy fixtures for text groups by Division 22 spec section (v2.2587) and the audit modal pins uncoded names (v2.2598). Wendi's mockup 2 showed a full rules manager; the count badge on the menu item was shown too.

## Not built (validated 2026-09-05: no fragment since v2.2598 touches either)

- The **ledger manager UI** and the **unmatched-names audit screen** — pinned names still need a `spec_section_match_rules` table edit.
- The **count badge** on the Export ▾ menu item (needs the audit fetch before the menu opens).
- **Gas / GPR / RH / EDF sections remain unseeded** pending the owner's spec-book call.

## Decision needed

Whether Wendi wants the manager at all, or pinning from the audit modal is enough. The seed call for the four sections is the owner's.

## Where it plugs in

- `spec_sections` / `spec_section_match_rules` tables (migration v2.2580), the audit modal component and its kernel in `src/lib/bids/`, the Export ▾ menu on the Bids counts surface.
