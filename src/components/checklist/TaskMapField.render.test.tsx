// @vitest-environment jsdom
/**
 * The Map press of a task window and what it opens (punch list #345, "A map on a task", step 7):
 * *A map for this task* lists the painted maps the giver can open, one press puts a map on the
 * task, and the row then shows the map lit with its picture. Every map here is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Landed, PaintedMapWhole } from '../../lib/paintedMap/paintedMapIo'
import type { PaintedLine, PaintedPlace } from '../../lib/paintedMap/paintedMap'
import type { PaintedMapSearchRow } from '../../lib/paintedMap/paintedMapSearch'
import type { TaskMapDraft } from '../../lib/tasks/taskMapPick'

vi.mock('../../hooks/useModalStackEntry', () => ({ useModalStackEntry: () => () => true }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

/** The picture, stood in for: it names the painted maps it draws. */
vi.mock('../materials/OnSiteMap', () => ({
  default: function MapStub(props: { still?: boolean; painted?: Array<{ name: string; lines: unknown[] }> }) {
    return <div data-testid={props.still ? 'still-map' : 'map'} data-painted={(props.painted ?? []).map((m) => `${m.name}:${m.lines.length}`).join('|')} />
  },
}))

import { onPaintedMapAsk, type PaintedMapAsk } from '../../lib/paintedMap/paintedMapDoor'
import { TaskMapPress, TaskMapSet } from './TaskMapField'

const line = (mapId: string, points: Array<[number, number]>, lengthM: number): PaintedLine => ({ id: `l-${mapId}`, mapId, label: '', how: 'drawn', points: points.map(([lat, lng]) => ({ lat, lng })), poorParts: [], fixedByHand: false, lengthM, marginM: null, measuredFt: null, measuredHow: null, madeBy: 'dana', madeAt: '2026-11-13T15:00:00Z' })
const dot = (mapId: string, name: string, lat: number, lng: number): PaintedPlace => ({ id: `p-${mapId}-${name}`, mapId, name, words: '', lat, lng, accuracyM: null, photoPath: null, setBy: 'dana', setAt: '2026-11-13T15:00:00Z' })
const whole = (id: string, name: string, createdAt: string, points: Array<[number, number]>, lengthM: number, places: PaintedPlace[] = []): PaintedMapWhole => ({
  map: { id, name, words: '', jobId: null, developmentId: null, createdBy: 'dana', createdAt },
  lines: points.length > 0 ? [line(id, points, lengthM)] : [],
  places,
})
const WAY = whole('way', 'The way in for deliveries', '2026-11-10T15:00:00Z', [[29.548, -98.29], [29.551, -98.287]], 253, [dot('way', 'Truck gate', 29.548, -98.29), dot('way', 'Laydown yard', 29.55, -98.288), dot('way', 'Water stub', 29.551, -98.287)])
const ROUTE = whole('route', 'Lift station route', '2026-11-14T15:00:00Z', [[29.7, -98.4], [29.71, -98.4]], 378)
const TRENCH = whole('trench', 'Meter to the house, Lot 9', '2026-11-12T15:00:00Z', [[29.6, -98.3], [29.6005, -98.3]], 73)
const WHERES: PaintedMapSearchRow[] = [
  { id: 'way', name: WAY.map.name, words: '', jobLabel: 'J523 · Juniper Ridge, Lot 14', developmentLabel: null, hasHome: true },
  { id: 'route', name: ROUTE.map.name, words: '', jobLabel: null, developmentLabel: 'Juniper Ridge', hasHome: true },
  { id: 'trench', name: TRENCH.map.name, words: '', jobLabel: null, developmentLabel: null, hasHome: false },
]
const landed = (wholes: PaintedMapWhole[]) => async (): Promise<Landed<PaintedMapWhole[]>> => ({ ok: true, value: wholes })
const wheres = (rows: PaintedMapSearchRow[] = WHERES) => () => Promise.resolve(rows)

let asks: PaintedMapAsk[] = []
let stopListening = () => {}
beforeEach(() => {
  asks = []
  stopListening = onPaintedMapAsk((ask) => asks.push(ask))
})
afterEach(() => {
  stopListening()
  cleanup()
})

function renderPress(props: Partial<Parameters<typeof TaskMapPress>[0]> = {}) {
  const changes: Array<TaskMapDraft | null> = []
  const reads = { maps: 0 }
  const loadMaps = props.loadMaps ?? landed([WAY, ROUTE, TRENCH])
  render(
    <TaskMapPress
      value={null}
      place={null}
      loadWheres={wheres()}
      {...props}
      onChange={(next) => changes.push(next)}
      loadMaps={() => {
        reads.maps += 1
        return loadMaps()
      }}
    />,
  )
  return { changes, reads }
}

describe('TaskMapPress', () => {
  it('reads nothing until it is pressed, and a task with no map is not lit', () => {
    const { reads } = renderPress()
    const press = screen.getByRole('button', { name: 'Add a map to this task' })
    expect(press.getAttribute('aria-pressed')).toBe('false')
    expect(press.textContent).toBe('Map')
    expect(reads.maps).toBe(0)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a press opens A map for this task, with the newest maps first and what each holds', async () => {
    const { reads } = renderPress()
    fireEvent.click(screen.getByRole('button', { name: 'Add a map to this task' }))
    expect(screen.getByRole('dialog', { name: 'A map for this task' })).toBeTruthy()
    expect(screen.getByText('Reading the painted maps…')).toBeTruthy()
    await waitFor(() => expect(document.querySelector('[data-task-map-sheet-offers]')).toBeTruthy())
    expect(reads.maps).toBe(1)
    const rows = [...document.querySelectorAll('[data-task-map-sheet-offers] button')].map((b) => b.textContent)
    expect(rows).toEqual([
      'Lift station routeabout 1,250 ft · Juniper Ridge, every lot›',
      'Meter to the house, Lot 9about 240 ft · On no job yet›',
      'The way in for deliveriesabout 830 ft · 3 places · J523 · Juniper Ridge, Lot 14›',
    ])
    expect(screen.getByText('The newest maps come first.')).toBeTruthy()
    expect(screen.getByText('Whoever gets this task can open its map, even on a job they are not on the crew of.')).toBeTruthy()
  })

  it('one press on a map puts it on the task and closes the sheet', async () => {
    const { changes } = renderPress()
    fireEvent.click(screen.getByRole('button', { name: 'Add a map to this task' }))
    fireEvent.click(await screen.findByRole('button', { name: /Meter to the house, Lot 9/ }))
    expect(changes).toEqual([{ id: 'trench', name: 'Meter to the house, Lot 9' }])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('with a place on the task the nearest maps come first, each with how near it comes', async () => {
    renderPress({ place: { lat: 29.551, lng: -98.287 } })
    fireEvent.click(screen.getByRole('button', { name: 'Add a map to this task' }))
    await waitFor(() => expect(document.querySelector('[data-task-map-sheet-offers]')).toBeTruthy())
    const rows = [...document.querySelectorAll('[data-task-map-sheet-offers] button')].map((b) => b.textContent ?? '')
    expect(rows[0]).toContain('The way in for deliveries')
    expect(rows[0]).toContain('Reaches this place')
    expect(rows[2]).toContain('Lift station route')
    expect(rows[2]).toMatch(/ mi from the place/)
    expect(screen.getByText('The maps nearest the task’s place come first.')).toBeTruthy()
  })

  it('lit, the press says the task has a map, the sheet marks it and offers to take it off', async () => {
    const { changes } = renderPress({ value: { id: 'way', name: 'The way in for deliveries' } })
    const press = screen.getByRole('button', { name: 'Pick another map' })
    expect(press.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(press)
    const picked = await screen.findByRole('button', { name: /The way in for deliveries/ })
    expect(picked.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Take the map off this task' }))
    expect(changes).toEqual([null])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('with no painted map it names the two doors that paint one', async () => {
    renderPress({ loadMaps: landed([]) })
    fireEvent.click(screen.getByRole('button', { name: 'Add a map to this task' }))
    await waitFor(() => expect(document.querySelector('[data-task-map-sheet-none]')).toBeTruthy())
    expect(document.querySelector('[data-task-map-sheet-none]')?.textContent).toBe('No painted map yet. Paint one from a job’s address, or search Paint a map, then pick it here.')
    expect(screen.queryByRole('searchbox')).toBeNull()
  })

  it('a read that fails says so, and Cancel closes the sheet with nothing changed', async () => {
    const { changes } = renderPress({ loadMaps: async () => ({ ok: false, error: 'The painted maps did not load.' }) })
    fireEvent.click(screen.getByRole('button', { name: 'Add a map to this task' }))
    expect((await screen.findByRole('alert')).textContent).toBe('The painted maps did not load.')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(changes).toEqual([])
  })

  it('the homes failing to read costs their words and never the list', async () => {
    renderPress({ loadWheres: () => Promise.reject(new Error('nope')) })
    fireEvent.click(screen.getByRole('button', { name: 'Add a map to this task' }))
    await waitFor(() => expect(document.querySelector('[data-task-map-sheet-offers]')).toBeTruthy())
    expect(document.querySelectorAll('[data-task-map-sheet-offers] button')).toHaveLength(3)
    expect(screen.queryByText(/On no job yet/)).toBeNull()
  })

  it('with many maps a box finds one by name, and a name nobody painted says so', async () => {
    const many = Array.from({ length: 8 }, (_, i) => whole(`m${i}`, i === 3 ? 'The orchard drive' : `Map ${i}`, `2026-11-0${i + 1}T15:00:00Z`, [[29.5, -98.3], [29.51, -98.3]], 100))
    renderPress({ loadMaps: landed(many), loadWheres: wheres([]) })
    fireEvent.click(screen.getByRole('button', { name: 'Add a map to this task' }))
    const box = await screen.findByRole('searchbox', { name: 'Find a map by name' })
    fireEvent.change(box, { target: { value: 'orchard' } })
    expect([...document.querySelectorAll('[data-task-map-sheet-offers] button')].map((b) => b.textContent)).toEqual(['The orchard driveabout 330 ft›'])
    fireEvent.change(box, { target: { value: 'zzz' } })
    expect(document.querySelector('[data-task-map-sheet-none]')?.textContent).toBe('No painted map has that name.')
  })

  it('a press outside the sheet closes it alone', async () => {
    const { changes } = renderPress()
    fireEvent.click(screen.getByRole('button', { name: 'Add a map to this task' }))
    await waitFor(() => expect(document.querySelector('[data-task-map-sheet-offers]')).toBeTruthy())
    fireEvent.click(document.querySelector('[data-task-map-sheet]')!)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(changes).toEqual([])
  })
})

describe('TaskMapSet', () => {
  const loadOne = (w: PaintedMapWhole | null) => async (): Promise<Landed<PaintedMapWhole | null>> => ({ ok: true, value: w })

  it('draws nothing for a task with no map', () => {
    render(<TaskMapSet value={null} onChange={() => {}} loadMap={loadOne(WAY)} />)
    expect(document.querySelector('[data-task-map-set]')).toBeNull()
  })

  it('shows the map lit with its name, a picture of its line and what it holds', async () => {
    render(<TaskMapSet value={{ id: 'way', name: null }} onChange={() => {}} loadMap={loadOne(WAY)} />)
    // Before the read, the map has no name yet.
    expect(document.querySelector('[data-task-map-set-open]')?.textContent).toBe('A painted map')
    await waitFor(() => expect(document.querySelector('[data-task-map-set-open]')?.textContent).toBe('The way in for deliveries'))
    expect((await screen.findByTestId('still-map')).getAttribute('data-painted')).toBe('The way in for deliveries:1')
    expect(document.querySelector('[data-task-map-set-words]')?.textContent).toBe('The way in for deliveries · about 830 ft · 3 places. Whoever gets the task can open this map.')
  })

  it('a press on the name opens the painted map, and ✕ takes it off the task', async () => {
    const changes: Array<TaskMapDraft | null> = []
    render(<TaskMapSet value={{ id: 'way', name: 'The way in for deliveries' }} onChange={(next) => changes.push(next)} loadMap={loadOne(WAY)} />)
    fireEvent.click(screen.getByRole('button', { name: 'The way in for deliveries' }))
    expect(asks).toEqual([{ kind: 'open', mapId: 'way', address: null }])
    fireEvent.click(screen.getByRole('button', { name: 'Take the map off this task' }))
    expect(changes).toEqual([null])
  })

  it('a map that cannot be read keeps its chip and its ✕, with no picture and nothing taken off', async () => {
    const changes: Array<TaskMapDraft | null> = []
    render(<TaskMapSet value={{ id: 'way', name: null }} onChange={(next) => changes.push(next)} loadMap={loadOne(null)} />)
    await waitFor(() => expect(document.querySelector('[data-task-map-set-words]')?.textContent).toBe('Whoever gets the task can open this map.'))
    expect(document.querySelector('[data-task-map-set-picture]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Take the map off this task' })).toBeTruthy()
    expect(changes).toEqual([])
  })
})
