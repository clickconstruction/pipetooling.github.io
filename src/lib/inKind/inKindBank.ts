/**
 * One place for work paid in kind (punch list #301, PR 3): what left the bank for a monthly deal.
 *
 * A credit that comes off a bill we pay (the rent) is that bill less what left the bank that month. This reads the
 * bank feed's lines to the deal's payee and sums them by month, in the company's calendar. A line that failed, a
 * duplicate and money coming in are not counted. The person still looks: the window shows the lines it read.
 */
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { addMonths, inKindMonths, isMonthlyArrangement, money2, monthOf, type InKindArrangement, type InKindLine, type InKindMonth } from './inKindLedger'

export interface BankLine {
  id: string
  /** Negative is money out, as the feed stores it. */
  amount: number | null
  posted_at: string | null
  created_at: string | null
  status: string | null
  counterparty_name: string | null
  duplicate_of_transaction_id?: string | null
}

/** A line to the payee that counts as paid: its day in the company's calendar and its dollars as a positive number. */
export interface BankPaidLine {
  id: string
  /** YYYY-MM-DD */
  day: string
  amount: number
  name: string
}

const norm = (s: string | null | undefined): string => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()

/** Whether the bank's name for a line carries the payee's name. An empty payee matches nothing. */
export function isPayeeLine(counterpartyName: string | null | undefined, payee: string): boolean {
  const p = norm(payee)
  return p.length > 0 && norm(counterpartyName).includes(p)
}

/** The lines that count, oldest first. */
export function bankPaidLines(rows: readonly BankLine[], payee: string): BankPaidLine[] {
  const out: BankPaidLine[] = []
  for (const r of rows) {
    const amount = Number(r.amount ?? 0)
    if (!(amount < 0)) continue
    if (r.duplicate_of_transaction_id) continue
    if (norm(r.status) === 'failed' || norm(r.status) === 'cancelled') continue
    if (!isPayeeLine(r.counterparty_name, payee)) continue
    const day = calendarYmdInAppTzFromIso(r.posted_at ?? r.created_at ?? '')
    if (!day) continue
    out.push({ id: r.id, day, amount: money2(-amount), name: (r.counterparty_name ?? '').trim() })
  }
  return out.sort((a, b) => a.day.localeCompare(b.day) || a.id.localeCompare(b.id))
}

/** Month (YYYY-MM-01) → what left the bank to the payee that month. Every month asked for is present, at 0 when nothing left. */
export function bankPaidByMonth(lines: readonly BankPaidLine[], months: readonly string[]): Map<string, number> {
  const out = new Map<string, number>(months.map((m) => [m, 0]))
  for (const l of lines) {
    const m = monthOf(l.day)
    if (out.has(m)) out.set(m, money2((out.get(m) ?? 0) + l.amount))
  }
  return out
}

/** The lines of one month, for the window that shows what the bank said. */
export const bankLinesOfMonth = (lines: readonly BankPaidLine[], month: string): BankPaidLine[] => lines.filter((l) => monthOf(l.day) === month)

/**
 * A monthly deal's months with what the bank said, newest first. `bank` is the lines to its payee: null or absent
 * when the bank was not read, and then a month is due only once it is over.
 */
export function monthsWithBank(
  a: Pick<InKindArrangement, 'monthly_amount' | 'starts_on' | 'ended_at'>,
  lines: readonly InKindLine[],
  bank: readonly BankPaidLine[] | null | undefined,
  todayYmd: string,
): InKindMonth[] {
  if (!isMonthlyArrangement(a) || !a.starts_on) return []
  const all: string[] = []
  for (let m = a.starts_on, g = 0; m <= monthOf(todayYmd) && g < 600; m = addMonths(m, 1), g += 1) all.push(m)
  return inKindMonths(a, lines, todayYmd, bank ? bankPaidByMonth(bank, all) : undefined)
}
