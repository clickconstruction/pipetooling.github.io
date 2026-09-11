import { describe, expect, it } from 'vitest'
import { isStaffOutflow, parseCashAppCsv, parseCashAppMoney } from './parseCashAppCsv'
import { aliasKey, resolveCashAppPerson, unresolvedCounterparties, type CashAppAlias } from './cashAppAliases'
import { classifyCashAppNote } from './cashAppLane'

const HEADER =
  '"Date","Transaction ID","Transaction Type","Currency","Amount","Fee","Net Amount","Asset Type","Asset Price","Asset Amount","Status","Notes","Name of sender/receiver","Account"'
const line = (date: string, id: string, type: string, amt: string, status: string, note: string, name: string) =>
  `"${date}","${id}","${type}","USD","${amt}","$0.00","${amt}","","","","${status}","${note}","${name}","Mastercard debit 0744"`

describe('parseCashAppMoney', () => {
  it('reads the export forms', () => {
    expect(parseCashAppMoney('-$300.00')).toBe(-300)
    expect(parseCashAppMoney('$1,200.00')).toBe(1200)
    expect(parseCashAppMoney('')).toBe(0)
    expect(parseCashAppMoney('abc')).toBeNull()
  })
})

describe('parseCashAppCsv', () => {
  const csv = [
    HEADER,
    line('2026-09-11 11:50:56 CDT', '#D-3V3MVPKVP', 'P2P', '-$300.00', 'COMPLETE', 'Week', 'Darren Phelps'),
    line('2026-09-10 09:35:32 CDT', '#D-JZVLG7QJX', 'P2P', '-$60.00', 'COMPLETE', 'Gas', 'Emily Furlong'),
    line('2026-09-09 08:00:00 CDT', '#D-DEPOSIT01', 'Deposits', '$2,000.00', 'COMPLETE', '', ''),
    line('2026-09-08 08:00:00 CDT', '#D-FAILED001', 'P2P', '-$50.00', 'FAILED', 'Week', 'Kyle Willmann'),
    line('2026-09-08 08:00:00 CDT', '#D-3V3MVPKVP', 'P2P', '-$300.00', 'COMPLETE', 'Week', 'Darren Phelps'),
    line('bad date', '#D-BAD', 'P2P', '-$1.00', 'COMPLETE', '', 'X'),
  ].join('\n')

  it('parses rows, keeps the sign, drops duplicates and bad rows, and flags staff outflows', () => {
    const out = parseCashAppCsv(csv)
    expect(out.rows.map((r) => r.id)).toEqual(['#D-3V3MVPKVP', '#D-JZVLG7QJX', '#D-DEPOSIT01', '#D-FAILED001'])
    expect(out.skipped).toBe(2)
    expect(out.warnings[0]).toMatch(/2 rows skipped/)
    const first = out.rows[0]!
    expect(first).toMatchObject({ occurredDate: '2026-09-11', txType: 'P2P', status: 'COMPLETE', amount: -300, netAmount: -300, note: 'Week', counterparty: 'Darren Phelps', account: 'Mastercard debit 0744' })
    expect(out.rows.filter(isStaffOutflow).map((r) => r.id)).toEqual(['#D-3V3MVPKVP', '#D-JZVLG7QJX'])
  })

  it('rejects a file that is not a Cash App export', () => {
    const out = parseCashAppCsv('Date,Amount\n2026-01-01,5')
    expect(out.rows).toEqual([])
    expect(out.warnings[0]).toMatch(/missing column/)
  })

  it('tolerates a BOM and an empty file', () => {
    expect(parseCashAppCsv('﻿' + HEADER + '\n' + line('2026-01-02 00:00:00 CST', '#D-1', 'P2P', '-$5.00', 'COMPLETE', '', 'A')).rows).toHaveLength(1)
    expect(parseCashAppCsv('').warnings).toEqual(['Empty file'])
  })
})

describe('aliases', () => {
  const aliases: CashAppAlias[] = [
    { counterpartyKey: aliasKey('Abe Whites'), personName: 'Abraham', notStaff: false, noteContains: null, notePersonName: null },
    { counterpartyKey: aliasKey('Taunya Villarreal'), personName: 'Taunya', notStaff: false, noteContains: 'tristen', notePersonName: 'Tristen' },
    { counterpartyKey: aliasKey('Jessica Whites'), personName: 'Malachi', notStaff: false, noteContains: null, notePersonName: null },
    { counterpartyKey: aliasKey('Plumbing Supply Co'), personName: null, notStaff: true, noteContains: null, notePersonName: null },
  ]

  it('normalizes keys and resolves plain, proxy, note-rule, not-staff and unknown names', () => {
    expect(aliasKey('  abe   WHITES ')).toBe('abe whites')
    expect(resolveCashAppPerson({ counterparty: 'ABE WHITES', note: 'Week' }, aliases)).toEqual({ kind: 'person', personName: 'Abraham', viaProxy: false })
    expect(resolveCashAppPerson({ counterparty: 'Taunya Villarreal', note: 'Tristen week' }, aliases)).toEqual({ kind: 'person', personName: 'Tristen', viaProxy: true })
    expect(resolveCashAppPerson({ counterparty: 'Taunya Villarreal', note: 'Week' }, aliases)).toEqual({ kind: 'person', personName: 'Taunya', viaProxy: false })
    expect(resolveCashAppPerson({ counterparty: 'Jessica Whites', note: 'Advance' }, aliases)).toEqual({ kind: 'person', personName: 'Malachi', viaProxy: false })
    expect(resolveCashAppPerson({ counterparty: 'Plumbing Supply Co', note: '' }, aliases)).toEqual({ kind: 'not_staff' })
    expect(resolveCashAppPerson({ counterparty: 'Cale Yarbrough', note: 'Week' }, aliases)).toEqual({ kind: 'unknown' })
  })

  it('lists unresolved counterparties biggest first with sample notes', () => {
    const out = unresolvedCounterparties(
      [
        { counterparty: 'Cale Yarbrough', note: 'Week', amount: -2000 },
        { counterparty: 'cale yarbrough', note: 'Week 2', amount: -908.97 },
        { counterparty: 'Kyle Willmann', note: 'Hours', amount: -300 },
        { counterparty: 'Abe Whites', note: 'Week', amount: -1200 },
      ],
      aliases,
    )
    expect(out.map((u) => [u.counterparty, u.count, u.total])).toEqual([
      ['Cale Yarbrough', 2, 2908.97],
      ['Kyle Willmann', 1, 300],
    ])
    expect(out[0]?.notes).toEqual(['Week', 'Week 2'])
  })
})

describe('classifyCashAppNote', () => {
  it('reads the owner\'s vocabulary', () => {
    expect(classifyCashAppNote('Week')).toBe('pay')
    expect(classifyCashAppNote('last week')).toBe('pay')
    expect(classifyCashAppNote('')).toBe('pay')
    expect(classifyCashAppNote('Advance')).toBe('advance')
    expect(classifyCashAppNote('Gas')).toBe('expense')
    expect(classifyCashAppNote('Reimbursement')).toBe('expense')
    expect(classifyCashAppNote('home depot')).toBe('expense')
    expect(classifyCashAppNote('gas advance')).toBe('expense')
  })
})
