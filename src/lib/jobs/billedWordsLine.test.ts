import { describe, expect, it } from 'vitest'
import { buildBilledWordsLine } from './billedWordsLine'
import type { PaySpeedData } from './billedExpectedPay'

const data: PaySpeedData = {
  company: { medianDays: 27, samples: 240 },
  customers: { knight: { medianDays: 21, samples: 8 }, newbie: { medianDays: 5, samples: 1 } },
  segments: { residential: null, commercial: null },
  customerTypes: {},
  receipts: {},
  quality: null,
}
const row = { billedAtIso: '2026-09-15T15:00:00Z', estBillYmd: null, customerId: 'knight' }

describe('buildBilledWordsLine (v2.4130)', () => {
  it('inside the window the customer usually pays in: plain, "expect ~"', () => {
    const line = buildBilledWordsLine({ row, data, todayYmd: '2026-09-29', promise: null, inCollections: false })
    expect(line.billed).toBe('Billed Sep 15')
    expect(line.expect).toBe('expect ~Oct 6')
    expect(line.tone).toBe('plain')
    expect(line.action).toBe('they-said')
    expect(line.full).toBe('Billed Sep 15 · expect ~Oct 6')
    expect(line.title).toContain("this customer's median pay speed")
  })

  it('past the window: amber, "N d past expected"', () => {
    const line = buildBilledWordsLine({ row, data, todayYmd: '2026-10-27', promise: null, inCollections: false })
    expect(line.expect).toBe('21 d past expected')
    expect(line.tone).toBe('amber')
  })

  it('a promise sits beside the estimate, never in place of it, and the click becomes New date', () => {
    const promise = { promisedYmd: '2026-11-03', markedByName: 'Wendi' }
    const line = buildBilledWordsLine({ row, data, todayYmd: '2026-10-27', promise, inCollections: false })
    expect(line.expect).toBe('21 d past expected · they said Nov 3')
    expect(line.action).toBe('new-date')
    expect(line.tone).toBe('amber')
    expect(line.title).toContain('Customer promised payment by Nov 3')
  })

  it('a promise that has come and gone says how far past it', () => {
    const promise = { promisedYmd: '2026-10-03', markedByName: 'Wendi' }
    const line = buildBilledWordsLine({ row, data, todayYmd: '2026-10-27', promise, inCollections: false })
    expect(line.expect).toBe('21 d past expected · they said Oct 3 · 24 d past it')
  })

  it('a promise inside the window keeps the line plain', () => {
    const promise = { promisedYmd: '2026-10-10', markedByName: 'Wendi' }
    const line = buildBilledWordsLine({ row, data, todayYmd: '2026-09-29', promise, inCollections: false })
    expect(line.expect).toBe('expect ~Oct 6 · they said Oct 10')
    expect(line.tone).toBe('plain')
  })

  it('Collections reads red whatever the dates say', () => {
    const line = buildBilledWordsLine({ row, data, todayYmd: '2026-09-29', promise: null, inCollections: true })
    expect(line.tone).toBe('red')
  })

  it('a customer with too little history gets the company average; no history at all gets the bill date alone', () => {
    const line = buildBilledWordsLine({ row: { ...row, customerId: 'newbie' }, data, todayYmd: '2026-09-29', promise: null, inCollections: false })
    expect(line.expect).toBe('expect ~Oct 12')
    expect(line.title).toContain('company-wide median')
    const none = buildBilledWordsLine({ row, data: null, todayYmd: '2026-09-29', promise: null, inCollections: false })
    expect(none.expect).toBeNull()
    expect(none.full).toBe('Billed Sep 15')
    expect(none.title).toBe('Billed Sep 15 · no pay-speed history yet')
  })

  it('no bill date: the line says so and nothing is forecast', () => {
    const line = buildBilledWordsLine({ row: { billedAtIso: null, estBillYmd: null, customerId: 'knight' }, data, todayYmd: '2026-09-29', promise: null, inCollections: false })
    expect(line.billed).toBe('No bill date')
    expect(line.expect).toBeNull()
    expect(line.tone).toBe('plain')
  })
})
