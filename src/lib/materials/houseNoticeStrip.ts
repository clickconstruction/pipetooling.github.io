/**
 * A house's notice window as a strip (punch list #217, people-docs-8, a prototype). Held for
 * suppliers reads, under an owed house, *its own notice by Nov 15* (the app's estimate from the
 * unpaid invoice months) or *its notice goes out Nov 20 (said by Marisol)* (the house's own word):
 * a date the law sets and a date a person said, one verb apart, and the invoice months the
 * estimate is counted from are not on screen. The strip puts each on a calendar: under each owed
 * house its unpaid invoices as ticks on their days, the § 53.056 window as a bar from the first
 * day the oldest unpaid month's notice can go out to the day the estimate names, today marked, the
 * day the house gave as its own tick; and under the rows one mark per house saying where its date
 * came from — *guessed from the invoice months*, or *they said · Marisol, Oct 21*.
 *
 * Pure: it reads the Lien desk's `LienSupplierJob` (the same houses, invoices and words the tab
 * already holds) and returns rows on a `windowsAxis`; `HeldHouseNoticeStrip.tsx` draws them.
 */

import { formatYmdMonthDay } from '../jobs/billedExpectedPay'
import { lienSupplierNotice, type LienSupplierHouse, type LienSupplierJob, type LienSupplierNotice } from '../jobs/lienJobSuppliers'
import { formatUsdNoCents } from '../jobs/jobFormatting'
import { lienNoticeOpensOn } from '../jobs/lienTimeline'
import { windowsAxis, type LienWindowsAxis } from '../jobs/lienWindowsAxis'

const EPSILON = 0.005

export type HouseNoticeTick = {
  ymd: string
  /** "unpaid invoice Aug 12 · $3,120" */
  words: string
}

export type HouseNoticeBarTone = 'open' | 'soon' | 'closed'

export type HouseNoticeBar = {
  /** The first day the oldest unpaid month's notice can go out. */
  start: string
  /** The day the estimate names: the soonest open deadline, or the last one to close. */
  end: string
  tone: HouseNoticeBarTone
  /** "notice window · by Nov 15" / "window closed Oct 15" */
  words: string
  /** The days already gone are hatched up to here; '' draws none. */
  hatchTo: string
}

export type HouseNoticeTold = {
  ymd: string
  /** Who at the house said it, else the house. */
  who: string
  /** The day it was written down; '' when unknown. */
  notedYmd: string
  past: boolean
}

export type HouseNoticeSourceKind = 'guessed' | 'said' | 'closed' | 'none'

export type HouseNoticeRow = {
  houseId: string
  name: string
  owed: number
  /** "Bluebonnet Supply · $6,104" */
  label: string
  ticks: HouseNoticeTick[]
  bar: HouseNoticeBar | null
  told: HouseNoticeTold | null
  /** Where the house's date came from, as the mark under the rows says it. */
  source: { kind: HouseNoticeSourceKind; words: string }
  /** The house can still send its notice: its day is today or ahead. */
  ahead: boolean
  /** The row's hover, the whole house in one sentence. */
  title: string
}

export type HouseNoticeStrip = {
  todayYmd: string
  axis: LienWindowsAxis
  rows: HouseNoticeRow[]
  /** The job's state as chips: "paid in full", "2 houses can still notice". */
  chips: Array<{ key: 'paid' | 'ahead'; text: string; tone: 'ok' | 'warn' }>
  /** The legend's items, only the ones the rows use. */
  legend: string[]
  /** The whole strip in one sentence. */
  words: string
}

function md(ymd: string): string {
  return formatYmdMonthDay(ymd)
}

function housesWord(n: number): string {
  return `${n} ${n === 1 ? 'house' : 'houses'}`
}

/** The house's estimate drawn as a bar. Null when there is no unpaid invoice month to count from. */
export function houseNoticeBar(h: Pick<LienSupplierHouse, 'unpaidMonths'>, estimate: LienSupplierNotice, todayYmd: string): HouseNoticeBar | null {
  if (estimate.kind === 'none' || estimate.kind === 'said' || h.unpaidMonths.length === 0) return null
  const start = lienNoticeOpensOn(h.unpaidMonths[0]!)
  if (!start) return null
  if (estimate.kind === 'closed') return { start, end: estimate.ymd, tone: 'closed', words: `window closed ${md(estimate.ymd)}`, hatchTo: '' }
  return { start, end: estimate.ymd, tone: estimate.soon ? 'soon' : 'open', words: `notice window · by ${md(estimate.ymd)}`, hatchTo: todayYmd > start ? todayYmd : '' }
}

/** One owed house as a row of the strip. */
export function houseNoticeRow(h: LienSupplierHouse, propertyKind: string, todayYmd: string): HouseNoticeRow {
  const estimate = lienSupplierNotice(h.unpaidMonths, propertyKind, todayYmd)
  const bar = houseNoticeBar(h, estimate, todayYmd)
  const ticks: HouseNoticeTick[] = h.unpaidInvoices
    .filter((inv) => /^\d{4}-\d{2}-\d{2}$/.test(inv.invoiceDate))
    .map((inv) => ({ ymd: inv.invoiceDate, words: `unpaid invoice ${md(inv.invoiceDate)} · ${formatUsdNoCents(inv.allocated)}` }))
  const saidYmd = h.word?.noticeYmd && /^\d{4}-\d{2}-\d{2}$/.test(h.word.noticeYmd) ? h.word.noticeYmd : null
  const told: HouseNoticeTold | null = saidYmd && h.word ? { ymd: saidYmd, who: h.word.saidBy.trim() || h.name, notedYmd: h.word.notedYmd, past: saidYmd < todayYmd } : null

  let source: HouseNoticeRow['source']
  let ahead: boolean
  if (told) {
    const when = told.notedYmd ? `${told.who}, ${md(told.notedYmd)}` : told.who
    source = { kind: 'said', words: `${h.name} · ${told.past ? 'went out' : 'goes out'} ${md(told.ymd)} · they said · ${when}` }
    ahead = !told.past
  } else if (estimate.kind === 'open') {
    source = { kind: 'guessed', words: `${h.name} · by ${md(estimate.ymd)} · guessed from the invoice months` }
    ahead = true
  } else if (estimate.kind === 'closed') {
    source = { kind: 'closed', words: `${h.name} · window closed ${md(estimate.ymd)} · guessed from the invoice months` }
    ahead = false
  } else {
    source = { kind: 'none', words: `${h.name} · no invoice date to count from` }
    ahead = false
  }

  const titleParts = [`${h.name} is owed ${formatUsdNoCents(h.owed)}.`]
  if (ticks.length) titleParts.push(`${ticks.length} unpaid invoice${ticks.length === 1 ? '' : 's'}: ${ticks.map((t) => md(t.ymd)).join(', ')}.`)
  if (bar) titleParts.push(bar.tone === 'closed' ? `By our count its window closed ${md(bar.end)}.` : `By our count it can send its own notice from ${md(bar.start)} to ${md(bar.end)}.`)
  if (told) titleParts.push(`${told.who} said its notice ${told.past ? 'went' : 'goes'} out ${md(told.ymd)}.`)

  return {
    houseId: h.houseId,
    name: h.name,
    owed: h.owed,
    label: `${h.name} · ${formatUsdNoCents(h.owed)}`,
    ticks,
    bar,
    told,
    source,
    ahead,
    title: titleParts.join(' '),
  }
}

/**
 * The job's owed houses as one strip on one calendar. Null when no house is owed on the job.
 * `paidInFull` is the tab's own reading of the customer's side (`customerPaidInFull`).
 */
export function houseNoticeStrip(job: LienSupplierJob | null | undefined, propertyKind: string, todayYmd: string, paidInFull: boolean): HouseNoticeStrip | null {
  if (!job) return null
  const owed = job.houses.filter((h) => h.owed > EPSILON)
  if (owed.length === 0) return null
  const rows = owed.map((h) => houseNoticeRow(h, propertyKind, todayYmd))
  // The axis holds every bar, every invoice day and every day a house gave, and today.
  const spans: Array<{ start: string; end: string }> = []
  for (const r of rows) {
    if (r.bar) spans.push({ start: r.bar.start, end: r.bar.end })
    for (const t of r.ticks) spans.push({ start: t.ymd, end: t.ymd })
    if (r.told) spans.push({ start: r.told.ymd, end: r.told.ymd })
  }
  const axis = windowsAxis(todayYmd, spans)
  const aheadCount = rows.filter((r) => r.ahead).length
  const chips: HouseNoticeStrip['chips'] = []
  if (paidInFull) chips.push({ key: 'paid', text: 'paid in full', tone: 'ok' })
  if (aheadCount > 0) chips.push({ key: 'ahead', text: `${housesWord(aheadCount)} can still notice`, tone: 'warn' })
  const legend: string[] = ['│ today']
  if (rows.some((r) => r.ticks.length)) legend.push('▏an unpaid invoice')
  if (rows.some((r) => r.bar && r.bar.tone !== 'closed')) legend.push('▬ the window, by our count')
  if (rows.some((r) => r.bar?.hatchTo)) legend.push('▨ days already gone')
  if (rows.some((r) => r.bar?.tone === 'closed')) legend.push('▭ a window that closed')
  if (rows.some((r) => r.told)) legend.push('◆ the day the house gave')
  const words = [
    `${housesWord(rows.length)} owed on this job${paidInFull ? ', the customer paid in full' : ''}.`,
    aheadCount > 0 ? `${housesWord(aheadCount)} can still send a notice.` : 'No house can still send a notice, by our count.',
    ...rows.map((r) => r.source.words + '.'),
  ].join(' ')
  return { todayYmd, axis, rows, chips, legend, words }
}
