import { describe, expect, it } from 'vitest'
import type { JobChargeEvent } from '../jobChargesTimeline'
import { liveOtherCharges, withLiveJobFormValues } from './jobCostsLiveInputs'

const loaded = {
  revenue: 1_500 as number | null,
  teamHours: 8,
  chargeEvents: [
    { source: 'team_labor', dateKey: '2026-09-01', amount: 400, label: 'Pat 8h' },
    { source: 'billed_material', dateKey: '2026-09-02', amount: 25, label: 'Old charge' },
    { source: 'supply_house', dateKey: '2026-09-03', amount: 90, label: 'Ferguson #1' },
  ] as JobChargeEvent[],
}

describe('withLiveJobFormValues', () => {
  it('hands the inputs back untouched when the form gives nothing', () => {
    expect(withLiveJobFormValues(loaded, null)).toBe(loaded)
    expect(withLiveJobFormValues(loaded, undefined)).toBe(loaded)
  })

  it('takes the form’s price', () => {
    expect(withLiveJobFormValues(loaded, { priceUsd: 1_700, otherCharges: [] }).revenue).toBe(1_700)
    expect(withLiveJobFormValues({ ...loaded, revenue: null }, { priceUsd: 0, otherCharges: [] }).revenue).toBe(0)
  })

  it('replaces the other job charges and leaves every other cost as it was read', () => {
    const out = withLiveJobFormValues(loaded, { priceUsd: 1_500, otherCharges: [{ dateKey: '2026-09-28', amount: 40, description: 'Permit' }] })
    expect(out.chargeEvents).toEqual([
      { source: 'team_labor', dateKey: '2026-09-01', amount: 400, label: 'Pat 8h' },
      { source: 'supply_house', dateKey: '2026-09-03', amount: 90, label: 'Ferguson #1' },
      { source: 'billed_material', dateKey: '2026-09-28', amount: 40, label: 'Permit' },
    ])
    expect(out.teamHours).toBe(8)
  })

  it('drops the loaded other charges when the form has none left', () => {
    expect(withLiveJobFormValues(loaded, { priceUsd: 1_500, otherCharges: [] }).chargeEvents.map((e) => e.source)).toEqual(['team_labor', 'supply_house'])
  })

  it('does not change the inputs it was given', () => {
    withLiveJobFormValues(loaded, { priceUsd: 9, otherCharges: [] })
    expect(loaded.revenue).toBe(1_500)
    expect(loaded.chargeEvents).toHaveLength(3)
  })
})

describe('liveOtherCharges', () => {
  const loadedRows = [{ id: 'm1', dateKey: '2026-09-02' }, { id: 'm2', dateKey: null }]

  it('keeps a loaded row’s date and dates a new row today', () => {
    expect(
      liveOtherCharges(
        [
          { id: 'm1', description: ' Permit ', amount: 40 },
          { id: 'm2', description: 'Undated', amount: 5 },
          { id: 'new', description: 'Dump fee', amount: 60 },
        ],
        loadedRows,
        '2026-09-28',
      ),
    ).toEqual([
      { dateKey: '2026-09-02', amount: 40, description: 'Permit' },
      { dateKey: null, amount: 5, description: 'Undated' },
      { dateKey: '2026-09-28', amount: 60, description: 'Dump fee' },
    ])
  })

  it('leaves out the rows autosave would not save, and keeps an amount with no description', () => {
    expect(
      liveOtherCharges(
        [
          { id: 'blank', description: '  ', amount: 0 },
          { id: 'a', description: '', amount: 12.5 },
          { id: 'd', description: 'Named, no amount', amount: 0 },
        ],
        [],
        '2026-09-28',
      ),
    ).toEqual([
      { dateKey: '2026-09-28', amount: 12.5, description: null },
      { dateKey: '2026-09-28', amount: 0, description: 'Named, no amount' },
    ])
  })
})
