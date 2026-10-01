import { describe, expect, it } from 'vitest'
import { crewBillLineRepeatsDates, datesBlockBilledYmd, seeAllDoorWords } from './stagesRowDoors'

describe('seeAllDoorWords', () => {
  it('reads See all before the box loads and with nothing counted', () => {
    expect(seeAllDoorWords(null, 0)).toBe('See all')
    expect(seeAllDoorWords(0, 0)).toBe('See all')
  })
  it('names the count once the box has loaded', () => {
    expect(seeAllDoorWords(3, 0)).toBe('See all 3')
  })
  it('carries the report count the old Reports pill showed', () => {
    expect(seeAllDoorWords(9, 1)).toBe('See all 9 · 1 report')
    expect(seeAllDoorWords(null, 2)).toBe('See all · 2 reports')
  })
})

describe('datesBlockBilledYmd', () => {
  it('reads the bill’s billed_at day, as the dates block does', () => {
    expect(datesBlockBilledYmd({ billed_at: '2026-09-03T15:22:11+00:00', estimated_bill_date: '2026-08-30' })).toBe('2026-09-03')
  })
  it('falls back to the estimated bill date', () => {
    expect(datesBlockBilledYmd({ billed_at: null, estimated_bill_date: '2026-09-30' })).toBe('2026-09-30')
  })
  it('is null with no bill line or no date', () => {
    expect(datesBlockBilledYmd(null)).toBeNull()
    expect(datesBlockBilledYmd({ billed_at: null, estimated_bill_date: null })).toBeNull()
  })
})

describe('crewBillLineRepeatsDates', () => {
  it('hides Billed on a billed row whose dates block prints Billed (job 1009)', () => {
    expect(crewBillLineRepeatsDates({ billLabel: 'Billed', jobStatus: 'billed', datesBilledYmd: '2026-09-03' })).toBe(true)
  })
  it('keeps Paid: the block never says when money last came in', () => {
    expect(crewBillLineRepeatsDates({ billLabel: 'Paid', jobStatus: 'billed', datesBilledYmd: '2026-09-03' })).toBe(false)
  })
  it('keeps the line on a row with no bill line (a job shell) or no dates block', () => {
    expect(crewBillLineRepeatsDates({ billLabel: 'Billed', jobStatus: 'billed', datesBilledYmd: null })).toBe(false)
  })
  it('keeps the line outside Billed and Collections', () => {
    expect(crewBillLineRepeatsDates({ billLabel: 'Billed', jobStatus: 'ready_to_bill', datesBilledYmd: '2026-09-30' })).toBe(false)
    expect(crewBillLineRepeatsDates({ billLabel: 'Billed', jobStatus: 'working', datesBilledYmd: '2026-09-30' })).toBe(false)
  })
  it('keeps nothing to hide when the job has no bill activity', () => {
    expect(crewBillLineRepeatsDates({ billLabel: null, jobStatus: 'billed', datesBilledYmd: '2026-09-03' })).toBe(false)
  })
})
