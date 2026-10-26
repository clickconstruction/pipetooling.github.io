import { describe, expect, it } from 'vitest'
import type { BilledBreakdownCustomerGroup } from '../jobs/billedByCustomerBreakdown'
import type { ChaseTouch } from '../jobs/paymentChase'
import { leanCounts, leanMarkNote, leanNextLine, leanRows, leanSince, parseLeanDays } from './leanRead'

const TODAY = '2026-10-26'

function group(name: string, customerId: string | null, worstAgeDays: number | null, total: number, jobIds: string[] = ['j-' + name]): BilledBreakdownCustomerGroup {
  return {
    key: customerId ?? `name:${name}`,
    customerName: name,
    total,
    count: jobIds.length,
    worstAgeDays,
    worstAgeHandSet: false,
    bills: jobIds.map((jobId) => ({
      invoiceId: null,
      jobId,
      jobName: 'Job',
      jobNumber: '1',
      jobAddress: '',
      amount: total / jobIds.length,
      settled: false,
      ageDays: worstAgeDays,
      ageHandSet: false,
      lineItems: [],
      customerId,
      customerEmail: null,
      stripeInvoiceId: null,
      stripePaid: false,
      sentAtIso: null,
      externalSendChannel: null,
      billToEmail: null,
    })),
  }
}

function touch(customerId: string, createdAt: string, outcome: ChaseTouch['outcome'] = 'note'): ChaseTouch {
  return { id: createdAt, customerId, jobId: null, outcome, note: null, promisedYmd: null, snoozeDays: null, resolvedAt: null, createdAt, createdByName: 'Marisol' }
}

const GROUPS = [
  group('Ridgeway Builders', 'c1', 64, 41200, ['j1', 'j2', 'j3']),
  group('Cedar Bend Partners', 'c2', 51, 18750),
  group('Harlan Freight', 'c3', 38, 6400),
  group('Pruett & Vance', 'c4', 45, 9100),
  group('Hartline Mutual', 'c5', 31, 2300),
  group('Lone Oak Dental', 'c6', 12, 800),
  group('No customer', null, 40, 500),
]
const TOUCHES = [touch('c1', '2026-10-14T15:00:00Z', 'cant_reach'), touch('c1', '2026-09-01T15:00:00Z'), touch('c5', '2026-10-25T15:00:00Z', 'note')]
const PROMISES = { 'j-Pruett & Vance': { promisedYmd: '2026-10-30', markedByName: 'Dale' } }

describe('parseLeanDays', () => {
  it('reads the number, falls back to the default when unset or out of range', () => {
    expect(parseLeanDays(null, null)).toBe(7)
    expect(parseLeanDays(10, null)).toBe(10)
    expect(parseLeanDays(null, '14')).toBe(14)
    expect(parseLeanDays(0, null)).toBe(7)
    expect(parseLeanDays(400, null)).toBe(7)
    expect(parseLeanDays(null, 'soon')).toBe(7)
  })
})

describe('leanRows', () => {
  const rows = leanRows({ groups: GROUPS, touches: TOUCHES, promises: PROMISES, todayYmd: TODAY, leanDays: 7 })

  it('sorts needs first by the oldest bill, then waiting, then not yet past due', () => {
    expect(rows.map((r) => `${r.group.customerName}:${r.state}`)).toEqual([
      'Ridgeway Builders:needs',
      'Cedar Bend Partners:needs',
      'No customer:needs',
      'Harlan Freight:needs',
      'Pruett & Vance:waiting',
      'Hartline Mutual:waiting',
      'Lone Oak Dental:current',
    ])
  })

  it('says why each row sits where it sits', () => {
    const by = Object.fromEntries(rows.map((r) => [r.group.customerName, r]))
    expect(by['Ridgeway Builders']).toMatchObject({ why: 'no lean in 12d', lastTouchDays: 12, lastTouchLine: "couldn't reach · Oct 14 (12d ago) · Marisol" })
    expect(by['Cedar Bend Partners']).toMatchObject({ why: 'never leaned on', lastTouch: null, lastTouchLine: null })
    expect(by['Pruett & Vance']).toMatchObject({ why: 'promise standing', promisedYmd: '2026-10-30' })
    expect(by['Hartline Mutual']).toMatchObject({ why: 'leaned on 1d ago' })
    expect(by['Lone Oak Dental']).toMatchObject({ why: '18 days until past due' })
    expect(by['No customer']).toMatchObject({ customerId: null, why: 'never leaned on' })
  })

  it('a broken promise needs a lean and says so; a longer owner number keeps a customer waiting', () => {
    const broken = leanRows({ groups: [GROUPS[3]!], touches: null, promises: { 'j-Pruett & Vance': { promisedYmd: '2026-10-10', markedByName: 'Dale' } }, todayYmd: TODAY, leanDays: 7 })
    expect(broken[0]).toMatchObject({ state: 'needs', why: 'promise broken', brokenYmd: '2026-10-10' })
    const longer = leanRows({ groups: [GROUPS[0]!], touches: TOUCHES, promises: null, todayYmd: TODAY, leanDays: 14 })
    expect(longer[0]).toMatchObject({ state: 'waiting', why: 'leaned on 12d ago' })
  })

  it('counts, names the first and writes the note', () => {
    expect(leanCounts(rows)).toEqual({ needs: 4, waiting: 2, current: 1, past60: 1, bills: 9, total: 79050 })
    expect(leanNextLine(rows)).toBe('Lean on Ridgeway Builders · $41,200 · 64 days · no lean in 12d')
    const since = leanSince(rows, '2026-10-23T14:55:00Z', TODAY, (iso) => iso.slice(0, 10), () => 'Friday at 9:55 AM')
    expect(since).toEqual({ newPastDue: 1, leanedSince: 1, words: 'Since the last look, Friday at 9:55 AM' })
    expect(leanMarkNote(rows, 7, since)).toBe(
      '4 need a lean (no lean in 7 days) · oldest 64d (Ridgeway Builders, no lean in 12d) · 2 leaned on or promised · 1 not yet past due · 9 bills · $79,050 open · +1 new past due, 1 leaned since the last look',
    )
    expect(leanNextLine(leanRows({ groups: [GROUPS[5]!], touches: null, promises: null, todayYmd: TODAY, leanDays: 7 }))).toBeNull()
    expect(leanMarkNote([], 7, null)).toBeNull()
    expect(leanSince(rows, null, TODAY, (iso) => iso, () => '')).toBeNull()
  })
})
