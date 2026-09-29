import { describe, expect, it } from 'vitest'
import { procurementExportRows, procurementLogCsv, procurementLogFileName, procurementLogTsv, PROCUREMENT_EXPORT_COLUMNS } from './procurementLogExport'
import type { ProcurementRow } from './procurementLog'

const row = (o: Partial<ProcurementRow>): ProcurementRow => ({
  key: 'WC-1', tag: 'WC-1', isHand: false, recordId: null, product: 'TOTO TET2UB31#SS', supplyHouse: 'Moore Supply', stage: 'trim_set', submittal: 'approved', submittalAt: '2026-09-17', releasedOn: '2026-09-17',
  orderedOn: '2026-09-28', poRef: '118', leadTimeDays: 14, expectedOn: '2026-10-12', expectedSource: 'derived', requiredOn: '2026-11-17', floatDays: 36, orderBy: null, deliveredOn: null, note: '', status: 'ordered', late: false, countedWith: [], ...o,
})

describe('the procurement log as a spreadsheet (v2.4113)', () => {
  const rows = [
    row({}),
    row({ key: 'BFP-1', tag: 'BFP-1', product: 'Watts 909 RPZ, 2"', supplyHouse: 'Ferguson', stage: 'rough_in', expectedOn: '2026-10-20', expectedSource: 'house', requiredOn: '2026-10-06', floatDays: -14, late: true, note: 'Ferguson: 10/20\nearliest' }),
    row({ key: 'hand:1', tag: null, isHand: true, product: 'Grease interceptor 750 gal', supplyHouse: null, stage: null, submittal: 'none', submittalAt: null, releasedOn: null, orderedOn: null, poRef: '', leadTimeDays: 42, expectedOn: null, expectedSource: null, requiredOn: null, floatDays: null, status: 'not_submitted', late: false }),
  ]

  it('carries the printed sheet’s columns with dates a sheet reads, and escapes for CSV', () => {
    expect(PROCUREMENT_EXPORT_COLUMNS).toHaveLength(15)
    expect(procurementExportRows(rows)[0]).toEqual(['WC-1', 'TOTO TET2UB31#SS', 'Moore Supply', 'Trim set', 'Approved 09/17', '2026-09-17', '2026-09-28', '118', '2 wk', '2026-10-12', 'order date + lead time', '2026-11-17', '36 d', '', ''])
    expect(procurementExportRows(rows)[2]).toEqual(['', 'Grease interceptor 750 gal', '', '', 'n/a', '', '', '', '6 wk', '', '', '', '', '', ''])
    const csv = procurementLogCsv(rows)
    expect(csv.split('\r\n')[0]).toBe('Tag,Product,Supply house,Stage,Submittal,Released,Ordered,PO,Lead time,Expected,Expected from,Required,Float,Delivered,Note')
    expect(csv).toContain('"Watts 909 RPZ, 2"""')
    expect(csv).toContain('"Ferguson: 10/20\nearliest"')
    expect(csv.endsWith('\r\n')).toBe(true)
  })

  it('tab-separated text keeps one line per row for the paste into a sheet', () => {
    const tsv = procurementLogTsv(rows)
    const lines = tsv.split('\n')
    expect(lines).toHaveLength(4)
    expect(lines[2]).toBe('BFP-1\tWatts 909 RPZ, 2"\tFerguson\tRough-in\tApproved 09/17\t2026-09-17\t2026-09-28\t118\t2 wk\t2026-10-20\thouse\t2026-10-06\t−14 d\t\tFerguson: 10/20 earliest')
    expect(procurementLogFileName('B375 · SPACEX BA-02N Architectural', '2026-09-29')).toBe('procurement-log_B375-SPACEX-BA-02N-Architectural_2026-09-29.csv')
  })
})
