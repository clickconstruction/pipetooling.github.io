import { type BidSchedule, bidStageOfJobLine } from './aiaBidSchedule'
import { type PayApplicationLine, cents } from './aiaPayApplicationLines'

/**
 * Where a job's first pay application can start its rows from (v2.4547).
 *
 * The owner, 2026-10-05: "I would like the option for the user to choose if it is three rows or
 * one row", then "One row default, everyone sees it". So the window offers every start the job
 * has, with one already picked: the whole contract on one row, a row per Line Item of the job
 * (the lines the Bill tab bills from), or the bid's schedule of values. The choice is only the
 * start of application 1: once something is saved, the rows carry from the saved application.
 */

export type AiaLineSourceKey = 'one' | 'items' | 'bid'

export type AiaLineSource = {
  key: AiaLineSourceKey
  title: string
  /** One line under the title: what the rows would be, or why this start cannot be used. */
  detail: string
  /** The rows this start gives; null when it cannot be used (`detail` says why). */
  lines: PayApplicationLine[] | null
  splitLaborMaterial: boolean
}

/** The part of a job's Line Item the rows read. */
export type JobLineItem = {
  id: string
  name: string | null
  count: number | null
  line_unit_price: number | null
  sequence_order?: number | null
}

const money = (n: number): string => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** The job's Line Items that have a name, in the order the Bill tab shows them. */
export function namedLineItems(items: ReadonlyArray<JobLineItem>): JobLineItem[] {
  return items
    .map((item, at) => ({ item, at }))
    .filter(({ item }) => (item.name ?? '').trim() !== '')
    .sort((a, b) => (a.item.sequence_order ?? a.at) - (b.item.sequence_order ?? b.at) || a.at - b.at)
    .map(({ item }) => item)
}

/** A Line Item's price on the job: its count times its unit price, 0 when either is missing. */
export function lineItemValue(item: Pick<JobLineItem, 'count' | 'line_unit_price'>): number {
  return cents((Number(item.count) || 0) * (Number(item.line_unit_price) || 0))
}

/**
 * A row per Line Item: its name (with the count when there is more than one), its price as the
 * scheduled value, and its stage when the name is one, so the crew's percent can be offered on it.
 * The row's id is the Line Item's, so it stays the same from one application to the next.
 */
export function linesFromJobLineItems(items: ReadonlyArray<JobLineItem>): PayApplicationLine[] {
  return namedLineItems(items).map((item) => {
    const name = (item.name ?? '').trim()
    const count = Number(item.count) || 0
    return {
      id: `item-${item.id}`,
      label: count > 1 ? `${name} × ${count}` : name,
      scheduledValue: lineItemValue(item),
      labor: null,
      stage: bidStageOfJobLine(name),
      fromPrevious: 0,
      thisPeriod: 0,
      stored: 0,
    }
  })
}

const sum = (lines: ReadonlyArray<PayApplicationLine>): number => cents(lines.reduce((t, l) => t + l.scheduledValue, 0))

/** `3 rows: Rough In, Top Out, Trim Set`, the names cut short past the fourth. */
function rowsDetail(lines: ReadonlyArray<PayApplicationLine>): string {
  const names = lines.slice(0, 4).map((l) => l.label)
  const more = lines.length > 4 ? `, and ${lines.length - 4} more` : ''
  return `${lines.length} rows: ${names.join(', ')}${more}`
}

/**
 * Every start this job has, in the order the window offers them. One row is always first. A row
 * per Line Item needs two or more named Line Items, and is listed but off when one has no price
 * (its row would print $0.00). The bid's schedule is there when the bid has one.
 */
export function aiaLineSources(input: {
  oneLine: PayApplicationLine[]
  lineItems: ReadonlyArray<JobLineItem>
  bidSchedule: BidSchedule | null
}): AiaLineSource[] {
  const sources: AiaLineSource[] = [
    { key: 'one', title: 'One row', detail: `The whole contract, ${money(sum(input.oneLine))}`, lines: input.oneLine, splitLaborMaterial: false },
  ]
  const named = namedLineItems(input.lineItems)
  if (named.length >= 2) {
    const unpriced = named.filter((item) => lineItemValue(item) <= 0).length
    const lines = linesFromJobLineItems(input.lineItems)
    sources.push(
      unpriced > 0
        ? {
            key: 'items',
            title: 'A row per Line Item',
            detail: unpriced === 1 ? '1 Line Item has no price. Price it on the Bill tab to use this.' : `${unpriced} Line Items have no price. Price them on the Bill tab to use this.`,
            lines: null,
            splitLaborMaterial: false,
          }
        : { key: 'items', title: 'A row per Line Item', detail: rowsDetail(lines), lines, splitLaborMaterial: false },
    )
  }
  if (input.bidSchedule && input.bidSchedule.lines.length > 0) {
    sources.push({
      key: 'bid',
      title: "The bid's schedule",
      detail: rowsDetail(input.bidSchedule.lines),
      lines: input.bidSchedule.lines,
      splitLaborMaterial: input.bidSchedule.splitLaborMaterial,
    })
  }
  return sources
}

/** The start already picked: the bid's schedule when the job has one (the GC saw it), else one row. */
export function defaultLineSource(sources: ReadonlyArray<AiaLineSource>): AiaLineSourceKey {
  return sources.some((s) => s.key === 'bid' && s.lines) ? 'bid' : 'one'
}
