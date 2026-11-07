import { describe, expect, it } from 'vitest'
import { buildHoursStatement } from './hoursStatement'
import { hoursStatementSheetCounts, hoursStatementSheetDay, hoursStatementSheetLabel, hoursStatementSheetLineHours, hoursStatementSheetLineNote, hoursStatementSheetPayGroups, hoursStatementSheetRows, hoursStatementSheetsInSpan, type HoursStatementSheet, type HoursStatementSheetLine, type HoursStatementSheetPayment } from './hoursStatementSheets'

/** A sub's sheet lines as the paper's rows (punch list #212, residual D, v2.6636). Every name, job and number here is made up. */
const sheets: HoursStatementSheet[] = [
  { id: 'sh-b', jobDate: '2026-05-18', createdYmd: '2026-05-10', laborRate: 60 },
  { id: 'sh-a', jobDate: '2026-05-04', createdYmd: '2026-05-01', laborRate: 60 },
  { id: 'sh-c', jobDate: null, createdYmd: '2026-06-02', laborRate: 50 },
  { id: 'sh-old', jobDate: '2026-02-11', createdYmd: null, laborRate: 60 },
]
const lines: HoursStatementSheetLine[] = [
  { sheetId: 'sh-a', fixture: 'Tub and shower rough-in', count: 12, hrsPerUnit: 2.5, isFixed: false, laborRate: null, directLaborAmount: null, order: 1 },
  { sheetId: 'sh-a', fixture: 'Water heater set', count: 2, hrsPerUnit: 5, isFixed: false, laborRate: 80, directLaborAmount: null, order: 2 },
  { sheetId: 'sh-b', fixture: 'Trim-out, 2nd floor', count: 1, hrsPerUnit: 24, isFixed: true, laborRate: null, directLaborAmount: null, order: 1 },
  { sheetId: 'sh-c', fixture: 'Top Out', count: 1, hrsPerUnit: 0, isFixed: false, laborRate: null, directLaborAmount: 2200, order: 1 },
  { sheetId: 'sh-old', fixture: 'Before the span', count: 1, hrsPerUnit: 8, isFixed: false, laborRate: null, directLaborAmount: null, order: 1 },
]
const payments: HoursStatementSheetPayment[] = [
  { sheetId: 'sh-a', amount: 2600, on: '2026-05-15', memo: 'WO-118 final, check 2291' },
  { sheetId: 'sh-b', amount: 1440, on: null, memo: null },
  { sheetId: 'sh-c', amount: 1000, on: '2026-06-05', memo: 'Work 50% complete' },
]
const span = { from: '2026-05-01', to: '2026-06-30' }

describe("a sub's sheet lines on the paper", () => {
  it('a sheet counts on its job date, else the day it was made; the sheets in the span are numbered in day order over every sheet on the job', () => {
    expect(hoursStatementSheetDay(sheets[0]!)).toBe('2026-05-18')
    expect(hoursStatementSheetDay(sheets[2]!)).toBe('2026-06-02')
    expect(hoursStatementSheetDay({ jobDate: null, createdYmd: null })).toBe('')
    expect(hoursStatementSheetLabel(2, '2026-03-11')).toBe('Sheet 2 · March 11, 2026')
    expect(hoursStatementSheetsInSpan(sheets, span).map((s) => [s.sheet.id, s.n, s.label])).toEqual([
      ['sh-a', 2, 'Sheet 2 · May 4, 2026'],
      ['sh-b', 3, 'Sheet 3 · May 18, 2026'],
      ['sh-c', 4, 'Sheet 4 · June 2, 2026'],
    ])
  })

  it('a line’s hours are the agreed units, the hours alone on a fixed line, none on a flat amount; the note is the fixture with its count', () => {
    expect(hoursStatementSheetLineHours(lines[0]!)).toBe(30)
    expect(hoursStatementSheetLineHours(lines[2]!)).toBe(24)
    expect(hoursStatementSheetLineHours(lines[3]!)).toBe(0)
    expect(hoursStatementSheetLineNote(lines[0]!)).toBe('Tub and shower rough-in × 12')
    expect(hoursStatementSheetLineNote(lines[2]!)).toBe('Trim-out, 2nd floor')
    expect(hoursStatementSheetLineNote({ fixture: '  ', count: 1 })).toBe('a line')
  })

  it('the rows carry the sheet as their group, the line’s own rate over the sheet’s, and the line’s cost as the Sub Labor screens price it', () => {
    const rows = hoursStatementSheetRows(sheets, lines, span)
    expect(rows.map((r) => [r.day, r.hours, r.note, r.rate, r.amount, r.group?.label])).toEqual([
      ['2026-05-04', 30, 'Tub and shower rough-in × 12', 60, 1800, 'Sheet 2 · May 4, 2026'],
      ['2026-05-04', 10, 'Water heater set × 2', 80, 800, 'Sheet 2 · May 4, 2026'],
      ['2026-05-18', 24, 'Trim-out, 2nd floor', 60, 1440, 'Sheet 3 · May 18, 2026'],
      ['2026-06-02', 0, 'Top Out', 50, 2200, 'Sheet 4 · June 2, 2026'],
    ])
    expect(rows.every((r) => r.inLabel == null && r.outLabel == null)).toBe(true)
  })

  it('one pay group a sheet: the sheet’s total due, its payments on their days or the sheet’s', () => {
    const groups = hoursStatementSheetPayGroups(sheets, lines, payments, span)
    expect(groups.map((g) => [g.key, g.label, g.from, g.due, g.payments.map((p) => [p.on, p.amount, p.memo])])).toEqual([
      ['sh-a', 'Sheet 2 · May 4, 2026', '2026-05-04', 2600, [['2026-05-15', 2600, 'WO-118 final, check 2291']]],
      ['sh-b', 'Sheet 3 · May 18, 2026', '2026-05-18', 1440, [['2026-05-18', 1440, null]]],
      ['sh-c', 'Sheet 4 · June 2, 2026', '2026-06-02', 2200, [['2026-06-05', 1000, 'Work 50% complete']]],
    ])
    expect(hoursStatementSheetCounts(sheets, lines, span)).toEqual({ sheets: 3, lines: 4 })
  })

  it('through the kernel: the paper groups by sheet, calls the hours on the sheets, and pays per sheet', () => {
    const s = buildHoursStatement({ kind: 'sheet', periodStart: span.from, periodEnd: span.to, withPay: true, rows: hoursStatementSheetRows(sheets, lines, span), payGroups: hoursStatementSheetPayGroups(sheets, lines, payments, span), worker: { name: 'Dale Whitfield', company: 'Whitfield Plumbing Services' } })
    expect(s.groups.map((g) => [g.label, g.hours, g.amount])).toEqual([
      ['Sheet 2 · May 4, 2026', 40, 2600],
      ['Sheet 3 · May 18, 2026', 24, 1440],
      ['Sheet 4 · June 2, 2026', 0, 2200],
    ])
    expect(s.totals).toMatchObject({ hours: 64, amount: 6240, label: 'On the sheets, this job' })
    expect(s.pay?.lines.map((l) => l.words)).toEqual([
      'Sheet 2 · May 4, 2026 · $2,600.00 · paid in full $2,600.00 on May 15, 2026 · WO-118 final, check 2291',
      'Sheet 3 · May 18, 2026 · $1,440.00 · paid in full $1,440.00 on May 18, 2026',
      'Sheet 4 · June 2, 2026 · $2,200.00 · paid $1,000.00 of $2,200.00: $1,000.00 on June 5, 2026 · Work 50% complete',
    ])
    expect(s.attestation).toContain('for Whitfield Plumbing Services')
  })
})
