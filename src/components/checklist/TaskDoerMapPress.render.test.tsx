// @vitest-environment jsdom
/**
 * 🗺 Map on a task with no map (punch list #369, step C2): the press offers three ways in, opens the painting window
 * on the one picked, and when the window closes with something saved, puts the map on the task.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TaskDoerMapPress } from './TaskDoerMapPress'
import type { PaintedMapToPaint } from '../../lib/paintedMap/paintedMapDoor'

vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => true }))

type Closed = () => void
function setup(over: { opens?: boolean; saved?: 'line' | 'place' | 'nothing' | 'gone'; refuse?: string | null } = {}) {
  const asks: Array<{ start: PaintedMapToPaint; closed: Closed }> = []
  const paint = vi.fn((start: PaintedMapToPaint, onClosed?: Closed) => {
    if (over.opens === false) return false
    asks.push({ start, closed: onClosed ?? (() => {}) })
    return true
  })
  const saved = over.saved ?? 'line'
  const loadMap = vi.fn(async (id: string) => ({
    ok: true as const,
    value: saved === 'gone' ? null : { map: { id, name: 'Find the shut-off valve' }, lines: saved === 'line' ? [{}] : [], places: saved === 'place' ? [{}] : [] },
  }))
  const addMap = vi.fn(async () => over.refuse ?? null)
  const onAdded = vi.fn()
  render(
    <TaskDoerMapPress
      instanceId="inst-1"
      taskWords="Find the shut-off valve"
      place={{ lat: 29.55, lng: -98.28 }}
      onAdded={onAdded}
      paint={paint as never}
      loadMap={loadMap as never}
      addMap={addMap}
      newId={() => 'map-new'}
    />,
  )
  return { asks, paint, loadMap, addMap, onAdded }
}

describe('TaskDoerMapPress', () => {
  it('the press opens A map for this task with its three ways in and what happens next', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: '🗺 Map' }))
    const sheet = screen.getByRole('dialog', { name: 'A map for this task' })
    expect(sheet.textContent).toContain('Find the shut-off valve')
    expect(screen.getByRole('button', { name: /Draw it by hand/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Leave a point/ })).toBeTruthy()
    expect(sheet.textContent).toContain('The map goes on the task when you save it.')
  })

  it('Leave a point opens the painting window on a place, named for the task, at the task\'s place', () => {
    const { asks } = setup()
    fireEvent.click(screen.getByRole('button', { name: '🗺 Map' }))
    fireEvent.click(screen.getByRole('button', { name: /Leave a point/ }))
    expect(asks).toHaveLength(1)
    expect(asks[0]!.start).toMatchObject({ id: 'map-new', name: 'Find the shut-off valve', first: 'place', home: { jobId: null, center: { lat: 29.55, lng: -98.28 } } })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('when the window closes with a line saved, the map goes on the task and the page hears', async () => {
    const { asks, addMap, onAdded } = setup({ saved: 'line' })
    fireEvent.click(screen.getByRole('button', { name: '🗺 Map' }))
    fireEvent.click(screen.getByRole('button', { name: /Draw it by hand/ }))
    expect(asks[0]!.start.first).toBe('line')
    asks[0]!.closed()
    await waitFor(() => expect(addMap).toHaveBeenCalledWith('inst-1', 'map-new'))
    await waitFor(() => expect(onAdded).toHaveBeenCalledTimes(1))
  })

  it('a point alone is enough', async () => {
    const { asks, addMap } = setup({ saved: 'place' })
    fireEvent.click(screen.getByRole('button', { name: '🗺 Map' }))
    fireEvent.click(screen.getByRole('button', { name: /Leave a point/ }))
    asks[0]!.closed()
    await waitFor(() => expect(addMap).toHaveBeenCalledTimes(1))
  })

  it('a window closed with nothing saved changes nothing', async () => {
    const { asks, loadMap, addMap, onAdded } = setup({ saved: 'nothing' })
    fireEvent.click(screen.getByRole('button', { name: '🗺 Map' }))
    fireEvent.click(screen.getByRole('button', { name: /Draw it by hand/ }))
    asks[0]!.closed()
    await waitFor(() => expect(loadMap).toHaveBeenCalledTimes(1))
    expect(addMap).not.toHaveBeenCalled()
    expect(onAdded).not.toHaveBeenCalled()
  })

  it('a refusal from the database is shown in its own words, and the page is not told', async () => {
    const { asks, onAdded } = setup({ refuse: 'This task already has a map. Open it and add to it.' })
    fireEvent.click(screen.getByRole('button', { name: '🗺 Map' }))
    fireEvent.click(screen.getByRole('button', { name: /Draw it by hand/ }))
    asks[0]!.closed()
    await screen.findByText('This task already has a map. Open it and add to it.')
    expect(onAdded).not.toHaveBeenCalled()
  })

  it('with no painting window to open, the sheet stays and says so', () => {
    setup({ opens: false })
    fireEvent.click(screen.getByRole('button', { name: '🗺 Map' }))
    fireEvent.click(screen.getByRole('button', { name: /Draw it by hand/ }))
    expect(screen.getByRole('dialog', { name: 'A map for this task' }).textContent).toContain('The map window could not open here.')
  })
})
