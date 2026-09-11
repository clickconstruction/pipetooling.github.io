import { describe, expect, it } from 'vitest'
import { buildOverheadPeopleTable, type OverheadPeoplePartsInput } from './overheadPeopleTable'
import type { OverheadSessionDetailLine } from './overheadDailyLabor'
import { buildOverheadPeopleCellModel, overheadCellWeekStart, overheadPeopleCellCsv } from './overheadPeopleCellModel'

const sess = (over: Partial<OverheadSessionDetailLine> & { sessionId: string; workDate: string; userName: string }): OverheadSessionDetailLine => ({
  bucket: 'office',
  hours: 8,
  laborUsd: 8 * 20,
  missingWage: false,
  jobLedgerId: 'office',
  bidId: null,
  notes: null,
  clockedInAt: `${over.workDate}T13:00:00Z`,
  clockedOutAt: `${over.workDate}T21:00:00Z`,
  approved: true,
  wageUsdPerHour: 20,
  ...over,
})
const labor: OverheadSessionDetailLine[] = [
  sess({ sessionId: 's1', workDate: '2026-09-08', userName: 'Taunya', notes: 'AR calls' }),
  sess({ sessionId: 's2', workDate: '2026-09-09', userName: 'Taunya', approved: false }),
  sess({ sessionId: 's3', workDate: '2026-09-05', userName: 'Taunya', hours: 12, laborUsd: 240 }), // Saturday, long
  sess({ sessionId: 's4', workDate: '2026-09-09', userName: 'Wendi', bucket: 'bid', bidId: 'b431', hours: 3, laborUsd: 60 }),
  sess({ sessionId: 's5', workDate: '2026-09-09', userName: 'Darren', hours: 4, laborUsd: 0, missingWage: true, wageUsdPerHour: null }),
  sess({ sessionId: 's6', workDate: '2026-08-01', userName: 'Taunya' }), // outside a 7-day window
]
const parts: OverheadPeoplePartsInput[] = [
  { workDate: '2026-09-08', amountUsd: 120, person: 'Malachi 6783', line: { source: 'mercury', label: 'Home Depot', mercuryTransactionId: 'tx1' }, bucket: 'materials', cardLabel: 'Malachi 6783' },
  { workDate: '2026-09-09', amountUsd: 300, person: null, line: { source: 'supply', label: 'Ferguson inv. 1188' }, bucket: null, cardLabel: null },
  { workDate: '2026-09-07', amountUsd: 45, person: 'Taunya or Wendi', line: { source: 'mercury', label: 'Amazon', mercuryTransactionId: 'tx2' }, bucket: 'office_software', cardLabel: 'Taunya or Wendi' },
]
const table = buildOverheadPeopleTable({ labor, parts, endYmd: '2026-09-10', days: 7 })

describe('buildOverheadPeopleCellModel', () => {
  it('a person × office labor: the lines in the window, by Sun–Sat week newest first, tying to the cell', () => {
    const m = buildOverheadPeopleCellModel({ table, person: 'Taunya', column: 'officeLaborUsd', labor, parts })
    expect(m.cellUsd).toBe(160 + 160 + 240)
    expect(m.sumUsd).toBe(560)
    expect(m.ties).toBe(true)
    expect(m.hours).toBe(28)
    expect(m.avgRateUsd).toBe(20)
    expect(m.sections.map((s) => s.kind)).toEqual(['office'])
    const groups = m.sections[0]!.groups
    expect(groups.map((g) => g.key)).toEqual(['2026-09-06', '2026-08-30']) // weeks of Sun Sep 6 and Sun Aug 30
    expect(groups[0]!.lines.map((l) => l.id)).toEqual(['s2', 's1'])
    expect(groups[1]!.lines.map((l) => l.id)).toEqual(['s3'])
    const s3 = groups[1]!.lines[0]!
    expect(s3.kind === 'session' && s3.long && s3.weekend).toBe(true)
    expect(groups[0]!.flagged).toBe(1) // s2 awaiting approval
    expect(m.counts).toMatchObject({ lines: 3, pending: 1, long: 1, noWage: 0, noPerson: 0, shown: 3 })
  })
  it('the Total column stacks the three sections; the no-person row shows purchases only', () => {
    const t = buildOverheadPeopleCellModel({ table, person: 'Taunya', column: 'totalUsd', labor, parts })
    expect(t.sections.map((s) => [s.kind, s.lineCount])).toEqual([
      ['office', 3],
      ['bid', 0],
      ['parts', 0],
    ])
    expect(t.ties).toBe(true)
    const none = buildOverheadPeopleCellModel({ table, person: 'No person — supply invoices, ACH/wire, tally', unattributed: true, column: 'officePartsUsd', labor, parts })
    expect(none.sections.map((s) => s.kind)).toEqual(['parts'])
    expect(none.sumUsd).toBe(300)
    expect(none.ties).toBe(true)
    expect(none.counts.noPerson).toBe(1)
    // The shared card is its own person, not "no person".
    const shared = buildOverheadPeopleCellModel({ table, person: 'Taunya or Wendi', column: 'officePartsUsd', labor, parts })
    expect(shared.sumUsd).toBe(45)
    expect(shared.ties).toBe(true)
  })
  it('the Pool row groups by person, ranked by dollars, with "no person" last', () => {
    const m = buildOverheadPeopleCellModel({ table, person: null, column: 'officePartsUsd', labor, parts })
    expect(m.cellUsd).toBe(465)
    expect(m.ties).toBe(true)
    expect(m.sections[0]!.groups.map((g) => g.title)).toEqual(['Malachi', 'Taunya or Wendi', 'No person — supply invoices, ACH/wire, tally'])
    const total = buildOverheadPeopleCellModel({ table, person: null, column: 'totalUsd', labor, parts })
    expect(total.ties).toBe(true)
    expect(total.counts.noWage).toBe(1)
  })
  it('largest first reorders lines and weeks; the filter narrows what is shown but not the sum', () => {
    const largest = buildOverheadPeopleCellModel({ table, person: 'Taunya', column: 'officeLaborUsd', labor, parts, order: 'largest' })
    // Weeks rank by their sum ($320 for the week of Sep 6 vs $240 for Aug 30); within a week the biggest line leads, ties newest first.
    expect(largest.sections[0]!.groups.map((g) => g.key)).toEqual(['2026-09-06', '2026-08-30'])
    expect(largest.sections[0]!.groups[0]!.lines.map((l) => l.id)).toEqual(['s2', 's1'])
    const filtered = buildOverheadPeopleCellModel({ table, person: 'Taunya', column: 'officeLaborUsd', labor, parts, filter: 'ar calls' })
    expect(filtered.sumUsd).toBe(560)
    expect(filtered.counts.shown).toBe(1)
    expect(filtered.sections[0]!.groups.flatMap((g) => g.lines.map((l) => l.id))).toEqual(['s1'])
    const byBid = buildOverheadPeopleCellModel({ table, person: 'Wendi', column: 'bidLaborUsd', labor, parts, filter: 'palmer', bidLabelById: new Map([['b431', 'B431 Palmer Winery']]) })
    expect(byBid.counts.shown).toBe(1)
    expect(byBid.bidIds).toEqual(['b431'])
  })
  it('rolls a person\'s punches into day rows inside each week; punches keep clock order; a stray tap is chipped', () => {
    const punches: OverheadSessionDetailLine[] = [
      sess({ sessionId: 'p1', workDate: '2026-09-08', userName: 'Taunya', hours: 4.9, laborUsd: 98, clockedInAt: '2026-09-08T13:32:00Z', clockedOutAt: '2026-09-08T18:26:00Z' }),
      sess({ sessionId: 'p2', workDate: '2026-09-08', userName: 'Taunya', hours: 0.17, laborUsd: 3.4, clockedInAt: '2026-09-08T13:03:00Z', clockedOutAt: '2026-09-08T13:13:00Z', approved: false }),
      sess({ sessionId: 'p3', workDate: '2026-09-08', userName: 'Taunya', hours: 0.03, laborUsd: 0.6, clockedInAt: '2026-09-08T18:49:00Z', clockedOutAt: '2026-09-08T18:51:00Z' }),
      sess({ sessionId: 'p4', workDate: '2026-09-09', userName: 'Taunya', hours: 8, laborUsd: 160 }),
    ]
    const t = buildOverheadPeopleTable({ labor: punches, parts: [], endYmd: '2026-09-10', days: 7 })
    const m = buildOverheadPeopleCellModel({ table: t, person: 'Taunya', column: 'officeLaborUsd', labor: punches, parts: [] })
    const days = m.sections[0]!.groups[0]!.days!
    expect(days.map((d) => [d.ymd, d.punches.length, Math.round(d.hours * 100) / 100])).toEqual([
      ['2026-09-09', 1, 8],
      ['2026-09-08', 3, 5.1],
    ])
    expect(days[1]!.punches.map((x) => x.id)).toEqual(['p2', 'p1', 'p3']) // clock order, not amount
    expect(days[1]!.pending).toBe(true)
    expect(days[1]!.stray).toBe(2)
    expect(m.counts.stray).toBe(2)
    expect(m.counts.lines).toBe(4) // the CSV and counts still see every punch
    const largest = buildOverheadPeopleCellModel({ table: t, person: 'Taunya', column: 'officeLaborUsd', labor: punches, parts: [], order: 'largest' })
    expect(largest.sections[0]!.groups[0]!.days!.map((d) => d.ymd)).toEqual(['2026-09-09', '2026-09-08'])
  })
  it('week starts on Sunday', () => {
    expect(overheadCellWeekStart('2026-09-10')).toBe('2026-09-06') // Thu → Sun
    expect(overheadCellWeekStart('2026-09-06')).toBe('2026-09-06')
    expect(overheadCellWeekStart('2026-09-05')).toBe('2026-08-30') // Sat → previous Sun
  })
  it('CSV carries one row per line with status and section', () => {
    const m = buildOverheadPeopleCellModel({ table, person: null, column: 'totalUsd', labor, parts })
    const csv = overheadPeopleCellCsv(m, new Map([['b431', 'B431 Palmer Winery']]))
    const rows = csv.split('\n')
    expect(rows[0]).toBe('date,person,kind,description,hours,rate,amount,status,section,source')
    expect(rows.length).toBe(1 + 5 + 3)
    expect(rows.some((r) => r.startsWith('2026-09-09,Wendi,bid labor,B431 Palmer Winery,3.00,20.00,60.00,approved'))).toBe(true)
    expect(rows.some((r) => r.includes('awaiting approval'))).toBe(true)
    expect(rows.some((r) => r.startsWith('2026-09-09,,office parts,Ferguson inv. 1188,,,300.00,,,supply'))).toBe(true)
  })
})
