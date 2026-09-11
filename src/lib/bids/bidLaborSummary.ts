/**
 * The head of the New Labor view (the Labor refresh PR 1): whether the estimate
 * is usable as a job budget, and whether the whole bid makes sense.
 *
 * Completeness is the same idea the job's Burn budget will read after the win
 * (`to-dos/burn-against-the-bid/`): rows with hours over rows, a rate present,
 * where materials come from. The sanity strip turns hours into crew-days and
 * dollars and, against the bid value, revenue per field hour — the one figure
 * that ties an estimate to what finished jobs actually ran (the history band
 * lands with PR 3, once finished jobs link to their bids). Pure.
 */
import { laborRowHours, laborRowRough, laborRowTop, laborRowTrim } from './laborRowHours'
import { laborRowHasHours, laborRowIsSub } from './laborBookMatch'
import type { CostEstimateLaborRow } from './bidPricingEngineTypes'

/** A crew-day for the strip: two techs, eight hours. */
export const CREW_TECHS = 2
export const CREW_HOURS_PER_DAY = 8

/** `ft of 3/4IN WATER` · `feet of 12thhn` · `LF 2" waste` — a row whose count is length, not pieces. */
export const isFootageRow = (fixture: string | null | undefined): boolean => /^(ft|feet|lf|lin(ear)?\s*(ft|feet))\b/i.test((fixture ?? '').trim()) || /\bft of\b/i.test(fixture ?? '')

/** A row that reads per 100 ft, or whose words say footage (a legacy row the book never priced per 100 ft). */
export const isFootageLaborRow = (r: Pick<CostEstimateLaborRow, 'fixture'> & Partial<Pick<CostEstimateLaborRow, 'unit'>>): boolean => r.unit === 'per_100ft' || isFootageRow(r.fixture)

export type BidLaborSummary = {
  rowCount: number
  rowsWithHours: number
  rough: number
  top: number
  trim: number
  total: number
  crewDays: number
  /** null until a rate is set. */
  laborUsd: number | null
  /** bid value ÷ total hours; null without both. */
  revenuePerFieldHour: number | null
  /** Share of the hours that sit on footage rows (0–1). */
  footageHoursShare: number
}

export function summarizeBidLabor(args: { rows: ReadonlyArray<CostEstimateLaborRow>; ratePerHour: number | null; bidValue: number | null }): BidLaborSummary {
  const rows = args.rows
  const rough = rows.reduce((s, r) => s + laborRowRough(r), 0)
  const top = rows.reduce((s, r) => s + laborRowTop(r), 0)
  const trim = rows.reduce((s, r) => s + laborRowTrim(r), 0)
  const total = rough + top + trim
  const footage = rows.filter(isFootageLaborRow).reduce((s, r) => s + laborRowHours(r), 0)
  const rate = args.ratePerHour != null && args.ratePerHour > 0 ? args.ratePerHour : null
  const bid = args.bidValue != null && args.bidValue > 0 ? args.bidValue : null
  return {
    rowCount: rows.length,
    rowsWithHours: rows.filter(laborRowHasHours).length,
    rough,
    top,
    trim,
    total,
    crewDays: total / (CREW_TECHS * CREW_HOURS_PER_DAY),
    laborUsd: rate != null ? total * rate : null,
    revenuePerFieldHour: bid != null && total > 0 ? bid / total : null,
    footageHoursShare: total > 0 ? footage / total : 0,
  }
}

export type LaborMaterialsSource = 'takeoff' | 'none'

export type LaborEstimateCompleteness = {
  hoursRows: number
  /** Rows that need hours — sub lines are not counted here. */
  totalRows: number
  /** Sub lines on the sheet (answered without hours; priced under direct costs). */
  subRows: number
  /** 0–1. */
  hoursShare: number
  rateSet: boolean
  materialsSource: LaborMaterialsSource
  /** Hours on 90 % of the rows or more, and a rate — the job can burn against this. */
  usable: boolean
  pills: Array<{ tone: 'ok' | 'warn' | 'muted'; text: string }>
}

export const LABOR_COMPLETENESS_HOURS_SHARE = 0.9

export function laborEstimateCompleteness(args: { rows: ReadonlyArray<CostEstimateLaborRow>; rateSet: boolean; materialsSource: LaborMaterialsSource }): LaborEstimateCompleteness {
  const subRows = args.rows.filter(laborRowIsSub).length
  const ours = args.rows.filter((r) => !laborRowIsSub(r))
  const totalRows = ours.length
  const hoursRows = ours.filter(laborRowHasHours).length
  const hoursShare = totalRows > 0 ? hoursRows / totalRows : subRows > 0 ? 1 : 0
  const missing = totalRows - hoursRows
  const usable = args.rows.length > 0 && hoursShare >= LABOR_COMPLETENESS_HOURS_SHARE && args.rateSet
  const pills: LaborEstimateCompleteness['pills'] = []
  if (args.rows.length === 0) pills.push({ tone: 'muted', text: 'no rows yet' })
  else if (totalRows > 0) pills.push({ tone: hoursShare >= LABOR_COMPLETENESS_HOURS_SHARE ? 'ok' : 'warn', text: `hours on ${hoursRows} of ${totalRows} row${totalRows === 1 ? '' : 's'}` })
  if (missing > 0) pills.push({ tone: 'warn', text: `${missing} row${missing === 1 ? '' : 's'} need${missing === 1 ? 's' : ''} hours ↓` })
  if (subRows > 0) pills.push({ tone: 'muted', text: `${subRows} sub line${subRows === 1 ? '' : 's'}` })
  pills.push(args.rateSet ? { tone: 'ok', text: 'rate set' } : { tone: 'warn', text: 'no labor rate' })
  pills.push(args.materialsSource === 'takeoff' ? { tone: 'ok', text: 'materials from takeoff' } : { tone: 'muted', text: 'no materials yet' })
  return { hoursRows, totalRows, subRows, hoursShare, rateSet: args.rateSet, materialsSource: args.materialsSource, usable, pills }
}

/** A sentence for the strip's revenue-per-field-hour tile, without a history band yet. */
export function revenuePerFieldHourWords(s: BidLaborSummary): string | null {
  if (s.revenuePerFieldHour == null) return s.total > 0 ? 'set a bid value to compare' : 'add hours to compare'
  return `bid value ÷ ${Math.round(s.total).toLocaleString('en-US')} h`
}
