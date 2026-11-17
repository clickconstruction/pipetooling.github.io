/**
 * What marks a sub paper beside its figures (punch list #350, moved here for #371): the short text the register
 * tells a change from a reprint by, and the moment a paper with no number says it was prepared. The office's window
 * and the sub's own page both read them, so a paper the page draws is told from the office's copy by one rule.
 *
 * Pure: no table, and the clock is handed in.
 */
import type { PaymentRecord, StatementOfAccount, WorkStatement } from './subPapers.ts'

/**
 * A short text of a paper's figures. The register holds it to tell a change from a reprint, so it leaves out what
 * moves by itself: the number, the revision, the day it was issued and the time it was prepared.
 */
export function subPaperFingerprint(p: WorkStatement | PaymentRecord | StatementOfAccount): string {
  if (p.kind === 'work_statement') {
    return JSON.stringify(['ws', p.sub.name, p.job.label, p.lines.map((l) => [l.label, l.amount]), p.backcharges.map((b) => [b.day, b.reason, b.amount]), p.payments.map((x) => [x.day, x.how, x.amount]), p.agreed, p.comesTo, p.paidSoFar, p.stillOpen, p.over])
  }
  if (p.kind === 'payment_record') {
    return JSON.stringify(['pr', p.sub.name, p.sentOn, p.how, p.amountSent, p.applied.map((a) => [a.sheetId, a.openBefore, a.thisPayment, a.openAfter]), p.creditKept, p.stillOpenAfter, p.note])
  }
  return JSON.stringify(['sa', p.sub.name, p.period, p.closingDay, p.rows.map((r) => [r.sheetId, r.comesTo, r.paid, r.open]), p.paidInPeriod, [p.adds.opening, p.adds.newWork, p.adds.backcharges, p.adds.payments, p.adds.closing], p.credit, p.stillOpen])
}

/** `Nov 13, 2026 at 2:40 pm` in the zone given, for a paper with no number yet. */
export function paperPreparedAt(now: Date, timeZone: string): string {
  const day = new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric', year: 'numeric' }).format(now)
  const time = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(now).toLowerCase().replace(/\s/g, ' ')
  return `${day} at ${time}`
}
