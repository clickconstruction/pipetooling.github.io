# 20261109200000_po_code_read_by_its_person.sql (2026-11-09, v2.6815)

Punch list #295, PR 2: the ticket sheet's first chip is the PO code the office made for this person today. `material_po_generator_entries` was read by the office alone, so two narrow read policies are added:

- **`material_po_generator_entries_select_for_its_person`**: a row is also read by the person it was made for (`for_user_id = auth.uid()`).
- **`supply_houses_select_by_my_po_code`**: a supply house is also read by a person a PO code names it for, so the chip says the house's name. A house no code of theirs names stays closed to them.

Policies only: no table is created, so no fence call. Harmless on either side of the Pages deploy; before the push the sheet reads no code and offers the clocked job first. A code whose job the person cannot read under `jobs_ledger`'s own policies is left off the sheet. The bed `test:pg:counter-tickets` holds both policies.

**Applied** to prod by 2026-11-10, read the same day through `npm run check:migration-drift`: 1216 local files against 1216 remote versions, fully applied, this one among them.
