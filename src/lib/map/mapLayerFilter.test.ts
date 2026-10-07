import { describe, expect, it } from 'vitest'
import { ALL_BID_STAGES_ON, DEFAULT_MAP_BID_STAGES, mapEntityPassesLayerFilter, type MapLayerFilterState } from './mapLayerFilter'

const allOn: MapLayerFilterState = {
  jobSections: { waiting: true, working: true, readyToBill: true, billed: true, paid: true },
  bidStages: ALL_BID_STAGES_ON,
  showEst: true,
}
const noJobs = { waiting: false, working: false, readyToBill: false, billed: false, paid: false }
const noStages = { unsent: false, pending: false, won: false, startedOrComplete: false, lost: false }

describe('mapEntityPassesLayerFilter', () => {
  it('a job follows its section chip', () => {
    expect(mapEntityPassesLayerFilter({ kind: 'job', jobSection: 'paid' }, allOn)).toBe(true)
    expect(mapEntityPassesLayerFilter({ kind: 'job', jobSection: 'paid' }, { ...allOn, jobSections: { ...allOn.jobSections, paid: false } })).toBe(false)
    expect(mapEntityPassesLayerFilter({ kind: 'job', jobSection: 'working' }, { ...allOn, jobSections: { ...allOn.jobSections, paid: false } })).toBe(true)
  })

  it('a job off the pipeline shows while any job chip is on', () => {
    expect(mapEntityPassesLayerFilter({ kind: 'job', jobSection: null }, allOn)).toBe(true)
    expect(mapEntityPassesLayerFilter({ kind: 'job' }, { ...allOn, jobSections: noJobs })).toBe(false)
  })

  it('estimates follow their chip and ignore the rest', () => {
    expect(mapEntityPassesLayerFilter({ kind: 'estimate' }, allOn)).toBe(true)
    expect(mapEntityPassesLayerFilter({ kind: 'estimate' }, { ...allOn, showEst: false })).toBe(false)
    expect(mapEntityPassesLayerFilter({ kind: 'estimate' }, { ...allOn, jobSections: noJobs, bidStages: noStages })).toBe(true)
  })

  it('bids follow their stage chip; an unplaced bid shows while any stage is on', () => {
    const lostOff = { ...allOn, bidStages: { ...ALL_BID_STAGES_ON, lost: false } }
    expect(mapEntityPassesLayerFilter({ kind: 'bid', bidSection: 'lost' }, lostOff)).toBe(false)
    expect(mapEntityPassesLayerFilter({ kind: 'bid', bidSection: 'won' }, lostOff)).toBe(true)
    expect(mapEntityPassesLayerFilter({ kind: 'bid' }, lostOff)).toBe(true)
    expect(mapEntityPassesLayerFilter({ kind: 'bid' }, { ...allOn, bidStages: noStages })).toBe(false)
  })
})

describe('DEFAULT_MAP_BID_STAGES', () => {
  it('starts with every stage but Lost (v2.4802, the Bid Board map default)', () => {
    expect(DEFAULT_MAP_BID_STAGES).toEqual({ unsent: true, pending: true, won: true, startedOrComplete: true, lost: false })
  })
})
