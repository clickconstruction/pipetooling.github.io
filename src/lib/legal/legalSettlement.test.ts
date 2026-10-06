import { describe, expect, it } from 'vitest'
import { matterOpenBalance, settlementBelowFloor, settlementFloorDollars, settlementFloorOf, settlementFloorWords } from '../../../supabase/functions/_shared/legalSettlement'
import { buildFirmActivity, type LegalEntryRow, type LegalMatterRow } from './legalMatters'
import { conversationRows, conversationStateWords, conversationWho } from './legalAsks'

describe('settlement floor (#85 item 20)', () => {
  it('reads one floor from the row: dollars, or a percent, or none', () => {
    expect(settlementFloorOf({ settlement_floor_amount: 14000, settlement_floor_pct: null })).toEqual({ amount: 14000, pct: null })
    expect(settlementFloorOf({ settlement_floor_amount: null, settlement_floor_pct: '70' })).toEqual({ amount: null, pct: 70 })
    expect(settlementFloorOf({ settlement_floor_amount: null, settlement_floor_pct: null })).toBeNull()
    expect(settlementFloorOf({ settlement_floor_pct: 140 })).toBeNull()
    expect(settlementFloorOf(null)).toBeNull()
  })
  it('a percent follows the balance; under the floor asks, at it settles', () => {
    expect(settlementFloorDollars({ amount: null, pct: 70 }, 20000)).toBe(14000)
    expect(settlementFloorDollars({ amount: null, pct: 33.3 }, 1000.01)).toBe(333)
    expect(settlementBelowFloor(9000, { amount: null, pct: 70 }, 20000)).toBe(true)
    expect(settlementBelowFloor(14000, { amount: null, pct: 70 }, 20000)).toBe(false)
    expect(settlementBelowFloor(1, null, 20000)).toBe(false)
    expect(settlementFloorWords({ amount: null, pct: 70 }, 20000)).toBe('You may settle at $14,000.00 or above (70% of the balance). Below that, ask.')
    expect(settlementFloorWords({ amount: 12500, pct: null }, 20000)).toBe('You may settle at $12,500.00 or above. Below that, ask.')
    expect(settlementFloorWords(null, 20000)).toBe('No settlement floor: you may settle at any amount.')
  })
  it('the open balance follows the packet’s rule: open billed lines, else revenue less payments', () => {
    const jobs = [{ id: 'a', revenue: 9000, payments_made: 0 }, { id: 'b', revenue: 5000, payments_made: 1000 }]
    const invoices = [{ id: 'i1', job_id: 'a', amount: 6000, status: 'billed' }, { id: 'i2', job_id: 'a', amount: 3000, status: 'draft' }]
    const payments = [{ job_id: 'a', invoice_id: 'i1', amount: 1500 }]
    expect(matterOpenBalance(jobs, invoices, payments)).toBe(4500 + 4000)
  })
  it('the firm’s proposal threads as a settlement ask and leads the Needs You card', () => {
    const ask: LegalEntryRow = { id: 's1', matter_id: 'm1', kind: 'question', amount: 9000, body: 'Two payments', occurred_on: '2026-10-06', meta: { flavor: 'settlement', proposedAmount: 9000, floor: 14000, recordedBy: { id: 'r1', name: 'Dana Reyes' } }, via_portal: true, created_by: null, acknowledged_at: null, created_at: '2026-10-06T15:00:00Z' }
    const [row] = conversationRows([ask])
    expect(row!.thread.flavor).toBe('settlement')
    expect(conversationWho(row!, 'office')).toBe('Dana Reyes at the firm asked to settle at $9,000.00')
    expect(conversationWho(row!, 'firm')).toBe('Dana Reyes asked to settle at $9,000.00')
    expect(conversationStateWords(row!, 'office')).toEqual({ text: 'waiting on you', tone: 'warn' })
    const yes: LegalEntryRow = { ...ask, id: 'a1', kind: 'answer', via_portal: false, meta: { askId: 's1', signedOff: true }, occurred_on: '2026-10-07', created_at: '2026-10-07T15:00:00Z' }
    expect(conversationStateWords(conversationRows([ask, yes])[0]!, 'firm')).toEqual({ text: 'signed off 2026-10-07', tone: 'ok' })
    const no = { ...yes, meta: { askId: 's1', signedOff: false } }
    expect(conversationStateWords(conversationRows([ask, no])[0]!, 'firm')).toEqual({ text: 'not yet · 2026-10-07', tone: 'stop' })
    const m = { id: 'm1', payer_key: 'c:x', payer_name: 'Lenox Builders' } as LegalMatterRow
    const fq: LegalEntryRow = { ...ask, id: 'q2', meta: {}, created_at: '2026-10-06T16:00:00Z' }
    const act = buildFirmActivity([fq, ask], [m])
    expect([act.settlements, act.questions, act.firstName]).toEqual([1, 1, 'Lenox Builders'])
  })
})
