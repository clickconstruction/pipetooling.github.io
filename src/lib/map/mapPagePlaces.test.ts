import { describe, expect, it } from 'vitest'
import {
  mapPageBands,
  mapPageNearest,
  mapPagePlaceLead,
  mapPagePlacePins,
  mapPagePlaceRing,
  mapPagePlaces,
  mapPageTotalsLine,
  placeBadge,
  placeCountWords,
  placesInBands,
} from './mapPagePlaces'
import { BID_BOARD_MAP_DUE_RING_COLOR, JOBS_MAP_COLLECTIONS_RING_COLOR, JOBS_MAP_SECTION_COLOR, MAP_PAGE_ESTIMATE_COLOR, mapPageStageWords } from './mapPageSections'
import { BID_STAGE_MARKER_COLOR } from './builderBidMapFocus'

const office = { lat: 29.42, lng: -98.49 }
const berg = { addressKey: 'river rd', addressLabel: '6288 River Rd, New Braunfels', lat: 29.76, lng: -98.09 } // ~31 mi
import type { MapPagePlaceSource } from './mapPagePlaces'
const e = (o: Record<string, unknown>) => ({ sublabel: '', tableLabel: 'x', ...o }) as unknown as MapPagePlaceSource & { id: string }

const paid = e({ ...berg, kind: 'job', id: 'j1', jobSection: 'paid', tableLabel: 'Breaker' })
const working = e({ ...berg, kind: 'job', id: 'j2', jobSection: 'working', tableLabel: 'Gas line' })
const collections = e({ ...berg, kind: 'job', id: 'j3', jobSection: 'billed', inCollections: true, tableLabel: 'Duct board' })
const pending = e({ ...berg, kind: 'bid', id: 'b1', bidSection: 'pending', bidDueTone: 'soon', tableLabel: 'Pool house' })
const far = e({ addressKey: 'houston', addressLabel: 'Houston', lat: 29.76, lng: -95.37, kind: 'estimate', id: 'e1', meta: 'sent $1,240' })
const noOffice = null

describe('mapPagePlaces', () => {
  it('folds records that share an address into one place, in the order first seen', () => {
    const places = mapPagePlaces([paid, far, working, collections, pending])
    expect(places.map((p) => p.key)).toEqual(['river rd', 'houston'])
    expect(places[0]!.items).toHaveLength(4)
    expect(placeCountWords(places[0]!.items)).toBe('3 jobs · 1 bid')
    expect(mapPageTotalsLine(places)).toBe('2 places · 5 records')
  })

  it('the pin takes the liveliest record and the most urgent ring, and wears the count', () => {
    const places = mapPagePlaces([paid, working, collections, pending])
    const place = places[0]!
    expect(mapPagePlaceLead(place, () => undefined).id).toBe('j2')
    expect(mapPagePlaceRing(place, () => undefined)).toBe(JOBS_MAP_COLLECTIONS_RING_COLOR)
    const pins = mapPagePlacePins(places, { builderFocus: false, focusSection: () => undefined })
    expect(pins[0]).toMatchObject({ id: 'river rd', color: JOBS_MAP_SECTION_COLOR.working, ringColor: JOBS_MAP_COLLECTIONS_RING_COLOR, label: '4' })
    expect(pins[0]!.title).toBe('6288 River Rd, New Braunfels · 3 jobs · 1 bid')
  })

  it('a place of one record is that record; a due bid rings amber; an estimate is violet', () => {
    const pins = mapPagePlacePins(mapPagePlaces([pending, far]), { builderFocus: false, focusSection: () => undefined })
    expect(pins[0]).toMatchObject({ color: BID_STAGE_MARKER_COLOR.pending, ringColor: BID_BOARD_MAP_DUE_RING_COLOR.soon, label: null, title: 'Pool house' })
    expect(pins[1]).toMatchObject({ color: MAP_PAGE_ESTIMATE_COLOR, ringColor: null })
    expect(placeBadge(1)).toBeNull()
    expect(placeBadge(120)).toBe('99+')
  })

  it('bands count places and records from the office and double as filters', () => {
    const places = mapPagePlaces([paid, working, far])
    const bands = mapPageBands(places, office)
    expect(bands.map((b) => [b.key, b.places, b.records])).toEqual([['near', 0, 0], ['mid', 1, 2], ['far', 1, 1]])
    expect(placesInBands(places, office, { near: true, mid: true, far: false }).map((p) => p.key)).toEqual(['river rd'])
    expect(placesInBands(places, noOffice, { near: false, mid: false, far: false })).toHaveLength(2)
    expect(mapPageBands(places, noOffice).every((b) => b.places === 0)).toBe(true)
  })

  it('the nearest list is by miles with a cap', () => {
    const places = mapPagePlaces([far, working])
    const { rows, more } = mapPageNearest(places, office, 1)
    expect(rows[0]!.place.key).toBe('river rd')
    expect(Math.round(rows[0]!.miles!)).toBeGreaterThan(25)
    expect(more).toBe(1)
    expect(mapPageNearest(places, noOffice).rows.map((r) => r.place.key)).toEqual(['river rd', 'houston'])
  })

  it('stage words read the section, Collections and the bid stage', () => {
    expect(mapPageStageWords(collections)).toBe('Billed · Collections')
    expect(mapPageStageWords(working)).toBe('Working')
    expect(mapPageStageWords(pending)).toBe('Not yet won or lost')
    expect(mapPageStageWords(pending, 'lost')).toBe('Lost')
    expect(mapPageStageWords(far)).toBe('sent $1,240')
  })
})
