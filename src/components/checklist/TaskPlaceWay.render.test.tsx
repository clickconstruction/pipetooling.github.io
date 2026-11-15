// @vitest-environment jsdom
/**
 * A task's place carries the painted map that leads to it (punch list #345, step 5). The giver adds
 * the way in on the Where is it? sheet, from the painted maps that come near the ring. A place chip
 * that has one brings it along. The person who gets the task sees the line on the place's picture,
 * reads its name and length, gets Directions to the line's start and opens the map. Every map and
 * place here is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import type { Landed, PaintedMapWhole } from '../../lib/paintedMap/paintedMapIo'
import type { PaintedLine, PaintedPlace } from '../../lib/paintedMap/paintedMap'
import type { TaskPlace, TaskPlaceDraft } from '../../lib/tasks/taskPlace'

vi.mock('../../hooks/useModalStackEntry', () => ({ useModalStackEntry: () => () => true }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
const offered = vi.hoisted(() => ({ places: [] as unknown[] }))
vi.mock('../../lib/tasks/taskPlaceIo', () => ({ loadRecentTaskPlaces: () => Promise.resolve(offered.places) }))
vi.mock('../../hooks/useOfficeAnchor', () => ({ useOfficeAnchor: () => ({ lat: 29.4, lng: -98.5, source: 'office_address', label: 'Office' }) }))
vi.mock('../../lib/materials/myLocation', () => ({ requestMyLocation: () => {}, requestMyFix: () => {} }))
const opened = vi.hoisted(() => ({ urls: [] as string[], maps: [] as string[] }))
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (url: string) => opened.urls.push(url) }))
vi.mock('../../lib/paintedMap/paintedMapDoor', () => ({ openPaintedMap: (id: string) => (opened.maps.push(id), true) }))

/** The map, stood in for: it reports its centre once it opens, lists its dots and names the painted maps it draws. */
vi.mock('../materials/OnSiteMap', () => ({
  default: function MapStub(props: { center: { lat: number; lng: number } | null; onCenterChange?: (c: { lat: number; lng: number }) => void; still?: boolean; painted?: Array<{ name: string; lines: unknown[] }> }) {
    const { center, onCenterChange } = props
    useEffect(() => {
      if (center) onCenterChange?.({ lat: center.lat, lng: center.lng })
    }, [center, onCenterChange])
    return (
      <div data-testid={props.still ? 'still-map' : 'map'} data-painted={(props.painted ?? []).map((m) => `${m.name}:${m.lines.length}`).join('|')}>
        <button type="button" onClick={() => center && onCenterChange?.({ lat: center.lat + 0.05, lng: center.lng })}>drag far away</button>
      </div>
    )
  },
}))

import { TaskPlaceBlock, TaskPlaceLine } from './TaskPlaceBlock'
import { TaskPlaceRow } from './TaskPlaceRow'
import { TaskPlaceSheet } from './TaskPlaceSheet'

const STUB = { lat: 29.551, lng: -98.287 }
const line = (points: Array<[number, number]>, lengthM: number): PaintedLine => ({ id: 'l1', mapId: 'way-1', label: '', how: 'drawn', points: points.map(([lat, lng]) => ({ lat, lng })), poorParts: [], fixedByHand: false, lengthM, marginM: null, measuredFt: null, measuredHow: null, madeBy: 'dana', madeAt: '2026-11-13T15:00:00Z' })
const dot = (name: string, lat: number, lng: number): PaintedPlace => ({ id: `p-${name}`, mapId: 'way-1', name, words: '', lat, lng, accuracyM: null, photoPath: null, setBy: 'dana', setAt: '2026-11-13T15:00:00Z' })
const WAY: PaintedMapWhole = {
  map: { id: 'way-1', name: 'The way in for deliveries', words: '', jobId: 'job-14', developmentId: null, createdBy: 'dana', createdAt: '2026-11-13T15:00:00Z' },
  lines: [line([[29.548, -98.29], [29.551, -98.287]], 253)],
  places: [dot('Truck gate', 29.548, -98.29), dot('Laydown yard', 29.55, -98.288), dot('Water stub', 29.551, -98.287)],
}
const ACROSS_TOWN: PaintedMapWhole = { map: { ...WAY.map, id: 'way-2', name: 'Across town' }, lines: [line([[29.7, -98.4], [29.71, -98.4]], 1100)], places: [] }
const landed = (wholes: PaintedMapWhole[]) => async (): Promise<Landed<PaintedMapWhole[]>> => ({ ok: true, value: wholes })

afterEach(() => {
  cleanup()
  offered.places = []
  opened.urls.length = 0
  opened.maps.length = 0
})

describe('the giver: Add the way in on Where is it?', () => {
  it('reads no painted map until the press, then offers the ones near the ring and hands the pick back with the place', async () => {
    const loadWays = vi.fn(landed([ACROSS_TOWN, WAY]))
    const onUse = vi.fn()
    render(<TaskPlaceSheet start={STUB} initial={null} onUse={onUse} onClose={() => {}} loadWays={loadWays} />)
    const add = await screen.findByRole('button', { name: /Add the way in/ })
    await waitFor(() => expect((add as HTMLButtonElement).disabled).toBe(false))
    expect(loadWays).not.toHaveBeenCalled()
    fireEvent.click(add)
    expect(loadWays).toHaveBeenCalledTimes(1)
    const pick = await screen.findByRole('button', { name: /The way in for deliveries/ })
    expect(pick.textContent).toContain('about 830 ft · 3 places · Reaches this place')
    expect(screen.queryByRole('button', { name: /Across town/ })).toBeNull()
    fireEvent.click(pick)
    expect(document.querySelector('[data-task-place-way]')?.textContent).toContain('The way in for deliveries')
    expect(screen.getByText('Whoever gets the task can open this map.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Use this place' }))
    expect(onUse).toHaveBeenCalledWith({ lat: 29.551, lng: -98.287, name: '', accuracyM: null, mapId: 'way-1', mapName: 'The way in for deliveries' })
  })

  it('a place with no way in is handed back as it always was', async () => {
    const onUse = vi.fn()
    render(<TaskPlaceSheet start={STUB} initial={null} onUse={onUse} onClose={() => {}} loadWays={landed([WAY])} />)
    const use = await screen.findByRole('button', { name: 'Use this place' })
    await waitFor(() => expect((use as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(use)
    expect(onUse).toHaveBeenCalledWith({ lat: 29.551, lng: -98.287, name: '', accuracyM: null })
  })

  it('says so when no painted map comes near, and names where one is painted', async () => {
    render(<TaskPlaceSheet start={STUB} initial={null} onUse={() => {}} onClose={() => {}} loadWays={landed([ACROSS_TOWN])} />)
    const add = await screen.findByRole('button', { name: /Add the way in/ })
    await waitFor(() => expect((add as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(add)
    await waitFor(() => expect(document.querySelector('[data-task-place-ways-none]')?.textContent).toBe('No painted map comes within a mile of this spot. Paint one from a job’s address, or search Paint a map, then pick it here.'))
  })

  it('says why when the painted maps cannot be read', async () => {
    render(<TaskPlaceSheet start={STUB} initial={null} onUse={() => {}} onClose={() => {}} loadWays={async () => ({ ok: false, error: 'The painted maps did not load.' })} />)
    const add = await screen.findByRole('button', { name: /Add the way in/ })
    await waitFor(() => expect((add as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(add)
    expect((await screen.findByRole('alert')).textContent).toBe('The painted maps did not load.')
  })

  it('opens on the way a place already carries, and takes it off on a press', async () => {
    const onUse = vi.fn()
    render(<TaskPlaceSheet start={STUB} initial={{ ...STUB, name: 'Water stub', accuracyM: null, mapId: 'way-1', mapName: 'The way in for deliveries' }} onUse={onUse} onClose={() => {}} loadWays={landed([WAY])} />)
    expect((await screen.findByText('The way in for deliveries')).tagName).toBe('BUTTON')
    fireEvent.click(screen.getByRole('button', { name: 'Take the way in off this place' }))
    expect(document.querySelector('[data-task-place-way]')).toBeNull()
    const use = screen.getByRole('button', { name: 'Use this place' })
    await waitFor(() => expect((use as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(use)
    expect(onUse).toHaveBeenCalledWith({ lat: 29.551, lng: -98.287, name: 'Water stub', accuracyM: null })
  })
})

describe('the giver: a place chip brings its way in', () => {
  const chip = (over: Partial<TaskPlace> = {}): TaskPlace => ({ name: 'Water stub', lat: 29.551, lng: -98.287, accuracyM: null, setBy: 'u1', setAt: '2026-11-14T15:00:00Z', ...over })

  it('a press on a place that has a way in gives the task both, and the chip wears the paint', async () => {
    offered.places = [chip({ mapId: 'way-1' }), chip({ name: 'Pump house', lat: 29.56 })]
    const onChange = vi.fn()
    render(<TaskPlaceRow value={null} onChange={onChange} loadWayName={async () => 'The way in for deliveries'} />)
    const stub = await screen.findByRole('button', { name: 'Water stub' })
    expect(stub.querySelector('[data-task-place-way-mark]')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Pump house' }).querySelector('[data-task-place-way-mark]')).toBeNull()
    fireEvent.click(stub)
    expect(onChange).toHaveBeenCalledWith({ lat: 29.551, lng: -98.287, name: 'Water stub', accuracyM: null, mapId: 'way-1' })
    fireEvent.click(screen.getByRole('button', { name: 'Pump house' }))
    expect(onChange).toHaveBeenLastCalledWith({ lat: 29.56, lng: -98.287, name: 'Pump house', accuracyM: null })
  })

  it('a place of the task\'s own that has a way in wears the paint and names the map on its title', async () => {
    const value: TaskPlaceDraft = { lat: 29.6, lng: -98.2, name: 'North gate', accuracyM: null, mapId: 'way-1' }
    const loadWayName = vi.fn(async () => 'The way in for deliveries')
    render(<TaskPlaceRow value={value} onChange={() => {}} loadWayName={loadWayName} />)
    const own = await screen.findByRole('button', { name: 'North gate' })
    expect(own.querySelector('[data-task-place-way-mark]')).toBeTruthy()
    await waitFor(() => expect(own.getAttribute('title')).toBe('Press to move this place. The way in: The way in for deliveries'))
    expect(loadWayName).toHaveBeenCalledWith('way-1')
    expect(screen.getByText('The person sees this place on the task, with the painted way in.')).toBeTruthy()
  })
})

describe('the person who gets the task', () => {
  const PLACE: TaskPlace = { name: 'Water stub, Lot 14', lat: 29.551, lng: -98.287, accuracyM: null, setBy: 'priya', setAt: '2026-11-15T15:00:00Z', mapId: 'way-1' }
  const one = (whole: PaintedMapWhole | null) => async (): Promise<Landed<PaintedMapWhole | null>> => ({ ok: true, value: whole })

  it('the place\'s line on the card wears the paint when the way in is painted', () => {
    const r = render(<TaskPlaceLine place={PLACE} />)
    expect(screen.getByRole('img', { name: 'The way in is painted' })).toBeTruthy()
    r.rerender(<TaskPlaceLine place={{ ...PLACE, mapId: null }} />)
    expect(screen.queryByRole('img', { name: 'The way in is painted' })).toBeNull()
  })

  it('draws the line on the picture, says its name and length, sends Directions to its start and opens the map', async () => {
    const loadWay = vi.fn(one(WAY))
    render(<TaskPlaceBlock place={PLACE} placedByName="Priya Anand" loadWay={loadWay} />)
    await waitFor(() => expect(document.querySelector('[data-task-place-way]')?.textContent).toBe('The way in is painted: The way in for deliveries, about 830 ft.'))
    expect(loadWay).toHaveBeenCalledWith('way-1')
    await waitFor(() => expect(screen.getByTestId('still-map').getAttribute('data-painted')).toBe('The way in for deliveries:1'))
    fireEvent.click(screen.getByRole('button', { name: 'Directions to the start' }))
    expect(opened.urls).toHaveLength(1)
    expect(opened.urls[0]).toContain('29.548')
    expect(opened.urls[0]).not.toContain('29.551')
    fireEvent.click(screen.getByRole('button', { name: 'Open the map' }))
    expect(opened.maps).toEqual(['way-1'])
    // The same line on the map opened full size.
    fireEvent.click(screen.getByRole('button', { name: 'Open the map of Water stub, Lot 14' }))
    await waitFor(() => expect(screen.getByTestId('map').getAttribute('data-painted')).toBe('The way in for deliveries:1'))
  })

  it('a map that is gone leaves the block as it was: Directions to the place, no line, no press', async () => {
    const loadWay = vi.fn(one(null))
    render(<TaskPlaceBlock place={PLACE} placedByName={null} loadWay={loadWay} />)
    await waitFor(() => expect(loadWay).toHaveBeenCalled())
    fireEvent.click(await screen.findByRole('button', { name: 'Directions' }))
    expect(opened.urls[0]).toContain('29.551')
    expect(document.querySelector('[data-task-place-way]')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Open the map' })).toBeNull()
  })

  it('a place with no way in reads no painted map', async () => {
    const loadWay = vi.fn(one(WAY))
    render(<TaskPlaceBlock place={{ ...PLACE, mapId: null }} placedByName={null} loadWay={loadWay} />)
    await screen.findByRole('button', { name: 'Directions' })
    expect(loadWay).not.toHaveBeenCalled()
  })

  it('where the map\'s window would open under the window the card sits in, the line shows and the press does not', async () => {
    render(<TaskPlaceBlock place={PLACE} placedByName={null} loadWay={one(WAY)} canOpenWay={false} />)
    await waitFor(() => expect(document.querySelector('[data-task-place-way]')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Open the map' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Directions to the start' })).toBeTruthy()
  })
})
