// @vitest-environment jsdom
/**
 * A task with a painted map and no place (punch list #345, "A map on a task"): the card wears the
 * map's name under its title, and opened it draws the line from above with Open the map, Directions
 * to the start and How far am I?. A map that is gone draws nothing. Every map here is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { settle } from '../../test/renderSmokeMocks'
import type { Landed, PaintedMapWhole } from '../../lib/paintedMap/paintedMapIo'
import type { PaintedLine, PaintedPlace } from '../../lib/paintedMap/paintedMap'
import type { TaskPlace } from '../../lib/tasks/taskPlace'

const io = vi.hoisted(() => ({ answer: null as unknown, reads: [] as string[] }))
vi.mock('../../lib/paintedMap/paintedMapIo', () => ({
  loadPaintedMap: (id: string) => {
    io.reads.push(id)
    return Promise.resolve(io.answer)
  },
}))
vi.mock('../../lib/tasks/taskPlaceIo', () => ({ addTaskPlaceFromTheSpot: () => Promise.resolve(null) }))
const fix = vi.hoisted(() => ({ me: null as null | { lat: number; lng: number; accuracyM: number | null } }))
vi.mock('../../lib/materials/myLocation', () => ({
  requestMyFix: (ok: (p: unknown) => void, fail: (why: string) => void) => (fix.me ? ok(fix.me) : fail('refused')),
}))
/** Which phone the page takes itself to be on, for the Precise Location line's words (#402). */
vi.mock('../../hooks/usePreciseLocation', () => ({ usePhoneKind: () => 'iphone-safari' }))
const opened = vi.hoisted(() => ({ urls: [] as string[] }))
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (url: string) => opened.urls.push(url) }))

/** The picture, stood in for: it names the painted maps it draws, where it looks and its dots. */
vi.mock('../materials/OnSiteMap', () => ({
  default: function MapStub(props: { center: { lat: number; lng: number } | null; startZoom?: number; still?: boolean; pins: Array<{ id: string }>; painted?: Array<{ name: string; lines: unknown[]; places: unknown[] }> }) {
    return (
      <div
        data-testid={props.still ? 'still-map' : 'map'}
        data-painted={(props.painted ?? []).map((m) => `${m.name}:${m.lines.length}:${m.places.length}`).join('|')}
        data-center={props.center ? `${props.center.lat.toFixed(4)},${props.center.lng.toFixed(4)}` : ''}
        data-zoom={props.startZoom ?? ''}
        data-pins={props.pins.map((p) => p.id).join(',')}
      />
    )
  },
}))

import { onPaintedMapAsk, paintedMapsChanged, type PaintedMapAsk } from '../../lib/paintedMap/paintedMapDoor'
import { ChecklistInstanceCard } from './ChecklistInstanceCard'
import { TaskMapBlock } from './TaskMapBlock'

const line = (points: Array<[number, number]>, lengthM: number): PaintedLine => ({ id: 'l1', mapId: 'map-1', label: '', how: 'drawn', points: points.map(([lat, lng]) => ({ lat, lng })), poorParts: [], fixedByHand: false, lengthM, marginM: null, measuredFt: null, measuredHow: null, madeBy: 'dana', madeAt: '2026-11-13T15:00:00Z' })
const dot = (name: string, lat: number, lng: number, at: string): PaintedPlace => ({ id: `p-${name}`, mapId: 'map-1', name, words: '', lat, lng, accuracyM: null, photoPath: null, setBy: 'dana', setAt: at })
const TRENCH: PaintedMapWhole = {
  map: { id: 'map-1', name: 'The trench', words: '', jobId: null, developmentId: null, createdBy: 'dana', createdAt: '2026-11-13T15:00:00Z' },
  lines: [line([[29.548, -98.29], [29.551, -98.287]], 253)],
  places: [dot('Start by the meter', 29.548, -98.29, '2026-11-13T15:01:00Z'), dot('Under the drive', 29.55, -98.288, '2026-11-13T15:02:00Z'), dot('Stub up', 29.551, -98.287, '2026-11-13T15:03:00Z')],
}
const landed = (whole: PaintedMapWhole | null): Landed<PaintedMapWhole | null> => ({ ok: true, value: whole })
const PLACE: TaskPlace = { name: 'Pump house', lat: 29.5512, lng: -98.2874, accuracyM: 6, setBy: 'lead-1', setAt: '2026-11-03T18:00:00Z' }

function renderCard(overrides: Partial<Parameters<typeof ChecklistInstanceCard>[0]> = {}) {
  return render(
    <ul>
      <ChecklistInstanceCard
        instance={{ id: 'inst-1', completed_at: null, reviewed_at: null }}
        title="Dig the trench for the water line"
        events={[]}
        nameById={{ dana: 'Dana' }}
        currentUserId="me-1"
        onToggleComplete={() => {}}
        onPostComment={() => Promise.resolve(true)}
        {...overrides}
      />
    </ul>,
  )
}

let asks: PaintedMapAsk[] = []
let stopListening = () => {}
beforeEach(() => {
  io.answer = landed(TRENCH)
  io.reads = []
  fix.me = null
  opened.urls = []
  asks = []
  stopListening = onPaintedMapAsk((ask) => asks.push(ask))
})
afterEach(() => {
  stopListening()
  cleanup()
})

describe('a task card with a painted map and no place', () => {
  it('wears the map under the title: the stroke, the name, the length and the places', async () => {
    renderCard({ mapId: 'map-1' })
    await settle()
    const lineEl = document.querySelector('[data-task-map-line]')
    expect(lineEl?.textContent).toBe('The trench · about 830 ft · 3 places')
    expect(screen.getByRole('img', { name: 'This task has a painted map' })).toBeTruthy()
    // Closed, the card draws no picture.
    expect(document.querySelector('[data-task-map-block]')).toBeNull()
    expect(io.reads).toEqual(['map-1'])
  })

  it('opened, it draws the whole line from above and the three presses', async () => {
    renderCard({ mapId: 'map-1' })
    await settle()
    fireEvent.click(screen.getByText(/Add a note/))
    await waitFor(() => expect(screen.getByTestId('still-map')).toBeTruthy())
    const picture = screen.getByTestId('still-map')
    expect(picture.getAttribute('data-painted')).toBe('The trench:1:3')
    // The picture looks at the middle of the line, not at one end of it.
    expect(picture.getAttribute('data-center')).toBe('29.5495,-98.2885')
    expect(Number(picture.getAttribute('data-zoom'))).toBeGreaterThan(10)
    expect(screen.getByRole('button', { name: 'Open the map' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Directions to the start' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'How far am I?' })).toBeTruthy()
    expect(screen.getByText('Painted by Dana on Nov 13. Your location stays on this phone.')).toBeTruthy()
    // The key under the picture names each numbered dot.
    expect(document.querySelector('[data-task-map-places]')?.textContent).toBe('1 Start by the meter2 Under the drive3 Stub up')
  })

  it('Open the map and the picture both open the painted map, and Directions goes to the line\'s first point', async () => {
    renderCard({ mapId: 'map-1' })
    await settle()
    fireEvent.click(screen.getByText(/Add a note/))
    await waitFor(() => expect(screen.getByTestId('still-map')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Open the map' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open the map The trench' }))
    expect(asks).toEqual([
      { kind: 'open', mapId: 'map-1', address: null },
      { kind: 'open', mapId: 'map-1', address: null },
    ])
    fireEvent.click(screen.getByRole('button', { name: 'Directions to the start' }))
    expect(opened.urls).toHaveLength(1)
    expect(opened.urls[0]).toContain('29.548')
    expect(opened.urls[0]).toContain('-98.29')
  })

  it('How far am I? measures to the start and puts the person on the picture', async () => {
    fix.me = { lat: 29.547, lng: -98.29, accuracyM: 6 }
    renderCard({ mapId: 'map-1' })
    await settle()
    fireEvent.click(screen.getByText(/Add a note/))
    await waitFor(() => expect(screen.getByTestId('still-map')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'How far am I?' }))
    expect(document.querySelector('[data-task-map-far]')?.textContent).toMatch(/^The start is .+ north of you\. Your phone is sure /)
    expect(screen.getByTestId('still-map').getAttribute('data-pins')).toBe('me')
  })

  it('says no distance from a rough reading, puts nobody on the picture, and shows the way to the switch (#402)', async () => {
    fix.me = { lat: 29.9, lng: -98.9, accuracyM: 3200 }
    renderCard({ mapId: 'map-1' })
    await settle()
    fireEvent.click(screen.getByText(/Add a note/))
    await waitFor(() => expect(screen.getByTestId('still-map')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'How far am I?' }))
    expect(document.querySelector('[data-task-map-far]')).toBeNull()
    const alert = screen.getByRole('alert')
    expect(alert.querySelector('b')?.textContent).toBe('Precise Location looks off.')
    expect(alert.querySelector('[data-precise-note]')?.textContent).toBe('How far cannot be told from a reading that wide.')
    expect(alert.querySelectorAll('ol[data-precise-steps] li')).toHaveLength(5)
    expect(screen.getByTestId('still-map').getAttribute('data-pins')).toBe('')
  })

  it('a phone that will not say where it is gets the reason, and the card stands', async () => {
    renderCard({ mapId: 'map-1' })
    await settle()
    fireEvent.click(screen.getByText(/Add a note/))
    await waitFor(() => expect(screen.getByTestId('still-map')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'How far am I?' }))
    expect(document.querySelector('[data-task-map-no-fix]')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open the map' })).toBeTruthy()
  })

  it('reads the map again when a painted map changes, so a place added from Open the map shows', async () => {
    renderCard({ mapId: 'map-1' })
    await settle()
    io.answer = landed({ ...TRENCH, places: [...TRENCH.places, dot('Shutoff', 29.5505, -98.2875, '2026-11-15T15:00:00Z')] })
    act(() => paintedMapsChanged())
    await waitFor(() => expect(document.querySelector('[data-task-map-line]')?.textContent).toBe('The trench · about 830 ft · 4 places'))
    expect(io.reads).toEqual(['map-1', 'map-1'])
  })

  it('a map that is gone draws no line and no block, and the photo of the spot still stands by itself', async () => {
    io.answer = landed(null)
    renderCard({ mapId: 'map-1', spotPhotoUrl: 'https://example.test/spot.jpg' })
    await settle()
    expect(document.querySelector('[data-task-map-line]')).toBeNull()
    fireEvent.click(screen.getByText(/Add a note/))
    expect(document.querySelector('[data-task-map-block]')).toBeNull()
    expect(document.querySelector('[data-task-spot-photo]')).toBeTruthy()
  })

  it('a read that fails draws nothing, never an error on the card', async () => {
    io.answer = { ok: false, error: 'The painted map did not load.' }
    renderCard({ mapId: 'map-1' })
    await settle()
    expect(document.querySelector('[data-task-map-line]')).toBeNull()
    expect(screen.queryByText('The painted map did not load.')).toBeNull()
  })

  it('with a photo of the spot, the photo sits beside the picture and is not drawn twice', async () => {
    renderCard({ mapId: 'map-1', spotPhotoUrl: 'https://example.test/spot.jpg' })
    await settle()
    fireEvent.click(screen.getByText(/Add a note/))
    await waitFor(() => expect(screen.getByTestId('still-map')).toBeTruthy())
    expect(document.querySelectorAll('[data-task-spot-photo]')).toHaveLength(1)
  })
})

describe('a card with no map, and a card with a place', () => {
  it('no map is no read, no line and no block', async () => {
    renderCard()
    await settle()
    expect(io.reads).toEqual([])
    expect(document.querySelector('[data-task-map-line]')).toBeNull()
    fireEvent.click(screen.getByText(/Add a note/))
    expect(document.querySelector('[data-task-map-block]')).toBeNull()
  })

  it('a place wins: the card draws the place and leaves the map to the place\'s own block', async () => {
    renderCard({ place: PLACE, mapId: 'map-1' })
    await settle()
    expect(document.querySelector('[data-task-place-line]')).toBeTruthy()
    expect(document.querySelector('[data-task-map-line]')).toBeNull()
    expect(io.reads).toEqual([])
  })
})

describe('TaskMapBlock where the map\'s window cannot open', () => {
  it('draws the line and Directions, with no Open the map and a picture that takes no press', () => {
    render(<TaskMapBlock whole={TRENCH} canOpen={false} />)
    expect(screen.queryByRole('button', { name: 'Open the map' })).toBeNull()
    expect(screen.getByRole('img', { name: 'The map The trench, seen from above' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Directions to the start' })).toBeTruthy()
  })

  it('a map with nothing on it yet draws no picture and no Directions, and still opens', () => {
    render(<TaskMapBlock whole={{ ...TRENCH, lines: [], places: [] }} />)
    expect(document.querySelector('[data-task-map-picture]')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Directions to the start' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'How far am I?' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Open the map' })).toBeTruthy()
  })
})
