/**
 * Person money ledger kernels (v2.1666, Offsets → Balances):
 * - per-person offset balances for the Balances summary board (pending =
 *   offsets not yet applied to a pay report; credits +, backcharges/damages −)
 * - the merged offset + payment timeline for the person ledger modal
 * - the shareable pay-statement build (payments with the period's job hours
 *   and applied offsets — hours and jobs only, no company revenue numbers)
 */

export type PersonOffsetLike = {
  id: string
  person_name: string
  type: string
  amount: number
  description: string | null
  occurred_date: string
  pay_stub_id: string | null
}

export type PayStubLike = {
  id: string
  person_name: string
  period_start: string
  period_end: string
  hours_total: number
  gross_pay: number
  paid_at: string | null
}

export const OFFSET_TYPE_LABELS: Record<string, string> = {
  backcharge: 'Backcharge',
  damage: 'Damage',
  employee_credit: 'Credit',
}

/** Credits count for the person; backcharges and damages count against them. */
export function offsetSignedAmount(type: string, amount: number): number {
  return type === 'employee_credit' ? amount : -amount
}

export type PersonBalanceRow = {
  personName: string
  /** Net of offsets NOT yet applied to a pay report — what hits the next check. */
  pendingNet: number
  pendingCount: number
  /** Net of every offset ever recorded. */
  lifetimeNet: number
}

/**
 * One row per person with any offset history, sorted most-negative pending
 * first; settled people (nothing pending) sort after, alphabetically.
 */
export function personOffsetBalances(offsets: PersonOffsetLike[]): PersonBalanceRow[] {
  const byName = new Map<string, PersonBalanceRow>()
  for (const o of offsets) {
    const name = o.person_name.trim()
    if (!name) continue
    const row = byName.get(name) ?? { personName: name, pendingNet: 0, pendingCount: 0, lifetimeNet: 0 }
    const signed = offsetSignedAmount(o.type, o.amount)
    row.lifetimeNet += signed
    if (o.pay_stub_id == null) {
      row.pendingNet += signed
      row.pendingCount++
    }
    byName.set(name, row)
  }
  const rows = [...byName.values()]
  rows.sort((a, b) => {
    const aSettled = a.pendingCount === 0 ? 1 : 0
    const bSettled = b.pendingCount === 0 ? 1 : 0
    if (aSettled !== bSettled) return aSettled - bSettled
    if (a.pendingNet !== b.pendingNet) return a.pendingNet - b.pendingNet
    return a.personName.localeCompare(b.personName)
  })
  return rows
}

export type PersonLedgerRow = {
  key: string
  kind: 'offset' | 'payment' | 'payment_pending'
  dateYmd: string
  typeLabel: string
  label: string
  /** Signed: offsets carry their sign; payments are positive. */
  amount: number
  /** Offsets only: already applied to a pay report. */
  applied?: boolean
}

/**
 * The person ledger's date-interleaved timeline: every offset (signed) and
 * every pay report (paid → its paid date; unpaid → period end, flagged
 * pending), newest first.
 */
export function buildOffsetPaymentTimeline(args: {
  offsets: PersonOffsetLike[]
  payStubs: PayStubLike[]
}): PersonLedgerRow[] {
  const rows: PersonLedgerRow[] = []
  for (const o of args.offsets) {
    rows.push({
      key: `offset-${o.id}`,
      kind: 'offset',
      dateYmd: o.occurred_date,
      typeLabel: OFFSET_TYPE_LABELS[o.type] ?? o.type,
      label: (o.description ?? '').trim() || (OFFSET_TYPE_LABELS[o.type] ?? o.type),
      amount: offsetSignedAmount(o.type, o.amount),
      applied: o.pay_stub_id != null,
    })
  }
  for (const s of args.payStubs) {
    const paid = s.paid_at != null
    rows.push({
      key: `stub-${s.id}`,
      kind: paid ? 'payment' : 'payment_pending',
      dateYmd: paid ? (s.paid_at as string).slice(0, 10) : s.period_end,
      typeLabel: paid ? 'Paid' : 'Pending',
      label: `Pay report ${s.period_start} – ${s.period_end} · ${s.hours_total} h`,
      amount: s.gross_pay,
    })
  }
  rows.sort((a, b) => (a.dateYmd !== b.dateYmd ? b.dateYmd.localeCompare(a.dateYmd) : a.key.localeCompare(b.key)))
  return rows
}

export type PersonWorkDay = { workDate: string; hours: number; jobLabel: string }

export type PayStatementJobLine = { label: string; hours: number }

export type PayStatementPayment = {
  paidAtYmd: string
  gross: number
  periodStart: string
  periodEnd: string
  hoursTotal: number
  jobLines: PayStatementJobLine[]
  offsets: Array<{ label: string; amount: number }>
}

/**
 * Statement content: every PAID report in range, each with the period's job
 * hours (from the person's per-day labor allocation) and its applied offsets.
 */
export function buildPayStatementPayments(args: {
  payStubs: PayStubLike[]
  offsets: PersonOffsetLike[]
  workDays: PersonWorkDay[]
  rangeStart: string | null
  rangeEnd: string | null
}): PayStatementPayment[] {
  const paid = args.payStubs.filter((s) => {
    if (s.paid_at == null) return false
    const ymd = s.paid_at.slice(0, 10)
    if (args.rangeStart != null && ymd < args.rangeStart) return false
    if (args.rangeEnd != null && ymd > args.rangeEnd) return false
    return true
  })
  paid.sort((a, b) => (b.paid_at as string).localeCompare(a.paid_at as string))
  return paid.map((s) => {
    const byJob = new Map<string, number>()
    for (const d of args.workDays) {
      if (d.workDate < s.period_start || d.workDate > s.period_end) continue
      byJob.set(d.jobLabel, (byJob.get(d.jobLabel) ?? 0) + d.hours)
    }
    const jobLines = [...byJob.entries()]
      .map(([label, hours]) => ({ label, hours: Math.round(hours * 100) / 100 }))
      .filter((l) => l.hours > 0)
      .sort((a, b) => b.hours - a.hours)
    const offsets = args.offsets
      .filter((o) => o.pay_stub_id === s.id)
      .map((o) => ({
        label: (o.description ?? '').trim() || (OFFSET_TYPE_LABELS[o.type] ?? o.type),
        amount: offsetSignedAmount(o.type, o.amount),
      }))
    return {
      paidAtYmd: (s.paid_at as string).slice(0, 10),
      gross: s.gross_pay,
      periodStart: s.period_start,
      periodEnd: s.period_end,
      hoursTotal: s.hours_total,
      jobLines,
      offsets,
    }
  })
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function fmtMoney(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDateLong(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ymd
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

/**
 * The shareable statement document: payments with their paid dates, the job
 * hours that earned each one, and applied offsets. Deliberately shows hours
 * and job names only — never company revenue. Print-ready standalone HTML.
 */
export function buildPayStatementHtml(args: {
  personName: string
  companyName: string
  rangeLabel: string
  payments: PayStatementPayment[]
  generatedYmd: string
}): string {
  const totalPaid = args.payments.reduce((s, p) => s + p.gross, 0)
  const paymentsHtml = args.payments
    .map((p) => {
      const jobRows = p.jobLines
        .map((l) => `<tr><td>${escapeHtml(l.label)}</td><td class="num">${l.hours.toLocaleString()} h</td></tr>`)
        .join('')
      const offsetRows = p.offsets
        .map(
          (o) =>
            `<tr class="offset"><td>${o.amount < 0 ? 'Less' : 'Plus'}: ${escapeHtml(o.label)}</td><td class="num">${o.amount < 0 ? '−' : '+'}$${fmtMoney(Math.abs(o.amount))}</td></tr>`,
        )
        .join('')
      return `<section>
  <h2>Paid ${fmtDateLong(p.paidAtYmd)} — $${fmtMoney(p.gross)}</h2>
  <p class="muted">Period ${fmtDateLong(p.periodStart)} – ${fmtDateLong(p.periodEnd)} · ${p.hoursTotal.toLocaleString()} hours</p>
  <table>${jobRows || '<tr><td class="muted">No job-day detail recorded for this period</td><td></td></tr>'}${offsetRows}</table>
</section>`
    })
    .join('\n')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pay statement — ${escapeHtml(args.personName)}</title><style>
body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #1f2937; margin: 2rem auto; max-width: 640px; padding: 0 1rem; }
header { border-bottom: 2px solid #1f2937; padding-bottom: 8px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: baseline; }
h1 { font-size: 1.15rem; margin: 0; } h2 { font-size: 0.95rem; margin: 1rem 0 2px; }
.muted { color: #6b7280; font-size: 0.8rem; margin: 0 0 6px; }
table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
td { padding: 3px 0; border-bottom: 1px solid #f3f4f6; }
td.num { text-align: right; white-space: nowrap; }
tr.offset td { color: #991b1b; }
footer { margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 8px; color: #9ca3af; font-size: 0.75rem; }
@media print { body { margin: 0.5rem auto; } }
</style></head><body>
<header>
  <div><h1>Pay statement — ${escapeHtml(args.personName)}</h1><p class="muted">${escapeHtml(args.companyName)} · ${escapeHtml(args.rangeLabel)}</p></div>
  <div class="muted">${args.payments.length} payment${args.payments.length === 1 ? '' : 's'} · $${fmtMoney(totalPaid)}</div>
</header>
${paymentsHtml || '<p class="muted">No payments in this range.</p>'}
<footer>Questions about a line? Talk to the office. This statement reflects recorded clock time, job assignments, and agreed offsets. Generated ${fmtDateLong(args.generatedYmd)}.</footer>
</body></html>`
}
