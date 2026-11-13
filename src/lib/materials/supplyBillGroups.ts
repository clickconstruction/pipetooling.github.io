/**
 * A supply house's bills, grouped by the day they fall due (punch list #334 PR 5, 2026-11-12).
 *
 * The owner opens a house from the Bridge "to see the invoices and to potentially mark some of them as paid, if we
 * can quickly pay them then and there". The house's card listed every bill in one flat run, newest first, so the
 * thirty bills due on the 15th could not be seen apart from the rest, and nothing said what they add up to.
 *
 * So the unpaid bills read in groups, each with its count and its total: what is past due, then each due day to
 * come, soonest first, then the bills with no due day. Paid bills, when the page shows them, follow in one group.
 * Each bill is still marked paid by itself. The owner, asked about marking a ticked set at once: "I don't think we
 * should mark two as paid. I think we should individually mark them as paid."
 *
 * A bill marked paid on this visit stays where it was, greyed, with *Mark unpaid* beside it, and leaves its group's
 * count and total. The rows under it do not move up under the pointer, and a wrong press is one press to undo.
 *
 * A credit memo is stored negative and takes its amount off its group's total.
 *
 * Pure.
 */

export type SupplyBillForGroup = { id: string; due_date: string | null; amount: number | null; is_paid: boolean }

export type SupplyBillGroupKind = 'past' | 'due' | 'none' | 'paid'

export type SupplyBillGroup<T extends SupplyBillForGroup> = {
  /** `past`, the due day as written (`2026-11-15`), `none` or `paid`. A link names a group by this. */
  key: string
  kind: SupplyBillGroupKind
  /** "Past due", "Due Nov 15", "No due date", "Paid". */
  title: string
  /** "30 bills · $12,034.10". */
  words: string
  count: number
  usd: number
  rows: T[]
}

const usd2 = (n: number): string => `${n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const bills = (n: number): string => `${n} ${n === 1 ? 'bill' : 'bills'}`
const amountOf = (row: SupplyBillForGroup): number => (typeof row.amount === 'number' && Number.isFinite(row.amount) ? row.amount : 0)

/** The key of the group a link's due day lands on: the day itself while it is to come, else the past-due group. */
export function dueGroupKey(dueYmd: string, todayYmd: string): string {
  return dueYmd < todayYmd ? 'past' : dueYmd
}

/**
 * The bills in groups, in the order to work them. Within a group the rows keep the order they came in, except past
 * due, which reads oldest first.
 */
export function groupSupplyBills<T extends SupplyBillForGroup>(
  rows: ReadonlyArray<T>,
  todayYmd: string,
  dayLabel: (ymd: string) => string,
  /** Bills marked paid on this visit: each stays in its due group, out of the count and the total. */
  keepInPlace: ReadonlySet<string> = new Set(),
): SupplyBillGroup<T>[] {
  const past: T[] = []
  const none: T[] = []
  const paid: T[] = []
  const byDay = new Map<string, T[]>()
  for (const r of rows) {
    if (r.is_paid && !keepInPlace.has(r.id)) paid.push(r)
    else if (!r.due_date) none.push(r)
    else if (r.due_date < todayYmd) past.push(r)
    else byDay.set(r.due_date, [...(byDay.get(r.due_date) ?? []), r])
  }
  past.sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
  const group = (key: string, kind: SupplyBillGroupKind, title: string, list: T[]): SupplyBillGroup<T> => {
    // A bill paid on this visit is still listed in its group, and no longer counted in it.
    const counted = kind === 'paid' ? list : list.filter((r) => !r.is_paid)
    const total = counted.reduce((s, r) => s + amountOf(r), 0)
    return { key, kind, title, words: counted.length === 0 ? 'all paid' : `${bills(counted.length)} · ${usd2(total)}`, count: counted.length, usd: total, rows: list }
  }
  const out: SupplyBillGroup<T>[] = []
  if (past.length > 0) out.push(group('past', 'past', 'Past due', past))
  for (const day of [...byDay.keys()].sort()) out.push(group(day, 'due', day === todayYmd ? 'Due today' : `Due ${dayLabel(day)}`, byDay.get(day) ?? []))
  if (none.length > 0) out.push(group('none', 'none', 'No due date', none))
  if (paid.length > 0) out.push(group('paid', 'paid', 'Paid', paid))
  return out
}

/**
 * A bill's day as the card writes it: the month and the day, and the year only when it is not this year, in two
 * digits. The owner, of the card's dates: "I would like to only see the year with two digits instead of four. And I
 * would only like to see the year shown on the date, if it is a year that is not this year".
 *
 * `10/31` this year, `12/5/25` for another. A day that is not a `YYYY-MM-DD` is handed back as it came.
 */
export function billDateWords(ymd: string | null | undefined, todayYmd: string): string {
  const text = ymd ?? ''
  if (!/^\d{4}-\d{2}-\d{2}/.test(text)) return text
  const year = text.slice(0, 4)
  const md = `${Number(text.slice(5, 7))}/${Number(text.slice(8, 10))}`
  return year === todayYmd.slice(0, 4) ? md : `${md}/${year.slice(2)}`
}

/** A due day for a group's name, by the same rule: "Nov 15" this year, "Jan 15 ’27" for another. */
export function billDayName(ymd: string, todayYmd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return ymd
  const name = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return ymd.slice(0, 4) === todayYmd.slice(0, 4) ? name : `${name} ’${ymd.slice(2, 4)}`
}

/** "38 unpaid · $13,790.15", for the line beside the section's name. Empty when nothing is unpaid. */
export function unpaidBillsWords(rows: ReadonlyArray<SupplyBillForGroup>): string {
  const open = rows.filter((r) => !r.is_paid)
  if (open.length === 0) return ''
  return `${open.length} unpaid · ${usd2(open.reduce((s, r) => s + amountOf(r), 0))}`
}

// ── the summary over the bills ─────────────────────────────────────────────

/**
 * The numbers a house's card opens on (2026-11-12, the refresh the owner asked for: "give that view a
 * refresh"): what is open, what is past due, what falls due next, and what is not on a job account.
 *
 * A bill on the house's job account is one the house bills to the property owner if it goes unpaid. A bill for a
 * job that is not on one is the company's alone, so it is counted apart, and only at a house that uses job accounts.
 */
export type SupplyBillForSummary = SupplyBillForGroup & {
  on_job_account?: boolean | null
  /** True when the bill is put to at least one job. */
  hasJob: boolean
}

export type SupplyBillStat = {
  key: 'open' | 'past' | 'next' | 'bare'
  label: string
  /** Whole dollars: "$13,790". */
  value: string
  sub: string
  tone: 'plain' | 'red' | 'amber'
}

const usd0 = (n: number): string => `${n < 0 ? '−' : ''}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`

/** A bill for a job, unpaid, that the house has not put on a job account. */
export function isBareOfJobAccount(row: SupplyBillForSummary): boolean {
  return !row.is_paid && row.hasJob && row.on_job_account !== true && amountOf(row) > 0
}

export function supplyBillSummary(rows: ReadonlyArray<SupplyBillForSummary>, todayYmd: string, dayName: (ymd: string) => string, opts: { jobAccountsInUse: boolean }): SupplyBillStat[] {
  const open = rows.filter((r) => !r.is_paid)
  const sum = (list: ReadonlyArray<SupplyBillForSummary>): number => list.reduce((s, r) => s + amountOf(r), 0)
  const out: SupplyBillStat[] = [{ key: 'open', label: 'Open', value: usd0(sum(open)), sub: open.length === 0 ? 'nothing unpaid' : bills(open.length), tone: 'plain' }]
  const past = open.filter((r) => r.due_date != null && r.due_date < todayYmd)
  if (past.length > 0) out.push({ key: 'past', label: 'Past due', value: usd0(sum(past)), sub: bills(past.length), tone: 'red' })
  const nextDay = open
    .map((r) => r.due_date)
    .filter((d): d is string => d != null && d >= todayYmd)
    .sort()[0]
  if (nextDay) {
    const next = open.filter((r) => r.due_date === nextDay)
    out.push({ key: 'next', label: nextDay === todayYmd ? 'Due today' : `Due ${dayName(nextDay)}`, value: usd0(sum(next)), sub: bills(next.length), tone: 'plain' })
  }
  if (opts.jobAccountsInUse) {
    const bare = open.filter(isBareOfJobAccount)
    if (bare.length > 0) out.push({ key: 'bare', label: 'Not on a job account', value: usd0(sum(bare)), sub: `${bills(bare.length)}, ours to carry`, tone: 'amber' })
  }
  return out
}
