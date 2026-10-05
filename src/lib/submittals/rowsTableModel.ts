/**
 * What the rows table (Submittals step 3) draws, decided here and drawn by `SubmittalRowsTable`:
 *
 * - **Two fixed shapes.** A bid with a schedule compares each row to it (Tag · Specified ·
 *   Submitted · Status); a bid built from the takeoff has nothing to compare, so the table is
 *   Fixture · Product and parts. The shape changes only when the bid gains a schedule — never
 *   because one cell was typed — so the table does not jump.
 * - **The counts as filters**: the rows that still need a cut sheet, have no product, were sent
 *   back or have no answer yet.
 * - **Each part's answer beside the part**, or the row's own answer, or "no answer yet" once.
 * - **What is the same on every row is said once**: the one house every part comes from.
 */
import type { SubmittalPartRow } from './itemParts'
import { partHouseIds, submittedParts } from './itemParts'
import { DECISION_LABELS } from './reviewDecisions'
import { asDecision, asStatus, needsSheet, type ReviewDecision, type SubmittalItemRow } from './submittalRevision'

export type RowsTableShape = 'takeoff' | 'schedule'

/** Schedule when the bid has tags on its schedule, or any row carries what the plans specified. */
export function rowsTableShape(gcItems: ReadonlyArray<Pick<SubmittalItemRow, 'specified_manufacturer' | 'specified_model'>>, scheduleTags = 0): RowsTableShape {
  return scheduleTags > 0 || gcItems.some((it) => (it.specified_manufacturer ?? '').trim() !== '' || (it.specified_model ?? '').trim() !== '') ? 'schedule' : 'takeoff'
}

export type RowFilterKey = 'all' | 'sheet' | 'product' | 'sentBack' | 'noAnswer'
export type RowFilterChip = { key: RowFilterKey; label: string; count: number }
type FilterRow = Pick<SubmittalItemRow, 'status' | 'sheet_pages' | 'review_decision'>

const FILTER_LABELS: Record<RowFilterKey, string> = { all: 'All', sheet: 'Need a cut sheet', product: 'No product', sentBack: 'Sent back', noAnswer: 'No answer yet' }

export function rowMatchesFilter(key: RowFilterKey, it: FilterRow): boolean {
  const d = asDecision(it.review_decision)
  switch (key) {
    case 'sheet':
      return needsSheet(it)
    case 'product':
      return asStatus(it.status) === 'missing'
    case 'sentBack':
      return d === 'revise' || d === 'rejected'
    case 'noAnswer':
      return d == null
    default:
      return true
  }
}

/**
 * The chips over the table: All, then each count that is above zero. "No answer yet" is offered
 * only once some row has an answer — before that it is every row. With nothing to narrow to,
 * there are no chips at all.
 */
export function rowFilterChips(gcItems: ReadonlyArray<FilterRow>): RowFilterChip[] {
  const count = (k: RowFilterKey) => gcItems.filter((it) => rowMatchesFilter(k, it)).length
  const anyAnswer = gcItems.some((it) => asDecision(it.review_decision) != null)
  const chips = (['sheet', 'product', 'sentBack', 'noAnswer'] as const)
    .filter((k) => k !== 'noAnswer' || anyAnswer)
    .map((k) => ({ key: k, label: FILTER_LABELS[k], count: count(k) }))
    .filter((c) => c.count > 0)
  return chips.length === 0 ? [] : [{ key: 'all', label: FILTER_LABELS.all, count: gcItems.length }, ...chips]
}

export type AnswerMark = { tone: ReviewDecision; /** "Rejected" */ word: string; note: string; /** approved on the last revision, carried forward */ carried: boolean }
export type RowAnswers = {
  /** The parts the reviewer answered, by part id. */
  byPart: Map<string, AnswerMark>
  /** Some parts are answered and some are not: the others read "no answer yet". */
  mixed: boolean
  /** The row's own answer, when no part carries one. */
  row: AnswerMark | null
  /** Nothing on the row is answered: said once. */
  none: boolean
}

type AnswerPart = Pick<SubmittalPartRow, 'id' | 'on_submittal' | 'sequence_order' | 'review_decision' | 'review_note' | 'decision_source'>

const markOf = (decision: ReviewDecision, note: string | null | undefined, source: string | null | undefined): AnswerMark => ({ tone: decision, word: DECISION_LABELS[decision], note: (note ?? '').trim(), carried: source === 'carried' })

export function rowAnswers(it: Pick<SubmittalItemRow, 'review_decision' | 'review_note'> & { decision_source?: string | null }, parts: ReadonlyArray<AnswerPart>): RowAnswers {
  const shown = submittedParts(parts)
  const byPart = new Map<string, AnswerMark>()
  for (const p of shown) {
    const d = asDecision(p.review_decision)
    if (d) byPart.set(p.id, markOf(d, p.review_note, p.decision_source))
  }
  if (byPart.size > 0) return { byPart, mixed: byPart.size < shown.length, row: null, none: false }
  const d = asDecision(it.review_decision)
  if (d) return { byPart, mixed: false, row: markOf(d, it.review_note, it.decision_source), none: false }
  return { byPart, mixed: false, row: null, none: true }
}

/**
 * The one house every row's parts come from, to say once over the table instead of on each row.
 * Null when the rows use more than one house, or any row names none.
 */
export function commonHouseId(gcItems: ReadonlyArray<Pick<SubmittalItemRow, 'id' | 'supply_house_id'>>, partsOf: ReadonlyMap<string, ReadonlyArray<Pick<SubmittalPartRow, 'supply_house_id' | 'sequence_order'>>>): string | null {
  let common: string | null = null
  if (gcItems.length === 0) return null
  for (const it of gcItems) {
    const parts = partsOf.get(it.id) ?? []
    const houses = parts.length > 0 ? partHouseIds(parts) : it.supply_house_id ? [it.supply_house_id] : []
    if (houses.length !== 1) return null
    if (common == null) common = houses[0]!
    else if (common !== houses[0]) return null
  }
  return common
}

/** "Every row is Proposed" / "13 of 14 rows are Proposed" / "" — the takeoff shape says the status once. */
export function proposedWords(gcItems: ReadonlyArray<Pick<SubmittalItemRow, 'status'>>): string {
  const n = gcItems.filter((it) => asStatus(it.status) === 'proposed').length
  if (n === 0) return ''
  if (n === gcItems.length) return n === 1 ? 'The row is Proposed' : 'Every row is Proposed'
  return `${n} of ${gcItems.length} rows are Proposed`
}
