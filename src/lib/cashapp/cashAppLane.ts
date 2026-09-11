/**
 * What a Cash App payment's note says it is. The owner writes a word or two on each payment:
 * "Week", "Last week", "Hours" → pay; "Advance" → an advance on a future report; "Gas",
 * "Reimbursement", "Home Depot" → an expense, never pay. The note lane decides which queue a
 * payment lands in and which button is offered.
 */

export type CashAppNoteKind = 'pay' | 'advance' | 'expense'

export const EXPENSE_NOTE_KEYWORDS = [
  'gas',
  'fuel',
  'reimburs',
  'food',
  'lunch',
  'dinner',
  'home depot',
  'lowes',
  "lowe's",
  'walmart',
  'loan',
  'car',
  'truck',
  'tire',
  'oil',
  'tool',
  'parts',
  'material',
  'supplies',
  'uber',
  'hotel',
  'ticket',
  'phone',
  'secret santa',
  'gift',
] as const

export function classifyCashAppNote(note: string): CashAppNoteKind {
  const n = note.trim().toLowerCase()
  if (!n) return 'pay'
  if (EXPENSE_NOTE_KEYWORDS.some((k) => n.includes(k))) return 'expense'
  if (n.includes('advance')) return 'advance'
  return 'pay'
}

/** The stored lane on a cashapp_transactions row. */
export type CashAppLane = 'review' | 'recorded' | 'advance' | 'expense' | 'before_records' | 'not_staff' | 'ignored'

export const CASHAPP_LANE_LABEL: Record<CashAppLane, string> = {
  review: 'To review',
  recorded: 'Recorded',
  advance: 'Advance',
  expense: 'Not pay',
  before_records: 'Before records began',
  not_staff: 'Not staff',
  ignored: 'Skipped',
}
