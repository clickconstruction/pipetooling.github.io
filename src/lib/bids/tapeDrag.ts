/**
 * A line of the bid dragged onto the Pricing Tape (Bids → Pricing): one grid row, or one line of
 * the Kind breakdown. The drag carries the line's numbers; the calculator asks which one, and
 * the number lands on the tape with its name (`applyNamed` in `lib/tapeCalculator.ts`).
 *
 * A breakdown line names a group of rows, so its revenue or cost times a number is a rule a
 * Percent row can follow (`sourceKey`). One row's numbers carry no key: no rule reads one row.
 * The group's numbers are the ones a rule would read (`percentSourceOptions`): saved prices,
 * with no row that carries a rule of its own. Pure.
 */
import { formatCurrency } from '../format'
import type { TapeSource } from '../tapeCalculator'
import type { PercentGridRow, PercentSourceOption } from './percentRow'
import { percentSourceRows, percentSourceWords } from './percentRow'

/** The drag's own type, so the calculator takes only a line of the bid. */
export const TAPE_DRAG_TYPE = 'application/x-pipetooling-tape-line'

export type TapeDragNumber = {
  key: 'revenue' | 'cost' | 'count' | 'unit-price'
  /** The press's word: Revenue, Count. */
  label: string
  /** The number, or null when the line has none (a cost with no takeoff behind it). */
  value: number | null
  /** The number as the press shows it: "$6,200.00", "300 ft". */
  display: string
  /** Why the press is dead; null when it is live. */
  hold: string | null
}

export type TapeDragLine = {
  /** The line's name: Pipe, WC. */
  label: string
  /** What stands beside it: "5 rows", "a row". */
  sub: string
  /** The group a rule can follow; null for one row. */
  sourceKey: string | null
  numbers: TapeDragNumber[]
}

const money = (n: number): string => `$${formatCurrency(n)}`
const amount = (n: number): string => (Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })
const NO_COST = 'none on these rows'

/** A Kind breakdown line, or a tag: the group's revenue, its count and its cost. */
export function tapeLineForGroup(option: PercentSourceOption, rows: ReadonlyArray<PercentGridRow>, unit: string): TapeDragLine {
  const src = percentSourceRows(rows, option.source, null)
  const count = src.reduce((s, r) => s + (Number.isFinite(r.count) ? r.count : 0), 0)
  return {
    label: percentSourceWords(option.source),
    sub: `${option.rows} ${option.rows === 1 ? 'row' : 'rows'}`,
    sourceKey: option.key,
    numbers: [
      { key: 'revenue', label: 'Revenue', value: option.revenue, display: money(option.revenue), hold: null },
      { key: 'count', label: 'Count', value: count, display: `${amount(count)} ${unit}`, hold: null },
      option.cost > 0 ? { key: 'cost', label: 'Cost', value: option.cost, display: money(option.cost), hold: null } : { key: 'cost', label: 'Cost', value: null, display: NO_COST, hold: 'These rows carry no takeoff cost yet' },
    ],
  }
}

/** One grid row: its revenue, its price per unit, its count and its cost. */
export function tapeLineForRow(row: PercentGridRow): TapeDragLine {
  const unpriced = 'This row has no price yet'
  return {
    label: row.name || 'This row',
    sub: 'a row',
    sourceKey: null,
    numbers: [
      row.priced ? { key: 'revenue', label: 'Revenue', value: row.revenue, display: money(row.revenue), hold: null } : { key: 'revenue', label: 'Revenue', value: null, display: 'not priced yet', hold: unpriced },
      row.priced ? { key: 'unit-price', label: 'Sale price per unit', value: row.unitPrice, display: money(row.unitPrice), hold: null } : { key: 'unit-price', label: 'Sale price per unit', value: null, display: 'not priced yet', hold: unpriced },
      { key: 'count', label: 'Count', value: row.count, display: amount(row.count), hold: null },
      row.cost > 0 ? { key: 'cost', label: 'Cost', value: row.cost, display: money(row.cost), hold: null } : { key: 'cost', label: 'Cost', value: null, display: 'none on this row', hold: 'This row carries no takeoff cost yet' },
    ],
  }
}

const NUMBER_WORDS: Record<TapeDragNumber['key'], string> = { revenue: 'revenue', cost: 'cost', count: 'count', 'unit-price': 'price per unit' }

/** The picked number as the tape names it: "Pipe revenue", with the group it can be a rule on. */
export function tapeSourceFor(line: TapeDragLine, number: TapeDragNumber): TapeSource {
  const basis: TapeSource['basis'] = number.key === 'revenue' || number.key === 'cost' || number.key === 'count' ? number.key : 'other'
  return { words: `${line.label} ${NUMBER_WORDS[number.key]}`, basis, sourceKey: basis === 'revenue' || basis === 'cost' ? line.sourceKey : null }
}

export function serializeTapeLine(line: TapeDragLine): string {
  return JSON.stringify(line)
}

const NUMBER_KEYS = ['revenue', 'cost', 'count', 'unit-price']

/** What was dropped, read back; null for anything that is not a line of the bid. */
export function parseTapeLine(text: string | null | undefined): TapeDragLine | null {
  if (!text) return null
  try {
    const o = JSON.parse(text) as Partial<TapeDragLine> | null
    if (!o || typeof o.label !== 'string' || typeof o.sub !== 'string' || !Array.isArray(o.numbers)) return null
    const numbers = o.numbers.filter(
      (n): n is TapeDragNumber =>
        !!n && typeof n === 'object' && NUMBER_KEYS.includes(String(n.key)) && typeof n.label === 'string' && typeof n.display === 'string' && (n.value === null || (typeof n.value === 'number' && Number.isFinite(n.value))) && (n.hold === null || typeof n.hold === 'string'),
    )
    if (numbers.length === 0) return null
    return { label: o.label, sub: o.sub, sourceKey: typeof o.sourceKey === 'string' ? o.sourceKey : null, numbers }
  } catch {
    return null
  }
}

/** The numbers a press can send: those with a value and no hold. */
export function liveTapeNumbers(line: TapeDragLine): TapeDragNumber[] {
  return line.numbers.filter((n) => n.value != null && n.hold == null)
}
