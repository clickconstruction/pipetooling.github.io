import { describe, expect, it } from 'vitest'
import { mapPageDirectionsUrl, mapPageEntitiesByPinId, mapPagePinColors, mapPagePinId, mapPagePinTitle, mapPagePins } from './mapPagePins'
import { BID_STAGE_MARKER_COLOR } from './builderBidMapFocus'
import { BID_BOARD_MAP_DUE_RING_COLOR, JOBS_MAP_COLLECTIONS_RING_COLOR, JOBS_MAP_SECTION_COLOR, MAP_PAGE_ESTIMATE_COLOR, MAP_PAGE_UNKNOWN_COLOR } from './mapPageSections'

const job = { kind: 'job' as const, id: 'x1', lat: 29.5, lng: -98.4, tableLabel: 'Vasquez pretest', sublabel: 'J1419', jobSection: 'working' as const }
const bid = { kind: 'bid' as const, id: 'x1', lat: 29.6, lng: -98.3, tableLabel: 'Pool house', sublabel: '', bidSection: 'pending' as const }
const est = { kind: 'estimate' as const, id: 'e9', lat: 29.7, lng: -98.2, tableLabel: 'Water heater', sublabel: '#88' }

describe('mapPagePins', () => {
  it('keys a job and a bid with the same record id apart and colors by section', () => {
    const pins = mapPagePins([job, bid, est], { builderFocus: false, focusSection: () => 'won' })
    expect(pins.map((p) => p.id)).toEqual(['job-x1', 'bid-x1', 'estimate-e9'])
    expect(pins.map((p) => p.color)).toEqual([JOBS_MAP_SECTION_COLOR.working, BID_STAGE_MARKER_COLOR.pending, MAP_PAGE_ESTIMATE_COLOR])
    expect(pins.map((p) => p.ringColor)).toEqual([null, null, null])
    expect(pins[0]!.title).toBe('Vasquez pretest · J1419')
    expect(pins[1]!.title).toBe('Pool house')
  })

  it('rings a job in Collections and a bid that is due; greys a record with no section', () => {
    expect(mapPagePinColors({ ...job, jobSection: 'billed', inCollections: true })).toEqual({ color: JOBS_MAP_SECTION_COLOR.billed, ringColor: JOBS_MAP_COLLECTIONS_RING_COLOR })
    expect(mapPagePinColors({ ...bid, bidSection: 'unsent', bidDueTone: 'overdue' })).toEqual({ color: BID_STAGE_MARKER_COLOR.unsent, ringColor: BID_BOARD_MAP_DUE_RING_COLOR.overdue })
    expect(mapPagePinColors({ ...job, jobSection: null }).color).toBe(MAP_PAGE_UNKNOWN_COLOR)
    expect(mapPagePinColors({ ...bid, bidSection: undefined }).color).toBe(MAP_PAGE_UNKNOWN_COLOR)
  })

  it('in builder focus a bid takes its outcome color for that GC, jobs keep theirs', () => {
    const pins = mapPagePins([job, bid], { builderFocus: true, focusSection: (e) => (e.kind === 'bid' ? 'lost' : undefined) })
    expect(pins[1]!.color).toBe(BID_STAGE_MARKER_COLOR.lost)
    expect(pins[0]!.color).toBe(JOBS_MAP_SECTION_COLOR.working)
  })

  it('looks a pin back up by id', () => {
    const byId = mapPageEntitiesByPinId([job, bid])
    expect(byId.get(mapPagePinId(bid))).toBe(bid)
    expect(mapPagePinTitle(est)).toBe('Water heater · #88')
    expect(mapPageDirectionsUrl('1 Main St, Seguin TX')).toContain('google.com/maps')
  })
})
