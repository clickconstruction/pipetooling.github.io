---
name: Division 22 rules manager
number: 2
group: ready
status: the full rules manager approved by the owner 2026-10-09 (the decisions sitting); building — PRs 1–3 of 5 (the kernel v2.5054, the archive v2.5056, the read side v2.5058)
summary: Rules manager UI; RH / EDF / med-gas seed call. Gas and the Needs You card shipped.
next: PR 4, the write side (add / edit / delete a rule with the preview; add / rename a section, refusing to delete one that has rules); then the guide and seed (PR 5).
size: M
blocker: None.
ver: coverage 73%
opinion: build — the owner picked the full manager on 2026-10-09.
---

# Division 22 (Copy fixtures for text): the rules manager and the unseeded sections

## The ask

Copy fixtures for text groups by Division 22 spec section (v2.2587) and the audit modal pins uncoded names (v2.2598). Wendi's mockup 2 showed a full rules manager.

## Shipped since the note was written

- Green rules (v2.2606) and the full-universe corrections (v2.2624) — coverage 24% → 73%.
- The gas ruling (v2.2626, migration `20260902020325_division22_gas_ruling.sql`): gas piping, GPR and regulators, meters and drops file under 23 11 23.
- The count badge the mockup put on the Export ▾ menu exists as a **Needs You card** instead (v2.2627, `d22-uncoded`); the audit modal shows the same count.

## Not built (validated 2026-09-06, re-checked 2026-09-21 and 2026-09-29 — no fragment or code since; the last commit on the audit modal or the Division 22 migrations is v2.2627)

- The **rules manager UI** — `SpecSectionAuditModal.tsx` only inserts / updates an exact pin per name; there is no screen to list, edit or delete `spec_section_match_rules`.
- **RH / EDF sections remain unseeded** (`20260901181000_division22_spec_sections.sql` still says "deliberately NOT seeded"); **med gas is parked** pending its own ruling (v2.2626).

## Decision needed

Whether Wendi wants the manager at all, or pinning from the audit modal is enough. The RH / EDF / med-gas seed call is the owner's.

## The train (approved by Punchlist 2026-10-09)

1. **The kernel** (v2.5054, `src/lib/specSectionRules.ts`): each rule's standing (deciding, shadowed or idle), the preview of a draft add / edit / delete (the names that move, coverage before and after), draft validation, the priority bands, the rules grouped by section.
2. **The archive-on-delete trigger** on `spec_section_match_rules` and `spec_sections`, before any write UI: a rule or section deleted in the manager is restorable for 90 days from Recently deleted. Today neither table has it.
3. **The manager, read side**: the Division 22 window gets three tabs, *Names* (today's audit), *Rules* (grouped by section, with each rule's standing) and *Sections*.
4. **The manager, write side**: add, edit and delete a rule with the preview before saving; add and rename a section. A section with rules cannot be deleted (its rules would go with it, `ON DELETE CASCADE`): the refusal says how many rules it holds.
5. **The guide and the seed**: the help guide, the glossary and access lines, then RH / EDF / med gas, once the owner names their sections.

## Where it plugs in

- `spec_sections` / `spec_section_match_rules` tables, `src/components/bids/SpecSectionAuditModal.tsx` and its kernel in `src/lib/bids/`, the Division 22 Needs You card in `src/lib/dashboardNeedsYou.ts`.
