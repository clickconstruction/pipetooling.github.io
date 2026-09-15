/**
 * The sheet strip's view of the rows (Submittals stage 3a): each row's sheet
 * as (file, page, item id) triples for the assignment kernel, and the short
 * label a row wears on a page chip.
 */
import type { SheetAssignment } from './sheetAssignment'
import type { SubmittalItemRow } from './submittalRevision'

export function itemLabel(it: Pick<SubmittalItemRow, 'tag' | 'submitted_label' | 'specified_model'>): string {
  const tag = it.tag.trim()
  if (tag) return tag
  const l = (it.submitted_label ?? '').trim()
  return l ? `accessory · ${l.length > 28 ? `${l.slice(0, 26)}…` : l}` : 'accessory'
}

/** The rows' sheets as (file, page, item id) triples — the kernel's state. */
export function assignmentsFromItems(items: ReadonlyArray<SubmittalItemRow>): SheetAssignment[] {
  const out: SheetAssignment[] = []
  for (const it of items) {
    if (it.sheet_file == null) continue
    for (const page of it.sheet_pages ?? []) out.push({ fileIndex: it.sheet_file, page, tag: it.id })
  }
  return out
}
