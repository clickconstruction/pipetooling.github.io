/**
 * The procurement log as a spreadsheet (v2.4113): the same columns the printed sheet carries,
 * one row per item, as CSV (Download CSV) and as tab-separated text (Open in Google Sheets:
 * copied to the clipboard, a new sheet opened, the estimator pastes). The tag and the product
 * are one Item cell, tag first, as on the screen and the sheet. Pure.
 */
import { escapeCsvField } from '../domTableToCsv'
import { describeLeadTime } from './leadTime'
import { floatText, procurementItemText, submittalWord, type ProcurementRow } from './procurementLog'

export const PROCUREMENT_EXPORT_COLUMNS = ['Item', 'Supply house', 'Stage', 'Submittal', 'Released', 'Ordered', 'PO', 'Lead time', 'Expected', 'Expected from', 'Required', 'Float', 'Delivered', 'Note'] as const

const STAGE_WORDS: Record<string, string> = { rough_in: 'Rough-in', top_out: 'Top-out', trim_set: 'Trim set' }

/** One export row per log row, dates as YYYY-MM-DD so a sheet reads them as dates. */
export function procurementExportRows(rows: ReadonlyArray<ProcurementRow>): string[][] {
  return rows.map((r) => [
    procurementItemText(r),
    r.supplyHouse ?? '',
    r.stage ? STAGE_WORDS[r.stage] ?? r.stage : '',
    submittalWord(r),
    r.releasedOn ?? '',
    r.orderedOn ?? '',
    r.poRef,
    describeLeadTime(r.leadTimeDays) ?? '',
    r.expectedOn ?? '',
    r.expectedOn ? (r.expectedSource === 'house' ? 'house' : 'order date + lead time') : '',
    r.requiredOn ?? '',
    floatText(r),
    r.deliveredOn ?? '',
    r.note,
  ])
}

export function procurementLogCsv(rows: ReadonlyArray<ProcurementRow>): string {
  const lines = [PROCUREMENT_EXPORT_COLUMNS.map((c) => escapeCsvField(c)).join(',')]
  for (const r of procurementExportRows(rows)) lines.push(r.map(escapeCsvField).join(','))
  return lines.join('\r\n') + '\r\n'
}

/** Tab-separated, one line per row, with tabs and newlines inside a cell turned to spaces — what a sheet pastes into cells. */
export function procurementLogTsv(rows: ReadonlyArray<ProcurementRow>): string {
  const clean = (s: string) => s.replace(/[\t\r\n]+/g, ' ').trim()
  const lines = [PROCUREMENT_EXPORT_COLUMNS.join('\t')]
  for (const r of procurementExportRows(rows)) lines.push(r.map(clean).join('\t'))
  return lines.join('\n')
}

/** "procurement-log_B375-SPACEX-BA-02N_2026-09-29.csv" */
export function procurementLogFileName(bidLabel: string, onDate: string): string {
  const part = bidLabel.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'bid'
  return `procurement-log_${part}_${onDate}.csv`
}
