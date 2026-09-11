/**
 * The decisions a person makes on a Cash App send still in review, and the shapes they write.
 * Record → a pay_stub_payments row on one of that person's open reports (memo carries the Cash
 * App id so the next import matches it by rule a); Advance → a pending person_offsets row of
 * type 'advance' (the Less modal offers it on the next report); Not pay / Skip → a lane. Pure.
 */

export type OpenReportForSend = {
  id: string
  personName: string
  periodStart: string // YYYY-MM-DD
  periodEnd: string // YYYY-MM-DD
  /** Net pay still unpaid on this report. */
  remaining: number
}

/** The memo written on a recorded payment: `Cash App #D-… "Week"`. Rule (a) of the matcher reads the id back. */
export function cashAppPaymentMemo(txId: string, note: string): string {
  const n = note.trim()
  return n ? `Cash App ${txId} "${n}"` : `Cash App ${txId}`
}

/**
 * Which report a send most likely pays. A "Week" send on Monday pays the week that just ended, so
 * prefer the latest open report whose period ended on or before the send date; failing that the
 * earliest open report (paying ahead). Reports with nothing left to pay are excluded.
 */
export function suggestReportForSend(args: { personName: string; sendDate: string; amountSent: number; reports: readonly OpenReportForSend[] }): {
  options: OpenReportForSend[]
  suggestedId: string | null
  suggestedAmount: number
} {
  const open = args.reports.filter((r) => r.personName === args.personName && r.remaining > 0.005).sort((a, b) => a.periodStart.localeCompare(b.periodStart))
  const ended = open.filter((r) => r.periodEnd <= args.sendDate)
  const pick = ended.length ? ended[ended.length - 1]! : (open[0] ?? null)
  const amount = pick ? Math.round(Math.min(args.amountSent, pick.remaining) * 100) / 100 : 0
  return { options: open, suggestedId: pick?.id ?? null, suggestedAmount: amount }
}

/** Clamp a typed amount to what the report can still take; null when unusable. */
export function clampRecordAmount(raw: string | number, remaining: number): number | null {
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/[$,\s]/g, ''))
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(Math.min(n, remaining) * 100) / 100
}

/** The pending offset an advance becomes. */
export function advanceOffsetInsert(args: { personName: string; txId: string; note: string; amountSent: number; occurredDate: string }): {
  person_name: string
  type: 'advance'
  amount: number
  description: string
  occurred_date: string
} {
  return {
    person_name: args.personName,
    type: 'advance',
    amount: Math.round(args.amountSent * 100) / 100,
    description: cashAppPaymentMemo(args.txId, args.note),
    occurred_date: args.occurredDate,
  }
}
