/**
 * Partner ledger journal kernel (PARTNERSHIPS_PLAN.md PR 3).
 *
 * Merges the pay-stub spine (stubs + additional lines + deductions + payments)
 * and still-pending offsets into one dated journal with a running balance —
 * the Partnerships → Ledger tab and (PR 4) the partner's own ledger card both
 * shape their rows here. Append-only philosophy: the journal is a VIEW over
 * postings; nothing here mutates.
 */

export type JournalStub = {
  id: string
  period_start: string
  period_end: string
  hours_total: number
  gross_pay: number
}
export type JournalAdditionalLine = { pay_stub_id: string; description: string; line_total: number }
export type JournalDeduction = { pay_stub_id: string; description: string; amount: number }
export type JournalPayment = { pay_stub_id: string; amount: number; paid_at: string; memo: string | null }
export type JournalPendingOffset = {
  id?: string
  type: string
  amount: number
  occurred_date: string
  description: string | null
}

export type JournalRow = {
  /** ISO date the row is booked under */
  date: string
  label: string
  detail: string | null
  /** signed amount: earnings +, deductions/payouts − */
  amount: number
  /** running balance AFTER this row */
  balance: number
  kind: 'labor' | 'addition' | 'deduction' | 'payout'
  pay_stub_id: string | null
  /** person_offsets id when the row came from a dated charge — the drill-in key */
  offset_id: string | null
  /** labor rows only: the hours behind the amount, so renderers can compose a
   * short label ("Labor · 12.86 h") without re-parsing `label` (v2.2116) */
  hours?: number | null
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Offset types that ADD to what the partner is owed. */
export const POSITIVE_OFFSET_TYPES = new Set(['profit_share', 'employee_credit'])

/** A dated charge (or credit) booked directly at its own date — the
 * charges-at-date convention: an offset hits the balance when it happened,
 * not when a statement later lists it. Signed amount (charges −). */
export type JournalCharge = { date: string; label: string; amount: number; offset_id?: string }

/**
 * Build the dated journal, oldest first, with a running balance.
 * Ordering inside a stub's period: labor → additions → deductions (booked on
 * period_end), then payments on their own dates. `charges` book at their own
 * date with kind 'deduction' (or 'addition' when positive).
 */
export function buildPartnerJournal(input: {
  stubs: JournalStub[]
  additional: JournalAdditionalLine[]
  deductions: JournalDeduction[]
  payments: JournalPayment[]
  charges?: JournalCharge[]
}): { rows: JournalRow[]; balance: number } {
  const events: Omit<JournalRow, 'balance'>[] = []
  for (const c of input.charges ?? []) {
    if (!Number.isFinite(c.amount)) continue
    events.push({
      date: c.date,
      label: c.label,
      detail: null,
      amount: round2(c.amount),
      kind: c.amount >= 0 ? 'addition' : 'deduction',
      pay_stub_id: null,
      offset_id: c.offset_id ?? null,
    })
  }
  const stubsAsc = [...input.stubs].sort((a, b) => a.period_start.localeCompare(b.period_start))
  for (const s of stubsAsc) {
    events.push({
      date: s.period_end,
      label: `Labor — ${s.hours_total.toFixed(2)} h (week of ${s.period_start})`,
      detail: null,
      amount: round2(s.gross_pay),
      kind: 'labor',
      pay_stub_id: s.id,
      offset_id: null,
      hours: round2(s.hours_total),
    })
    for (const a of input.additional.filter((x) => x.pay_stub_id === s.id)) {
      events.push({
        date: s.period_end,
        label: a.description || 'Addition',
        detail: null,
        amount: round2(a.line_total),
        kind: 'addition',
        pay_stub_id: s.id,
        offset_id: null,
      })
    }
    for (const d of input.deductions.filter((x) => x.pay_stub_id === s.id)) {
      events.push({
        date: s.period_end,
        label: d.description || 'Deduction',
        detail: null,
        amount: -round2(d.amount),
        kind: 'deduction',
        pay_stub_id: s.id,
        offset_id: null,
      })
    }
  }
  const paymentsAsc = [...input.payments].sort((a, b) => a.paid_at.localeCompare(b.paid_at))
  for (const p of paymentsAsc) {
    events.push({
      date: p.paid_at.slice(0, 10),
      label: 'Paid out',
      detail: p.memo,
      amount: -round2(p.amount),
      kind: 'payout',
      pay_stub_id: p.pay_stub_id,
      offset_id: null,
    })
  }
  // Stable merge by date; same-date rows keep insertion order (labor before
  // additions before deductions; payouts after their stub when same-dated).
  const kindOrder: Record<JournalRow['kind'], number> = { labor: 0, addition: 1, deduction: 2, payout: 3 }
  events.sort((a, b) => a.date.localeCompare(b.date) || kindOrder[a.kind] - kindOrder[b.kind])
  let bal = 0
  const rows: JournalRow[] = events.map((e) => {
    bal = round2(bal + e.amount)
    return { ...e, balance: bal }
  })
  return { rows, balance: bal }
}

/** Pending (unattached) offsets shown separately from the journal. */
export function summarizePendingOffsets(pending: JournalPendingOffset[]): {
  count: number
  net: number
} {
  let net = 0
  for (const o of pending) {
    if (!Number.isFinite(o.amount)) continue
    net += POSITIVE_OFFSET_TYPES.has(o.type) ? o.amount : -o.amount
  }
  return { count: pending.length, net: round2(net) }
}

/** Signed amount of one pending offset (charges −, credits/shares +). */
export function pendingOffsetSignedAmount(o: JournalPendingOffset): number {
  if (!Number.isFinite(o.amount)) return 0
  return round2(POSITIVE_OFFSET_TYPES.has(o.type) ? o.amount : -o.amount)
}

/**
 * The settle-up position: posted journal balance plus offsets that haven't
 * reached a statement yet. This is the headline number — the journal's
 * running-balance column stays posted-only.
 */
export function netPosition(postedBalance: number, pendingNet: number): number {
  return round2(postedBalance + pendingNet)
}

/** A pending offset rendered inline in the journal: dated, signed, but with no
 * running balance — it moves nothing until a statement attaches it. */
export type PendingJournalRow = {
  date: string
  label: string
  detail: string | null
  amount: number
  balance: null
  kind: 'pending'
  pay_stub_id: null
  /** person_offsets id backing this pending row — the drill-in key */
  offset_id: string | null
}

export type JournalDisplayRow = JournalRow | PendingJournalRow

/**
 * Interleave pending offsets into the posted journal by occurred_date,
 * oldest first (same order convention as buildPartnerJournal). Ties on a
 * date put posted rows first, pending after — the balance column stays a
 * contiguous posted-only chain to the eye.
 */
/** A dated annotation memo on the ledger — no amount, no balance impact. */
export type LedgerNote = { id: string; note_date: string; memo: string; partner_visible: boolean }

export type NoteJournalRow = {
  date: string
  label: string
  detail: null
  amount: null
  balance: null
  kind: 'note'
  pay_stub_id: null
  note: LedgerNote
}

export type LedgerDisplayRow = JournalDisplayRow | NoteJournalRow

/**
 * Interleave notes into an already-merged display list by note_date, keeping
 * the list's ascending-date convention. On a date tie the note sorts LAST
 * ascending — i.e. it renders on top of that date's rows once the component
 * reverses to newest-first.
 */
/** Reserved id marking the composer's live draft in a display list — never a
 * real database row; the component styles it as a ghost and keeps it out of
 * edit/save flows. */
export const DRAFT_NOTE_PREVIEW_ID = '__draft_note_preview__'

/**
 * Substitute the open composer draft into the notes list so the ledger shows
 * a live ghost row where the note will land: a new note appends a preview,
 * editing an existing note replaces that note's row (the ghost moves as the
 * draft's date changes). No draft → the list is returned untouched.
 */
export function withDraftNotePreview(
  notes: LedgerNote[],
  editingNoteId: string | 'new' | null,
  draft: { note_date: string; memo: string; partner_visible: boolean } | null,
): LedgerNote[] {
  if (!draft || !editingNoteId) return notes
  const rest = editingNoteId === 'new' ? notes : notes.filter((n) => n.id !== editingNoteId)
  return [
    ...rest,
    { id: DRAFT_NOTE_PREVIEW_ID, note_date: draft.note_date, memo: draft.memo, partner_visible: draft.partner_visible },
  ]
}

export function mergeNotesIntoDisplay(rows: JournalDisplayRow[], notes: LedgerNote[]): LedgerDisplayRow[] {
  const noteRows: NoteJournalRow[] = notes.map((n) => ({
    date: n.note_date,
    label: n.memo,
    detail: null,
    amount: null,
    balance: null,
    kind: 'note',
    pay_stub_id: null,
    note: n,
  }))
  const merged: LedgerDisplayRow[] = [...rows, ...noteRows]
  const tier = (r: LedgerDisplayRow) => (r.kind === 'note' ? 1 : 0)
  return merged.sort((a, b) => a.date.localeCompare(b.date) || tier(a) - tier(b))
}

export function mergePendingIntoJournal(rows: JournalRow[], pending: JournalPendingOffset[]): JournalDisplayRow[] {
  const pendingRows: PendingJournalRow[] = pending
    .filter((o) => Number.isFinite(o.amount))
    .map((o) => ({
      date: o.occurred_date,
      label: o.description || o.type,
      detail: null,
      amount: pendingOffsetSignedAmount(o),
      balance: null,
      kind: 'pending',
      pay_stub_id: null,
      offset_id: o.id ?? null,
    }))
  const merged: JournalDisplayRow[] = [...rows, ...pendingRows]
  const tier = (r: JournalDisplayRow) => (r.kind === 'pending' ? 1 : 0)
  return merged.sort((a, b) => a.date.localeCompare(b.date) || tier(a) - tier(b))
}
