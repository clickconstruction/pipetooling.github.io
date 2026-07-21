import { describe, expect, it } from 'vitest'
import { ALL_BID_STAGES_ON, DEFAULT_MAP_BID_STAGES, mapEntityPassesLayerFilter, type MapLayerFilterState } from './mapLayerFilter'

const allOn: MapLayerFilterState = {
  showJobs: true,
  showBids: true,
  showEst: true,
  bidStages: ALL_BID_STAGES_ON,
}

describe('mapEntityPassesLayerFilter', () => {
  it('jobs and estimates follow their layer toggles and ignore bid stages', () => {
    expect(mapEntityPassesLayerFilter({ kind: 'job' }, allOn)).toBe(true)
    expect(mapEntityPassesLayerFilter({ kind: 'estimate' }, allOn)).toBe(true)
    expect(mapEntityPassesLayerFilter({ kind: 'job' }, { ...allOn, showJobs: false })).toBe(false)
    expect(mapEntityPassesLayerFilter({ kind: 'estimate' }, { ...allOn, showEst: false })).toBe(false)
    const noStages = { ...allOn, bidStages: { unsent: false, pending: false, won: false, startedOrComplete: false, lost: false } }
    expect(mapEntityPassesLayerFilter({ kind: 'job' }, noStages)).toBe(true)
  })

  it('bids layer off hides every bid regardless of stage toggles', () => {
    expect(mapEntityPassesLayerFilter({ kind: 'bid', bidSection: 'won' }, { ...allOn, showBids: false })).toBe(false)
    expect(mapEntityPassesLayerFilter({ kind: 'bid' }, { ...allOn, showBids: false })).toBe(false)
  })

  it('bids follow their stage toggle', () => {
    const lostOff = { ...allOn, bidStages: { ...ALL_BID_STAGES_ON, lost: false } }
    expect(mapEntityPassesLayerFilter({ kind: 'bid', bidSection: 'lost' }, lostOff)).toBe(false)
    expect(mapEntityPassesLayerFilter({ kind: 'bid', bidSection: 'won' }, lostOff)).toBe(true)
    expect(mapEntityPassesLayerFilter({ kind: 'bid', bidSection: 'unsent' }, lostOff)).toBe(true)
    expect(mapEntityPassesLayerFilter({ kind: 'bid', bidSection: 'pending' }, lostOff)).toBe(true)
    expect(mapEntityPassesLayerFilter({ kind: 'bid', bidSection: 'startedOrComplete' }, lostOff)).toBe(true)
  })

  it('unclassified bids stay visible whenever the Bids layer is on', () => {
    const noStages = { ...allOn, bidStages: { unsent: false, pending: false, won: false, startedOrComplete: false, lost: false } }
    expect(mapEntityPassesLayerFilter({ kind: 'bid' }, noStages)).toBe(true)
  })
})

describe('DEFAULT_MAP_BID_STAGES', () => {
  it('starts with only Won and Started selected (v2.837 default)', () => {
    expect(DEFAULT_MAP_BID_STAGES).toEqual({
      unsent: false,
      pending: false,
      won: true,
      startedOrComplete: true,
      lost: false,
    })
  })
})
