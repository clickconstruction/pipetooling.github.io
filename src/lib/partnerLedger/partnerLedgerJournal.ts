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
export type JournalPendingOffset = { type: string; amount: number; occurred_date: string; description: string | null }

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
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Offset types that ADD to what the partner is owed. */
export const POSITIVE_OFFSET_TYPES = new Set(['profit_share', 'employee_credit'])

/**
 * Build the dated journal, oldest first, with a running balance.
 * Ordering inside a stub's period: labor → additions → deductions (booked on
 * period_end), then payments on their own dates.
 */
export function buildPartnerJournal(input: {
  stubs: JournalStub[]
  additional: JournalAdditionalLine[]
  deductions: JournalDeduction[]
  payments: JournalPayment[]
}): { rows: JournalRow[]; balance: number } {
  const events: Omit<JournalRow, 'balance'>[] = []
  const stubsAsc = [...input.stubs].sort((a, b) => a.period_start.localeCompare(b.period_start))
  for (const s of stubsAsc) {
    events.push({
      date: s.period_end,
      label: `Labor — ${s.hours_total.toFixed(1)} h (week of ${s.period_start})`,
      detail: null,
      amount: round2(s.gross_pay),
      kind: 'labor',
      pay_stub_id: s.id,
    })
    for (const a of input.additional.filter((x) => x.pay_stub_id === s.id)) {
      events.push({
        date: s.period_end,
        label: a.description || 'Addition',
        detail: null,
        amount: round2(a.line_total),
        kind: 'addition',
        pay_stub_id: s.id,
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
