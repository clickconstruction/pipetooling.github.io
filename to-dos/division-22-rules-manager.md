# Division 22 (Copy fixtures for text): the rules manager and the unseeded sections

Status: not started, owner-gated · sources: fragments v2.2587, v2.2598, v2.2606, v2.2624, v2.2626, v2.2627

## The ask

Copy fixtures for text groups by Division 22 spec section (v2.2587) and the audit modal pins uncoded names (v2.2598). Wendi's mockup 2 showed a full rules manager.

## Shipped since the note was written

- Green rules (v2.2606) and the full-universe corrections (v2.2624) — coverage 24% → 73%.
- The gas ruling (v2.2626, migration `20260902020325_division22_gas_ruling.sql`): gas piping, GPR and regulators, meters and drops file under 23 11 23.
- The count badge the mockup put on the Export ▾ menu exists as a **Needs You card** instead (v2.2627, `d22-uncoded`); the audit modal shows the same count.

## Not built (validated 2026-09-06)

- The **rules manager UI** — `SpecSectionAuditModal.tsx` only inserts / updates an exact pin per name; there is no screen to list, edit or delete `spec_section_match_rules`.
- **RH / EDF sections remain unseeded** (`20260901181000_division22_spec_sections.sql` still says "deliberately NOT seeded"); **med gas is parked** pending its own ruling (v2.2626).

## Decision needed

Whether Wendi wants the manager at all, or pinning from the audit modal is enough. The RH / EDF / med-gas seed call is the owner's.

## Where it plugs in

- `spec_sections` / `spec_section_match_rules` tables, `src/components/bids/SpecSectionAuditModal.tsx` and its kernel in `src/lib/bids/`, the Division 22 Needs You card in `src/lib/dashboardNeedsYou.ts`.
