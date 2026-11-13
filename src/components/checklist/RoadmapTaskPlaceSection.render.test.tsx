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
    expect(io.saves[0]).toEqual({ taskId: 't1', place: { lat: 29.55, lng: -98.3, name: 'Pump house', accuracyM: 6 }, userId: 'u9' })
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
