import { describe, expect, it } from 'vitest'
import { isFuelCardCharge, sumFuelChargesByJob } from './mercuryFuelSplit'

describe('isFuelCardCharge', () => {
  it('lets the Fuel / Gas label win, falls back to the bank category only when unlabelled', () => {
    expect(isFuelCardCharge('fuel_gas', 'Retail')).toBe(true)
    expect(isFuelCardCharge('cogs_part_iii', 'FuelAndGas')).toBe(false)
    expect(isFuelCardCharge('other', 'FuelAndGas')).toBe(false)
    expect(isFuelCardCharge(undefined, 'FuelAndGas')).toBe(true)
    expect(isFuelCardCharge(undefined, 'fuelandgas')).toBe(true)
    expect(isFuelCardCharge(undefined, { name: 'FuelAndGas' })).toBe(true)
    expect(isFuelCardCharge(undefined, 'Retail')).toBe(false)
    expect(isFuelCardCharge(undefined, null)).toBe(false)
  })
})

describe('sumFuelChargesByJob', () => {
  it('sums |amount| per job for fuel rows only and skips rows with no transaction', () => {
    const rows = [
      { job_id: 'a', amount: -50, mercury_transaction_id: 't1' }, // labelled fuel
      { job_id: 'a', amount: -20.5, mercury_transaction_id: 't2' }, // unlabelled, bank says fuel
      { job_id: 'a', amount: -125.43, mercury_transaction_id: 't3' }, // Lowe's retail
      { job_id: 'b', amount: '-14.17', mercury_transaction_id: 't4' }, // labelled COGS despite bank fuel
      { job_id: 'b', amount: -9, mercury_transaction_id: 't5' }, // unlabelled fuel
      { job_id: 'c', amount: -30, mercury_transaction_id: null },
    ]
    const buckets = new Map([['t1', 'fuel_gas'], ['t3', 'cogs_part_iii'], ['t4', 'cogs_part_iii']])
    const cats = new Map<string, unknown>([['t1', 'Retail'], ['t2', 'FuelAndGas'], ['t3', 'Retail'], ['t4', 'FuelAndGas'], ['t5', 'FuelAndGas']])
    const out = sumFuelChargesByJob(rows, buckets, cats)
    expect(out.get('a')).toBeCloseTo(70.5)
    expect(out.get('b')).toBe(9)
    expect(out.has('c')).toBe(false)
  })
})
