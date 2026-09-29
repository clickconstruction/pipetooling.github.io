/**
 * The sheet strip's view of the rows (Submittals stage 3a): each row's sheet
 * as (file, page, item id) triples for the assignment kernel, and the short
 * label a row wears on a page chip.
 */
import { keptPages, type SheetAssignment, type SheetState } from './sheetAssignment'
import { formatShortDate, type SourceFile } from './submittalRevision'
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

export type FileStanding = {
  /** "none on rows yet" · "57 of 75 on rows · 18 not used" · "trimmed · 6 pages kept · Sep 15" */
  text: string
  /** Pages on rows over the file's pages, for the bar. */
  ratio: number
  tone: 'none' | 'some' | 'all' | 'clash' | 'odd'
  /** "no page names a row · not a vendor submittal?" — a dropped file the reader could not place at all. */
  hint: string | null
}

/**
 * Where a file stands, for its one line on the list (v2.4171): the pages on rows in
 * words and as a ratio, a clash named in red because Done refuses until it is settled,
 * and — for a file with nothing on rows whose pages name no row — the hint that it may
 * not be a vendor submittal at all.
 */
export function fileStanding(file: Pick<SourceFile, 'pages' | 'trimmedAt' | 'droppedPages' | 'namesRows'>, state: SheetState, fileIndex: number, clashes: number): FileStanding {
  const kept = keptPages(state, fileIndex).filter((p) => p >= 1 && p <= file.pages).length
  if (file.trimmedAt) {
    return { text: `trimmed · ${kept} page${kept === 1 ? '' : 's'} kept · ${formatShortDate(file.trimmedAt)}`, ratio: 1, tone: 'all', hint: null }
  }
  if (kept === 0) {
    const odd = file.namesRows === 0 && file.pages > 0
    return { text: 'none on rows yet', ratio: 0, tone: odd ? 'odd' : 'none', hint: odd ? 'no page names a row · not a vendor submittal?' : null }
  }
  const unused = Math.max(0, file.pages - kept)
  const bits = [`${kept} of ${file.pages} on rows`, unused === 0 ? 'all used' : `${unused} not used`]
  if (clashes > 0) bits.push(`${clashes} page${clashes === 1 ? '' : 's'} on two rows`)
  return { text: bits.join(' · '), ratio: file.pages > 0 ? kept / file.pages : 0, tone: clashes > 0 ? 'clash' : unused === 0 ? 'all' : 'some', hint: null }
}
