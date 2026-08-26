# 20260826223536_checklist_due_change_ledger.sql — due-date commitment ledger (v2.2366)

New table `checklist_item_due_changes` (item FK cascade, changed_by,
changed_at, from_due, to_due; index on item+time) + SECURITY DEFINER trigger
`record_checklist_due_change` on `checklist_items` (AFTER UPDATE OF
due_date) — one row per set/move/clear, `changed_by = auth.uid()`. RLS:
SELECT mirrors the item's own visibility via an EXISTS subquery (caller's
checklist_items RLS applies inside it); no client writes. Derived
client-side: original due (first row's from_due when set, else first
non-null to_due), push count (rows moving later), net slip. INSERTs don't
ledger — an item's first commitment is captured as from_due on its first
change, so pre-feature items need no backfill. Ends with both read-only
blocks. Client (chips, modal line, Gantt strip) lands separately.
