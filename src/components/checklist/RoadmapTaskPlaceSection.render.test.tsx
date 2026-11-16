// @vitest-environment jsdom
/**
 * A roadmap task's place in its card window (punch list #328, PR 5): a planner gets the Place row
 * and each press saves itself, a save that fails says why and puts the row back, and anyone else
 * sees the place when there is one.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { TaskPlace } from '../../lib/tasks/taskPlace'

const io = vi.hoisted(() => ({
  place: null as TaskPlace | null,
  offered: [] as TaskPlace[],
  saves: [] as Array<{ taskId: string; place: unknown; userId: string | null }>,
  refusal: null as string | null,
}))
vi.mock('../../lib/tasks/taskPlaceIo', () => ({
  loadRoadmapTaskPlace: () => Promise.resolve(io.place),
  loadRecentTaskPlaces: () => Promise.resolve(io.offered),
  saveRoadmapTaskPlace: (taskId: string, place: unknown, userId: string | null) => {
    io.saves.push({ taskId, place, userId })
    return Promise.resolve(io.refusal)
  },
}))
vi.mock('../../hooks/useOfficeAnchor', () => ({ useOfficeAnchor: () => null }))
const mapIo = vi.hoisted(() => ({ alone: null as string | null, saves: [] as Array<string | null>, refusal: null as string | null, whole: null as unknown }))
vi.mock('../../lib/tasks/taskMapIo', () => ({
  loadRoadmapTaskMapAlone: () => Promise.resolve(mapIo.alone),
  saveRoadmapTaskMap: (_taskId: string, mapId: string | null) => {
    mapIo.saves.push(mapId)
    return Promise.resolve(mapIo.refusal)
  },
}))
vi.mock('../../lib/paintedMap/paintedMapIo', () => ({ loadPaintedMap: () => Promise.resolve({ ok: true, value: mapIo.whole }) }))
// The task's painted map (#345): the press is stood in for by one press that hands up a map and says whether it may
// paint, and the set strip by one that names the map it holds, says whether it may open it, and takes it off.
vi.mock('./TaskMapField', () => ({
  TaskMapPress: (props: { onChange: (v: unknown) => void; canPaint?: boolean }) => (
    <button type="button" onClick={() => props.onChange({ id: 'map-9', name: 'The trench' })}>
      {`stub: pick the trench${props.canPaint === false ? ' (picks only)' : ''}`}
    </button>
  ),
  TaskMapSet: (props: { value: { id: string; withPlace?: boolean } | null; onChange: (v: unknown) => void; canOpen?: boolean }) =>
    props.value ? (
      <button type="button" onClick={() => props.onChange(null)}>
        {`stub: map ${props.value.id}${props.value.withPlace ? ' with the place' : ''}${props.canOpen === false ? ' (no open)' : ''}`}
      </button>
    ) : null,
}))
const photoIo = vi.hoisted(() => ({ path: null as string | null, puts: [] as string[], cleared: 0, refusal: null as string | null }))
vi.mock('../../lib/tasks/taskSpotPhotoIo', () => ({
  loadTaskSpotPhotoPath: () => Promise.resolve(photoIo.path),
  taskSpotPhotoUrls: (paths: string[]) => Promise.resolve(new Map(paths.map((p) => [p, `signed:${p}`]))),
  putTaskSpotPhoto: (owner: { kind: string; id: string }, id: string) => {
    photoIo.puts.push(`${owner.kind}/${owner.id}/${id}`)
    return Promise.resolve(photoIo.refusal ? { error: photoIo.refusal } : { path: `${owner.kind}/${owner.id}/${id}.jpg` })
  },
  saveTaskSpotPhotoPath: () => {
    photoIo.cleared += 1
    return Promise.resolve(photoIo.refusal)
  },
  removeTaskSpotPhotoFile: () => Promise.resolve(),
}))
vi.mock('../materials/OnSiteMap', () => ({ default: () => <div data-testid="still-map" /> }))
vi.mock('../../lib/materials/myLocation', () => ({ requestMyFix: () => {}, requestMyLocation: () => {} }))

import { RoadmapTaskPlaceSection } from './RoadmapTaskPlaceSection'

const GATE: TaskPlace = { name: 'North gate', lat: 29.57, lng: -98.3, accuracyM: null, setBy: 'rosa', setAt: '2026-11-03T18:00:00Z' }
const PUMP: TaskPlace = { name: 'Pump house', lat: 29.55, lng: -98.3, accuracyM: 6, setBy: 'rosa', setAt: '2026-11-10T18:00:00Z' }
const nameOf = (id: string) => (id === 'rosa' ? 'Rosa' : null)

afterEach(() => {
  cleanup()
  io.place = null
  io.offered = []
  io.saves = []
  io.refusal = null
  mapIo.alone = null
  mapIo.saves = []
  mapIo.refusal = null
  mapIo.whole = null
  photoIo.path = null
  photoIo.puts = []
  photoIo.cleared = 0
  photoIo.refusal = null
})

describe('RoadmapTaskPlaceSection', () => {
  it('a planner sees the Place row with the task\'s place lit, and a press on another chip saves itself', async () => {
    io.place = GATE
    io.offered = [PUMP, GATE]
    render(<RoadmapTaskPlaceSection taskId="t1" canEdit userId="u9" nameOf={nameOf} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'North gate' }).getAttribute('aria-pressed')).toBe('true'))
    fireEvent.click(screen.getByRole('button', { name: 'Pump house' }))
    await waitFor(() => expect(io.saves).toHaveLength(1))
    // The place is saved with the map the task has now: none.
    expect(io.saves[0]).toEqual({ taskId: 't1', place: { lat: 29.55, lng: -98.3, name: 'Pump house', accuracyM: 6, mapId: null }, userId: 'u9' })
    expect(mapIo.saves).toEqual([])
    expect(screen.getByRole('button', { name: 'Pump house' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('Remove the place saves no place', async () => {
    io.place = GATE
    io.offered = [GATE]
    render(<RoadmapTaskPlaceSection taskId="t1" canEdit userId="u9" nameOf={nameOf} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Remove the place' }))
    await waitFor(() => expect(io.saves).toEqual([{ taskId: 't1', place: null, userId: 'u9' }]))
  })

  it('a save that fails says why and puts the row back', async () => {
    io.place = GATE
    io.offered = [PUMP, GATE]
    io.refusal = 'You may not plan this roadmap.'
    render(<RoadmapTaskPlaceSection taskId="t1" canEdit userId="u9" nameOf={nameOf} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'North gate' }).getAttribute('aria-pressed')).toBe('true'))
    fireEvent.click(screen.getByRole('button', { name: 'Pump house' }))
    expect((await screen.findByRole('alert')).textContent).toBe('You may not plan this roadmap.')
    expect(screen.getByRole('button', { name: 'North gate' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Pump house' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('someone who cannot plan sees the place and the way there, and no row to change it', async () => {
    io.place = GATE
    render(<RoadmapTaskPlaceSection taskId="t1" canEdit={false} userId="u2" nameOf={nameOf} />)
    expect(await screen.findByText('North gate')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Directions' })).toBeTruthy()
    expect(screen.getByText('Placed by Rosa on Nov 3. Your location stays on this phone.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '＋ New place' })).toBeNull()
  })

  it('someone who cannot plan, on a task with no place, sees nothing', async () => {
    render(<RoadmapTaskPlaceSection taskId="t1" canEdit={false} userId="u2" nameOf={nameOf} />)
    await new Promise((r) => setTimeout(r, 20))
    expect(document.querySelector('[data-roadmap-task-place]')).toBeNull()
  })

  it('a planner sees the task\'s photo, and Remove the photo takes it off at once', async () => {
    photoIo.path = 'roadmap/10000000-0000-0000-0000-000000000001/p1.jpg'
    render(<RoadmapTaskPlaceSection taskId="t1" canEdit userId="u9" nameOf={nameOf} />)
    const img = (await screen.findByAltText('The photo of the spot')) as HTMLImageElement
    expect(img.getAttribute('src')).toBe('signed:roadmap/10000000-0000-0000-0000-000000000001/p1.jpg')
    fireEvent.click(screen.getByRole('button', { name: 'Remove the photo' }))
    await waitFor(() => expect(photoIo.cleared).toBe(1))
    expect(screen.queryByAltText('The photo of the spot')).toBeNull()
    expect(screen.getByRole('button', { name: '＋ Add a photo' })).toBeTruthy()
  })

  it('taking the photo off that fails says why and puts it back', async () => {
    photoIo.path = 'roadmap/10000000-0000-0000-0000-000000000001/p1.jpg'
    photoIo.refusal = 'You may not plan this roadmap.'
    render(<RoadmapTaskPlaceSection taskId="t1" canEdit userId="u9" nameOf={nameOf} />)
    await screen.findByAltText('The photo of the spot')
    fireEvent.click(screen.getByRole('button', { name: 'Remove the photo' }))
    expect((await screen.findByRole('alert')).textContent).toBe('You may not plan this roadmap.')
    expect(screen.getByAltText('The photo of the spot')).toBeTruthy()
  })

  it('someone who cannot plan, on a task with a photo and no place, sees the photo alone', async () => {
    photoIo.path = 'roadmap/10000000-0000-0000-0000-000000000001/p1.jpg'
    render(<RoadmapTaskPlaceSection taskId="t1" canEdit={false} userId="u2" nameOf={nameOf} />)
    expect(await screen.findByRole('button', { name: 'Open the photo of the spot' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '＋ Add a photo' })).toBeNull()
  })
})

describe('RoadmapTaskPlaceSection, the task\'s painted map (punch list #345)', () => {
  const TRENCH = {
    map: { id: 'map-1', name: 'The trench', words: '', jobId: null, developmentId: null, createdBy: 'rosa', createdAt: '2026-11-13T15:00:00Z' },
    lines: [{ id: 'l1', mapId: 'map-1', label: '', how: 'drawn', points: [{ lat: 29.548, lng: -98.29 }, { lat: 29.551, lng: -98.287 }], poorParts: [], fixedByHand: false, lengthM: 253, marginM: null, measuredFt: null, measuredHow: null, madeBy: 'rosa', madeAt: '2026-11-13T15:00:00Z' }],
    places: [],
  }

  it('a planner picks a map and the pick saves itself, with no painting and no opening from the roadmap', async () => {
    render(<RoadmapTaskPlaceSection taskId="t1" canEdit userId="u9" nameOf={nameOf} />)
    fireEvent.click(await screen.findByRole('button', { name: 'stub: pick the trench (picks only)' }))
    await waitFor(() => expect(mapIo.saves).toEqual(['map-9']))
    expect(screen.getByRole('button', { name: 'stub: map map-9 (no open)' })).toBeTruthy()
    // The place was not touched.
    expect(io.saves).toEqual([])
  })

  it('a task saved with a map and no place opens with it, and taking it off saves no map', async () => {
    mapIo.alone = 'map-1'
    render(<RoadmapTaskPlaceSection taskId="t1" canEdit userId="u9" nameOf={nameOf} />)
    fireEvent.click(await screen.findByRole('button', { name: 'stub: map map-1 (no open)' }))
    await waitFor(() => expect(mapIo.saves).toEqual([null]))
    expect(screen.queryByRole('button', { name: /^stub: map / })).toBeNull()
  })

  it('a place chip that has a way in is saved with its map, and the map shows as that place\'s', async () => {
    io.offered = [{ ...PUMP, mapId: 'way-1' }]
    render(<RoadmapTaskPlaceSection taskId="t1" canEdit userId="u9" nameOf={nameOf} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Pump house' }))
    await waitFor(() => expect(io.saves).toHaveLength(1))
    expect(io.saves[0]!.place).toMatchObject({ name: 'Pump house', mapId: 'way-1' })
    expect(screen.getByRole('button', { name: 'stub: map way-1 with the place (no open)' })).toBeTruthy()
    expect(mapIo.saves).toEqual([])
  })

  it('a map picked by itself stays when the place is taken off: the place is cleared, then the map is written again', async () => {
    io.place = GATE
    io.offered = [GATE]
    render(<RoadmapTaskPlaceSection taskId="t1" canEdit userId="u9" nameOf={nameOf} />)
    fireEvent.click(await screen.findByRole('button', { name: 'stub: pick the trench (picks only)' }))
    await waitFor(() => expect(mapIo.saves).toEqual(['map-9']))
    fireEvent.click(screen.getByRole('button', { name: 'Remove the place' }))
    await waitFor(() => expect(mapIo.saves).toEqual(['map-9', 'map-9']))
    expect(io.saves).toEqual([{ taskId: 't1', place: null, userId: 'u9' }])
    expect(screen.getByRole('button', { name: 'stub: map map-9 (no open)' })).toBeTruthy()
  })

  it('a map the database refuses says why and puts the row back', async () => {
    mapIo.refusal = 'That map cannot go on a task. It is not a map you can open.'
    render(<RoadmapTaskPlaceSection taskId="t1" canEdit userId="u9" nameOf={nameOf} />)
    fireEvent.click(await screen.findByRole('button', { name: 'stub: pick the trench (picks only)' }))
    expect((await screen.findByRole('alert')).textContent).toBe('That map cannot go on a task. It is not a map you can open.')
    expect(screen.queryByRole('button', { name: /^stub: map / })).toBeNull()
  })

  it('someone who cannot plan sees the map\'s line and the way to its start, and no press that opens it', async () => {
    mapIo.alone = 'map-1'
    mapIo.whole = TRENCH
    render(<RoadmapTaskPlaceSection taskId="t1" canEdit={false} userId="u2" nameOf={nameOf} />)
    await waitFor(() => expect(document.querySelector('[data-task-map-line]')?.textContent).toBe('The trench · about 830 ft'))
    expect(screen.getByRole('button', { name: 'Directions to the start' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Open the map' })).toBeNull()
    expect(screen.getByText('Painted by Rosa on Nov 13. Your location stays on this phone.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^stub: / })).toBeNull()
  })
})

