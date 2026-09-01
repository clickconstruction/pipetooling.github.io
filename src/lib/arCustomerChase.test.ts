import { describe, expect, it } from 'vitest'
import { arCallOpener, arCustomerChasePill, arLastTouchLine, buildArCallSummary } from './arCustomerChase'
import { buildArCustomerRollup } from './arCustomerRollup'
import type { FinancialItem } from './dashboardFinancials'
import type { ChaseTouch } from './jobs/paymentChase'
import type { PaySpeedData } from './jobs/billedExpectedPay'

const TODAY = '2026-09-01'

function touch(over: Partial<ChaseTouch> & { customerId: string; outcome: ChaseTouch['outcome'] }): ChaseTouch {
  return {
    id: Math.random().toString(36).slice(2),
    jobId: null,
    note: null,
    promisedYmd: null,
    snoozeDays: null,
    resolvedAt: null,
    createdAt: '2026-08-31T12:00:00Z',
    createdByName: 'Taunya',
    ...over,
  }
}

const base = { customerId: 'c1', jobIds: ['j1', 'j2'], pastPace: true, promises: null, todayYmd: TODAY }

describe('arCustomerChasePill', () => {
  it('past pace with no state owes a call; on pace with no state is silent', () => {
    expect(arCustomerChasePill({ ...base, touches: null })).toEqual({ kind: 'ask', label: 'Owes a call' })
    expect(arCustomerChasePill({ ...base, pastPace: false, touches: null })).toBeNull()
  })

  it('an unresolved dispute on one of the row jobs wins over everything', () => {
    const pill = arCustomerChasePill({
      ...base,
      touches: [touch({ customerId: 'c1', outcome: 'dispute', jobId: 'j1' })],
      promises: { j2: { promisedYmd: '2026-09-04', markedByName: 'office' } },
    })
    expect(pill?.kind).toBe('dispute')
  })

  it('a live promise shows its date; past grace it reads broken', () => {
    const live = arCustomerChasePill({
      ...base,
      touches: null,
      promises: { j1: { promisedYmd: '2026-09-04', markedByName: 'office' } },
    })
    expect(live).toEqual({ kind: 'promised', label: 'Promised Sep 4' })
    const broken = arCustomerChasePill({
      ...base,
      touches: null,
      promises: { j1: { promisedYmd: '2026-08-20', markedByName: 'office' } }, // 12d past ≥ 7d grace
    })
    expect(broken?.kind).toBe('broken')
  })

  it('a running snooze and the quiet window both hold the row; expired ones fall back to ask', () => {
    const snoozed = arCustomerChasePill({
      ...base,
      touches: [touch({ customerId: 'c1', outcome: 'cant_reach', snoozeDays: 7, createdAt: '2026-08-28T09:00:00Z' })],
    })
    expect(snoozed?.kind).toBe('snoozed')
    const quiet = arCustomerChasePill({
      ...base,
      touches: [touch({ customerId: 'c1', outcome: 'note', createdAt: '2026-08-31T09:00:00Z' })],
    })
    expect(quiet?.kind).toBe('quiet')
    const expired = arCustomerChasePill({
      ...base,
      touches: [touch({ customerId: 'c1', outcome: 'note', createdAt: '2026-08-20T09:00:00Z' })],
    })
    expect(expired?.kind).toBe('ask')
  })

  it('ignores other customers touches', () => {
    const pill = arCustomerChasePill({
      ...base,
      touches: [touch({ customerId: 'other', outcome: 'dispute', jobId: 'j1' })],
    })
    expect(pill?.kind).toBe('ask')
  })
})

describe('arLastTouchLine', () => {
  it('renders outcome, date with age, and who', () => {
    const line = arLastTouchLine(
      [touch({ customerId: 'c1', outcome: 'cant_reach', createdAt: '2026-08-27T15:00:00Z' })],
      'c1',
      TODAY,
    )
    expect(line).toBe("couldn't reach · Aug 27 (5d ago) · Taunya")
  })
  it('null with no touches', () => {
    expect(arLastTouchLine([], 'c1', TODAY)).toBeNull()
  })
})

function rollupRow() {
  const items: FinancialItem[] = [
    { key: 'a', label: '273 · Dudley (Lennox)', sublabel: 'Billed invoice', amount: 13420, dateYmd: '2026-03-16', jobId: 'j1', address: '9703 Lenox Hl', customerId: 'c1', customerName: 'RMC- Dudley Mason' },
    { key: 'b', label: '258 · Dudley Mason', sublabel: 'Billed invoice', amount: 9800, dateYmd: '2026-08-20', jobId: 'j2', address: null, customerId: 'c1', customerName: 'RMC- Dudley Mason' },
  ]
  const speeds: PaySpeedData = {
    company: { medianDays: 6, samples: 100 },
    customers: { c1: { medianDays: 35, samples: 8 } },
    segments: { residential: null, commercial: null },
    customerTypes: {},
    receipts: {},
    quality: null,
  }
  return buildArCustomerRollup(items, speeds, TODAY).rows[0]!
}

describe('arCallOpener', () => {
  it('names the late count, the pace, and the oldest bill', () => {
    expect(arCallOpener(rollupRow())).toBe(
      '1 bill past their ~35d — oldest 169d: 273 · Dudley (Lennox), $13,420. $23,220 open on 2 bills.',
    )
  })
})

describe('buildArCallSummary', () => {
  it('lists every bill with its line items indented under it', () => {
    const lines = new Map([['j1', [{ label: 'Job total (migrated)', amount: 52200 }]]])
    const text = buildArCallSummary(rollupRow(), lines)
    expect(text).toContain('RMC- Dudley Mason — $23,220.00 open on 2 bills')
    expect(text).toContain('• 273 · Dudley (Lennox) — $13,420.00 (169d waiting)')
    expect(text).toContain('  - Job total (migrated): $52,200.00')
    expect(text).toContain('• 258 · Dudley Mason — $9,800.00 (12d waiting)')
  })
})
