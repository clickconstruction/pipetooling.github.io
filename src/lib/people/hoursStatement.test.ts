import { describe, expect, it } from 'vitest'
import {
  buildHoursStatement,
  hoursStatementAttestation,
  hoursStatementDayLabel,
  hoursStatementGap,
  hoursStatementHours,
  hoursStatementMoney,
  hoursStatementPeriodLabel,
  hoursStatementReference,
  hoursStatementWeekStart,
  type HoursStatementInput,
  type HoursStatementPayGroup,
  type HoursStatementRow,
} from './hoursStatement'

// Every name, job, hour and amount here is made up.
const worker = { name: 'Marcus Reyes' }

function clockRow(day: string, hours: number, note: string, extra: Partial<HoursStatementRow> = {}): HoursStatementRow {
  return { day, hours, note, inLabel: '7:02 am', outLabel: '3:34 pm', ...extra }
}

const juneRows: HoursStatementRow[] = [
  clockRow('2026-06-01', 8.5, 'Rough-in, 2nd floor stacks'),
  clockRow('2026-06-02', 8, 'Rough-in, 2nd floor stacks'),
  clockRow('2026-06-03', 7.5, 'Water lines, units 201–206'),
  clockRow('2026-06-04', 7.5, 'Water lines, units 207–212'),
  clockRow('2026-06-08', 8.5, 'Drain test, Bldg B'),
  clockRow('2026-06-09', 8, 'Drain test, Bldg B'),
]

const weekMay31: HoursStatementPayGroup = { key: 'stub-1', label: 'Week of May 31', from: '2026-05-31', to: '2026-06-06', due: 864, payments: [{ on: '2026-06-12', amount: 864, memo: null, sourceKind: 'cashapp', sourceId: 'D-7K2M4Q' }] }
const weekJune7: HoursStatementPayGroup = { key: 'stub-2', label: 'Week of June 7', from: '2026-06-07', to: '2026-06-13', due: 912, payments: [{ on: '2026-06-19', amount: 912, memo: 'Cash App #D-7K9P1R "week 2"', sourceKind: 'cashapp', sourceId: 'D-7K9P1R' }] }
const juneWeeks: HoursStatementPayGroup[] = [weekMay31, weekJune7]

function helperInput(over: Partial<HoursStatementInput> = {}): HoursStatementInput {
  return { kind: 'clock', periodStart: '2026-06-01', periodEnd: '2026-06-13', rows: juneRows, withPay: true, dayRates: { '2026-06-01': 24, '2026-06-02': 24, '2026-06-03': 24, '2026-06-04': 24, '2026-06-08': 24, '2026-06-09': 24 }, payGroups: juneWeeks, firstRecordedDay: '2026-03-12', worker, ...over }
}

describe('the calendar helpers', () => {
  it('finds the Sunday that starts a company week and labels a day', () => {
    expect(hoursStatementWeekStart('2026-06-03')).toBe('2026-05-31')
    expect(hoursStatementWeekStart('2026-05-31')).toBe('2026-05-31')
    expect(hoursStatementDayLabel('2026-06-01')).toBe('Mon Jun 1')
    expect(hoursStatementPeriodLabel('2026-06-01', '2026-06-28')).toBe('June 1 – June 28, 2026')
    expect(hoursStatementPeriodLabel('2025-09-15', '2026-03-11')).toBe('September 15, 2025 – March 11, 2026')
  })
  it('prints hours and money the way the paper does', () => {
    expect(hoursStatementHours(8.5)).toBe('8.5')
    expect(hoursStatementHours(8)).toBe('8')
    expect(hoursStatementHours(0.25)).toBe('0.25')
    expect(hoursStatementMoney(2844)).toBe('$2,844.00')
    expect(hoursStatementMoney(756.5)).toBe('$756.50')
  })
  it('names a payment by its memo, else by its source', () => {
    expect(hoursStatementReference({ on: '2026-06-12', amount: 1, memo: 'check 2291', sourceKind: 'other', sourceId: null })).toBe('check 2291')
    expect(hoursStatementReference({ on: '2026-06-12', amount: 1, memo: null, sourceKind: 'cashapp', sourceId: 'D-1' })).toBe('Cash App #D-1')
    expect(hoursStatementReference({ on: '2026-06-12', amount: 1, memo: '  ', sourceKind: 'mercury', sourceId: 'm1' })).toBe('bank transfer')
    expect(hoursStatementReference({ on: '2026-06-12', amount: 1, memo: null, sourceKind: null, sourceId: null })).toBe('')
  })
})

describe("a helper's clock rows", () => {
  const s = buildHoursStatement(helperInput())
  it('groups the days by company week with the rate and amount on each', () => {
    expect(s.groups.map((g) => g.label)).toEqual(['Week of May 31', 'Week of June 7'])
    expect(s.groups[0]?.hours).toBe(31.5)
    expect(s.groups[0]?.amount).toBe(756)
    const first = s.groups[0]?.days[0]
    expect(first?.pending).toBe(false)
    if (first && !first.pending) {
      expect(first.dayLabel).toBe('Mon Jun 1')
      expect(first.inLabel).toBe('7:02 am')
      expect(first.rate).toBe(24)
      expect(first.amount).toBe(204)
      expect(first.note).toBe('Rough-in, 2nd floor stacks')
    }
  })
  it('totals the hours, the days and the amount under the recorded label', () => {
    expect(s.totals).toMatchObject({ hours: 48, days: 6, pendingCount: 0, amount: 1152, label: 'Recorded in the app, this job', daysWords: '6 days' })
  })
  it("prints each week's share of the pay, what was paid and the reference", () => {
    expect(s.pay).not.toBeNull()
    expect(s.pay?.lines.map((l) => l.state)).toEqual(['paid', 'paid'])
    expect(s.pay?.lines[0]?.words).toBe('Week of May 31 · $756.00 earned on this job of $864.00 for the week · paid in full $864.00 on June 12, 2026 · Cash App #D-7K2M4Q')
    expect(s.pay?.lines[1]?.words).toContain('Cash App #D-7K9P1R "week 2"')
    expect(s.pay?.note).toMatch(/covers every job that week/)
    expect(s.pay?.allPaid).toBe(true)
  })
  it('has no gap when the period is inside the recorded span, and signs for the pay', () => {
    expect(s.gap).toBeNull()
    expect(s.stated).toBeNull()
    expect(s.attestation).toBe('I, Marcus Reyes, state that I worked the hours shown above on this job at this site, and that I was paid for this work as shown. I understand the company may rely on this statement and give it to its attorney or a court.')
    expect(s.periodLabel).toBe('June 1 – June 13, 2026')
  })
})

describe('the pay switch off', () => {
  const s = buildHoursStatement(helperInput({ withPay: false }))
  it('carries hours alone: no amounts, no pay section, no paid clause', () => {
    expect(s.groups[0]?.amount).toBeNull()
    expect(s.totals.amount).toBeNull()
    expect(s.pay).toBeNull()
    const first = s.groups[0]?.days[0]
    if (first && !first.pending) expect(first.rate).toBeNull()
    expect(s.attestation).not.toMatch(/paid/)
  })
})

describe('a week with a pending session', () => {
  const s = buildHoursStatement(helperInput({ rows: [...juneRows, clockRow('2026-06-05', 4, 'Fittings', { pending: true })] }))
  it('names it under its day and counts nothing for it', () => {
    const pending = s.groups[0]?.days.find((d) => d.pending)
    expect(pending).toBeDefined()
    if (pending?.pending) expect(pending.words).toBe('1 session of 4 h waiting for approval · not counted')
    expect(s.totals.hours).toBe(48)
    expect(s.totals.pendingCount).toBe(1)
    expect(s.totals.daysWords).toBe('6 days · 1 waiting for approval, not counted')
    expect(s.pay?.lines[0]?.jobShare).toBe(756)
  })
})

describe('an unpaid week', () => {
  const unpaid: HoursStatementPayGroup[] = [weekMay31, { ...weekJune7, payments: [] }]
  const s = buildHoursStatement(helperInput({ payGroups: unpaid }))
  it('reads not yet paid and the attestation drops the paid clause', () => {
    expect(s.pay?.lines[1]?.state).toBe('unpaid')
    expect(s.pay?.lines[1]?.words).toBe('Week of June 7 · $396.00 earned on this job of $912.00 for the week · not yet paid')
    expect(s.pay?.allPaid).toBe(false)
    expect(s.attestation).not.toMatch(/paid for this work/)
  })
  it('reads a part payment with what was paid of what was due', () => {
    const part = buildHoursStatement(helperInput({ payGroups: [weekMay31, { ...weekJune7, payments: [{ on: '2026-06-19', amount: 400, memo: null, sourceKind: 'mercury', sourceId: 'm9' }] }] }))
    expect(part.pay?.lines[1]?.state).toBe('partial')
    expect(part.pay?.lines[1]?.words).toContain('paid $400.00 of $912.00: $400.00 on June 19, 2026 · bank transfer')
  })
  it('names a week with hours and no pay report at all', () => {
    const none = buildHoursStatement(helperInput({ payGroups: [weekMay31] }))
    expect(none.pay?.lines.map((l) => l.state)).toEqual(['paid', 'no_report'])
    expect(none.pay?.lines[1]?.words).toBe('Week of June 7 · 16.5 h on this job · no pay report for this week yet')
    expect(none.pay?.lines[1]?.rateSource).toBe('none')
  })
  it('falls back to the current wage for a day no report has priced, and says so', () => {
    const current = buildHoursStatement(helperInput({ dayRates: {}, fallbackRate: 25 }))
    const first = current.groups[0]?.days[0]
    if (first && !first.pending) expect(first.amount).toBe(212.5)
    expect(current.pay?.lines[0]?.rateSource).toBe('current')
  })
})

describe('a span with no rows', () => {
  const s = buildHoursStatement(helperInput({ periodStart: '2025-04-01', periodEnd: '2026-06-13', addStatedBlock: true, statedDays: [{ day: '2025-09-16', hours: 9, note: 'Set water heaters, Bldg A', statedBy: 'Worker, 2026-10-30' }, { day: '2025-09-15', hours: 9, note: 'Set water heaters, Bldg A', statedBy: 'Worker, 2026-10-30' }] }))
  it('says the gap plainly, from the period start to the day before the first row', () => {
    expect(hoursStatementGap('2025-04-01', '2026-06-13', '2026-03-12')).toEqual({ from: '2025-04-01', to: '2026-03-11' })
    expect(hoursStatementGap('2025-04-01', '2025-12-31', '2026-03-12')).toEqual({ from: '2025-04-01', to: '2025-12-31' })
    expect(hoursStatementGap('2026-04-01', '2026-06-13', '2026-03-12')).toBeNull()
    expect(hoursStatementGap('2025-04-01', '2026-06-13', null)).toBeNull()
    expect(s.gap?.heading).toBe('Days the company’s records do not show (April 1, 2025 – March 11, 2026)')
    expect(s.gap?.words).toBe('The company kept no clock before March 12, 2026. The days below are as the worker states them, not as the company recorded them. Blank rows are left blank.')
  })
  it('draws the block for a gap even with the switch off, with no rows yet (PR 2)', () => {
    const off = buildHoursStatement(helperInput({ periodStart: '2025-09-15', periodEnd: '2026-06-13' }))
    expect(off.gap).toEqual({ from: '2025-09-15', to: '2026-03-11', heading: 'Days the company’s records do not show (September 15, 2025 – March 11, 2026)', words: off.gap?.words })
    expect(off.stated?.heading).toBe(off.gap?.heading)
    expect(off.stated?.rows).toEqual([])
    expect(off.attestation).toContain('that the days marked stated are true to the best of my memory')
  })

  it('carries the stated days in date order under the gap words, and the attestation names them', () => {
    expect(s.stated?.rows.map((r) => r.day)).toEqual(['2025-09-15', '2025-09-16'])
    expect(s.stated?.heading).toBe(s.gap?.heading)
    expect(s.attestation).toContain('that the days marked stated are true to the best of my memory')
    expect(s.periodLabel).toBe('April 1, 2025 – June 13, 2026')
  })
  it('offers the block inside the recorded span only when asked, with its own words', () => {
    const inside = buildHoursStatement(helperInput({ addStatedBlock: true }))
    expect(inside.gap).toBeNull()
    expect(inside.stated?.heading).toBe('Days the worker adds')
    expect(inside.stated?.rows).toEqual([])
  })
})

describe("a sub's sheet lines", () => {
  const sheetA = { key: 'sheet-a', label: 'Sheet 1042-A · agreed May 4' }
  const s = buildHoursStatement({
    kind: 'sheet',
    periodStart: '2026-05-04',
    periodEnd: '2026-05-22',
    withPay: true,
    worker: { name: 'Dale Whitfield', company: 'Whitfield Plumbing Services' },
    rows: [
      { day: '2026-05-04', hours: 30, note: 'Tub and shower rough-in, units 201–212', rate: 60, amount: 1800, group: sheetA },
      { day: '2026-05-04', hours: 10, note: 'Water heater sets, Bldg B', rate: 60, amount: 600, group: sheetA },
      { day: '2026-05-18', hours: 24, note: 'Trim-out, 2nd floor', rate: 60, amount: 1440, group: { key: 'sheet-b', label: 'Sheet 1042-B · agreed May 18' } },
    ],
    payGroups: [
      { key: 'sheet-a', label: 'Sheet 1042-A', from: '2026-05-04', to: '2026-05-04', due: 2460, payments: [{ on: '2026-05-15', amount: 2460, memo: 'WO-118 final, check 2291', sourceKind: null, sourceId: null }] },
      { key: 'sheet-b', label: 'Sheet 1042-B', from: '2026-05-18', to: '2026-05-18', due: 1500, payments: [{ on: '2026-05-29', amount: 1500, memo: 'WO-121 final', sourceKind: null, sourceId: null }] },
    ],
    firstRecordedDay: '2026-03-12',
  })
  it('groups by sheet, calls the hours on the sheets, and pays per sheet', () => {
    expect(s.groups.map((g) => g.label)).toEqual(['Sheet 1042-A · agreed May 4', 'Sheet 1042-B · agreed May 18'])
    expect(s.groups[0]?.hours).toBe(40)
    expect(s.groups[0]?.amount).toBe(2400)
    expect(s.totals).toMatchObject({ hours: 64, amount: 3840, label: 'On the sheets, this job' })
    expect(s.pay?.lines[0]?.words).toBe('Sheet 1042-A · $2,460.00 · paid in full $2,460.00 on May 15, 2026 · WO-118 final, check 2291')
    expect(s.pay?.note).toMatch(/recorded against the sheet/)
  })
  it('signs for the company', () => {
    expect(s.attestation).toBe('I, Dale Whitfield, for Whitfield Plumbing Services, state that we did the work above on this job at this site in the periods shown, and that we were paid for it as shown. I understand the company may rely on this statement and give it to its attorney or a court.')
  })
})

describe('a salaried person', () => {
  const s = buildHoursStatement({
    kind: 'schedule',
    periodStart: '2026-07-01',
    periodEnd: '2026-07-03',
    withPay: true,
    worker: { name: 'Priya Natarajan' },
    rows: [
      { day: '2026-07-01', hours: 8, note: 'Office', inLabel: '8:00 am', outLabel: '4:30 pm' },
      { day: '2026-07-02', hours: 8, note: 'Office', inLabel: '8:00 am', outLabel: '4:30 pm' },
    ],
    dayRates: { '2026-07-01': 30 },
    fallbackRate: 30,
    payGroups: [{ key: 'stub-7', label: 'Week of June 28', from: '2026-06-28', to: '2026-07-04', due: 1500, payments: [{ on: '2026-07-10', amount: 1500, memo: null, sourceKind: 'mercury', sourceId: 'm2' }] }],
    firstRecordedDay: '2026-03-12',
  })
  it('keeps the days and the week paid, with no rate and no share for the job', () => {
    const first = s.groups[0]?.days[0]
    if (first && !first.pending) {
      expect(first.rate).toBeNull()
      expect(first.amount).toBeNull()
    }
    expect(s.totals.amount).toBeNull()
    expect(s.totals.label).toBe('On the schedule, this job')
    expect(s.pay?.lines[0]?.jobShare).toBeNull()
    expect(s.pay?.lines[0]?.words).toBe('Week of June 28 · 16 h on this job · paid in full $1,500.00 on July 10, 2026 · bank transfer')
    expect(s.attestation).toContain('that I worked on the days shown above')
  })
})

describe('the office job', () => {
  const s = buildHoursStatement(helperInput({ isOfficeJob: true, rows: [clockRow('2026-06-01', 8, 'AP batch'), clockRow('2026-06-01', 0.25, 'AP batch', { inLabel: '4:40 pm', outLabel: '4:55 pm' })] }))
  it('is the same paper with the office named in the total line, quick adds as ordinary rows', () => {
    expect(s.totals.label).toBe('Recorded in the app, the Office job')
    expect(s.groups[0]?.days).toHaveLength(2)
    expect(s.totals.hours).toBe(8.25)
    expect(s.totals.days).toBe(1)
  })
})

describe('the attestation words', () => {
  it('change with the kind, the pay switch and whether every week read paid', () => {
    expect(hoursStatementAttestation({ kind: 'clock', withPay: true, allPaid: false, hasStated: false, worker })).toBe('I, Marcus Reyes, state that I worked the hours shown above on this job at this site. I understand the company may rely on this statement and give it to its attorney or a court.')
    expect(hoursStatementAttestation({ kind: 'sheet', withPay: false, allPaid: false, hasStated: true, worker: { name: 'Dale Whitfield' } })).toBe('I, Dale Whitfield, state that we did the work above on this job at this site in the periods shown, that the days marked stated are true to the best of my memory. I understand the company may rely on this statement and give it to its attorney or a court.')
  })
  it('keeps rows outside the period off the paper', () => {
    const s = buildHoursStatement(helperInput({ periodStart: '2026-06-08', periodEnd: '2026-06-13' }))
    expect(s.groups).toHaveLength(1)
    expect(s.totals.hours).toBe(16.5)
    expect(s.pay?.lines.map((l) => l.key)).toEqual(['stub-2'])
  })
})
