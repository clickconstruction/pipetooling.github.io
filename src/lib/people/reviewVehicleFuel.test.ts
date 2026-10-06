import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CardChargeWindowRow } from '../banking/cardChargesWindow'
import { buildCategoryTagLookups, type CategoryTagRow } from '../banking/categoryTags'
import { buildSpendingRollup } from './spendingRollup'

const fetchWindow = vi.fn()
vi.mock('../banking/cardChargesWindow', async (importOriginal) => {
  const real = await importOriginal<typeof import('../banking/cardChargesWindow')>()
  return { ...real, fetchCardChargesWindow: (args: unknown) => fetchWindow(args) }
})
const loadDirectory = vi.fn()
vi.mock('./loadSpending', () => ({ loadSpendingDirectory: (charges: unknown) => loadDirectory(charges) }))

import { cardChargeWindows, fuelOffJobsByUserId, loadFuelOffJobsByUserId } from './reviewVehicleFuel'

const FUEL: CategoryTagRow = { id: 'tag-fuel', name: 'Fuel & gas', icon: '⛽', color: 'amber', sort_order: 0, default_key: 'fuel_vehicle', show_as_cost_line: true, hide_from_picker: false }
const LOOKUPS = buildCategoryTagLookups([FUEL], [{ tag_id: FUEL.id, bank_category: 'FuelAndGas', label_id: null }])
const OFFICE = 'job-office'
const DIRECTORY = { userNameById: new Map([['u-mal', 'Malachi'], ['u-ann', 'Ann']]), personById: new Map() }

let seq = 0
function charge(over: Partial<CardChargeWindowRow> & { amount: number }): CardChargeWindowRow {
  seq += 1
  return {
    id: `tx-${seq}`,
    postedAt: '2026-09-10T15:00:00Z',
    counterpartyName: 'Shell',
    kind: 'debitCardTransaction',
    status: 'sent',
    bankCategory: 'FuelAndGas',
    debitCardId: 'card-m',
    cardNickname: null,
    cardRole: null,
    holderUserId: 'u-mal',
    holderName: 'Malachi',
    attributedUserId: 'u-mal',
    attributedPersonId: null,
    labelId: null,
    labelDefaultKey: null,
    payrollMarked: false,
    splits: [],
    invoiceLinks: [],
    sortedAt: null,
    sortedByName: null,
    viewerCanSort: true,
    ...over,
  }
}
const split = (jobId: string, amount: number) => ({ jobId, amount, hcpNumber: null, clickNumber: null, jobName: null, serviceTypeId: null })

const CHARGES = [
  charge({ amount: -40 }), // fuel on no job
  charge({ amount: -100, splits: [split('j1', -100)] }), // fuel on a job: in the job's cost
  charge({ amount: -20, splits: [split(OFFICE, -20)] }), // fuel on the Office job: overhead, not the vehicle line
  charge({ amount: -30, invoiceLinks: [{ invoiceId: 'inv', invoiceNumber: '1', supplyHouseName: 'S', amount: 30 }] }), // on a supply invoice
  charge({ amount: -15, payrollMarked: true }), // settled through payroll
  charge({ amount: 10, kind: 'other' }), // a refund to the card on no job: comes off
  charge({ amount: -25, bankCategory: 'Retail' }), // not fuel
  charge({ amount: -9, attributedUserId: 'u-ann', holderUserId: 'u-ann', splits: [split('j2', -9)] }), // Ann's fuel is all on a job
]

describe('fuelOffJobsByUserId', () => {
  it('is a person’s fuel on no job: not on a job, the Office job, an invoice or payroll; a refund comes off', () => {
    const rollup = buildSpendingRollup({ charges: CHARGES, lookups: LOOKUPS, fuelTagId: FUEL.id, officeJobId: OFFICE, sortingFloorYmd: null, directory: DIRECTORY })
    expect([...fuelOffJobsByUserId(rollup)]).toEqual([['u-mal', 30]]) // 40 − 10
  })
})

describe('cardChargeWindows', () => {
  it('cuts a long period into windows the read accepts, in order', () => {
    expect(cardChargeWindows('2026-09-01', '2026-09-30')).toEqual([{ startYmd: '2026-09-01', endYmd: '2026-09-30' }])
    expect(cardChargeWindows('2024-01-01', '2026-01-01')).toEqual([
      { startYmd: '2024-01-01', endYmd: '2024-12-31' }, // 366 days, a leap year
      { startYmd: '2025-01-01', endYmd: '2026-01-01' }, // 366 days
    ])
    expect(cardChargeWindows('2026-09-30', '2026-09-01')).toEqual([])
  })
})

describe('loadFuelOffJobsByUserId', () => {
  beforeEach(() => {
    fetchWindow.mockReset().mockResolvedValue(CHARGES)
    loadDirectory.mockReset().mockResolvedValue(DIRECTORY)
  })

  it('reads the period’s card charges, then each person’s fuel on no job', async () => {
    const out = await loadFuelOffJobsByUserId({ startYmd: '2026-09-01', endYmd: '2026-09-30', lookups: LOOKUPS, fuelTagId: FUEL.id, officeJobId: OFFICE })
    expect(fetchWindow).toHaveBeenCalledWith({ startYmd: '2026-09-01', endYmd: '2026-09-30' })
    expect(loadDirectory).toHaveBeenCalledWith(CHARGES)
    expect(out.get('u-mal')).toBe(30)
  })

  it('reads nothing when the org has no fuel tag', async () => {
    const out = await loadFuelOffJobsByUserId({ startYmd: '2026-09-01', endYmd: '2026-09-30', lookups: LOOKUPS, fuelTagId: null, officeJobId: OFFICE })
    expect(out.size).toBe(0)
    expect(fetchWindow).not.toHaveBeenCalled()
  })

  it('a failed read throws, so Review can say so', async () => {
    fetchWindow.mockRejectedValue(new Error('not live'))
    await expect(loadFuelOffJobsByUserId({ startYmd: '2026-09-01', endYmd: '2026-09-30', lookups: LOOKUPS, fuelTagId: FUEL.id, officeJobId: OFFICE })).rejects.toThrow('not live')
  })
})
