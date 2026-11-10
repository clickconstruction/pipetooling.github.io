/**
 * One place for work paid in kind (punch list #301, PR 4): every arrangement in one list.
 *
 * One row a deal: who, what is given, how far along, what is left and which way, and what is next. The open deals
 * with a month due come first, then the rest by what is left, then the ended ones. The money is read from the bills
 * as everywhere else (`inKindTotals`).
 */
import { dueMonths, inKindTotals, liveLines, money2, monthName, type InKindArrangement, type InKindJob, type InKindLine, type InKindMonth, type InKindPayment } from './inKindLedger'
import { dayShort, kindWords, usd } from './inKindWords'

export interface InKindListDeal {
  arrangement: InKindArrangement
  jobs: readonly InKindJob[]
  lines: readonly InKindLine[]
  payments: readonly InKindPayment[]
}

export interface InKindListRow {
  id: string
  customerId: string | null
  partner: string
  whatGiven: string
  /** Every month · As it comes · Ended */
  kind: string
  ended: boolean
  work: number
  paidInKind: number
  left: number
  /** Given ahead of our work: we owe this much of work. */
  ahead: number
  lineCount: number
  /** The oldest month with no credit, YYYY-MM-01. */
  dueMonth: string | null
  dueCount: number
  /** What the row's last column says. */
  next: string
}

/** What is next on a deal, in a few words. */
export function inKindNextWords(args: { ended: boolean; dueMonth: string | null; dueCount: number; lastLineDay: string | null; jobCount: number; left: number; ahead: number }): string {
  if (args.ended) return 'Ended.'
  if (args.dueMonth) return args.dueCount > 1 ? `${args.dueCount} months are due. ${monthName(args.dueMonth)} is the oldest.` : `${monthName(args.dueMonth)} is due.`
  if (args.jobCount === 0) return args.ahead > 0.005 ? 'Waits for a job of theirs.' : 'No job is on it yet.'
  if (args.left <= 0.005) return 'Nothing is left on its bills.'
  return args.lastLineDay ? `The last line was ${dayShort(args.lastLineDay)}.` : 'Nothing given yet.'
}

export function inKindListRows(deals: readonly InKindListDeal[], monthsById: ReadonlyMap<string, readonly InKindMonth[]>): InKindListRow[] {
  const rows = deals.map((d): InKindListRow => {
    const a = d.arrangement
    const t = inKindTotals(d.jobs, d.lines, d.payments)
    const live = liveLines(d.lines)
    const due = a.ended_at ? [] : dueMonths(monthsById.get(a.id) ?? [])
    const lastLineDay = live.map((l) => l.given_on).sort().pop() ?? null
    const dueMonth = due[0]?.month ?? null
    return {
      id: a.id,
      customerId: a.customer_id,
      partner: a.partner_name || 'A customer',
      whatGiven: a.what_given,
      kind: kindWords(a),
      ended: Boolean(a.ended_at),
      work: t.work,
      paidInKind: t.paidInKind,
      left: t.left,
      ahead: t.ahead,
      lineCount: live.length,
      dueMonth,
      dueCount: due.length,
      next: inKindNextWords({ ended: Boolean(a.ended_at), dueMonth, dueCount: due.length, lastLineDay, jobCount: d.jobs.length, left: t.left, ahead: t.ahead }),
    }
  })
  return rows.sort((x, y) => Number(x.ended) - Number(y.ended) || Number(Boolean(y.dueMonth)) - Number(Boolean(x.dueMonth)) || y.left - x.left || x.partner.localeCompare(y.partner))
}

export interface InKindListTotals {
  open: number
  /** Still to come on the open deals' bills. */
  left: number
  /** What the live lines of the open deals count as. */
  asOverhead: number
  onJobs: number
  /** Work we owe: given ahead of any bill. */
  ahead: number
  dueCount: number
}

export function inKindListTotals(deals: readonly InKindListDeal[], rows: readonly InKindListRow[]): InKindListTotals {
  let asOverhead = 0
  let onJobs = 0
  for (const d of deals) {
    if (d.arrangement.ended_at) continue
    const t = inKindTotals(d.jobs, d.lines, d.payments)
    asOverhead += t.asOverhead
    onJobs += t.onJobs
  }
  const open = rows.filter((r) => !r.ended)
  return {
    open: open.length,
    left: money2(open.reduce((s, r) => s + r.left, 0)),
    asOverhead: money2(asOverhead),
    onJobs: money2(onJobs),
    ahead: money2(open.reduce((s, r) => s + r.ahead, 0)),
    dueCount: open.filter((r) => r.dueMonth).length,
  }
}

/** Under a row's meter: "$10,500.00 of $19,875.40", or what was given when no job is on the deal. */
export function inKindSoFarWords(r: Pick<InKindListRow, 'paidInKind' | 'work' | 'ahead' | 'lineCount'>): string {
  if (r.work <= 0.005) return r.ahead > 0.005 ? `${usd(r.ahead)} given, on no bill yet` : 'Nothing given yet'
  return `${usd(r.paidInKind)} of ${usd(r.work)}`
}

/** The word under what is left: which way it runs. */
export function inKindLeftWords(r: Pick<InKindListRow, 'left' | 'ahead' | 'ended'>): { amount: string; words: string } {
  if (r.ahead > 0.005 && r.left <= 0.005) return { amount: usd(r.ahead), words: 'of work we owe' }
  if (r.left <= 0.005) return { amount: usd(0), words: r.ended ? 'ended' : 'even' }
  return { amount: usd(r.left), words: 'still to come' }
}

/** Where a row opens: the deal on its customer's page, on its oldest month due when it has one. Null when the customer is gone. */
export function inKindRowHref(r: Pick<InKindListRow, 'id' | 'customerId' | 'dueMonth'>): string | null {
  if (!r.customerId) return null
  return `/customers/${r.customerId}?inKind=${r.id}${r.dueMonth ? `&month=${r.dueMonth}` : ''}`
}
