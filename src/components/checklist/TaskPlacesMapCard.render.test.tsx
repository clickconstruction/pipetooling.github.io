// @vitest-environment jsdom
/**
 * Where my tasks are (punch list #328, PR 4): the map at the top of Today. Numbered dots for the
 * tasks that have a place, one dot for tasks that share a place, the tasks with no place counted and
 * never hidden, no map at all when no task has a place, a fold the device remembers, and one press
 * that asks the phone where it is.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { TaskPlace } from '../../lib/tasks/taskPlace'

vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => true }))
const phone = vi.hoisted(() => ({ asked: 0, why: null as null | 'refused' | 'none' | 'failed' }))
vi.mock('../../lib/materials/myLocation', () => ({
  requestMyFix: (onOk: (p: unknown) => void, onFail: (w: string) => void) => {
    phone.asked += 1
    if (phone.why) onFail(phone.why)
    else onOk({ lat: 29.5, lng: -98.3, accuracyM: 9 })
  },
}))
const opened = vi.hoisted(() => [] as string[])
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (url: string) => opened.push(url) }))
/** The canvas, stood in for: each dot is a button that reads its label and its colour, and the view is named. */
vi.mock('./TaskPlacesMapCanvas', () => ({
  default: function CanvasStub(props: { pins: Array<{ id: string; label?: string; title: string; color: string }>; onSelect: (id: string | null) => void; height: number; layer: string }) {
    return (
      <div data-testid="canvas" data-height={props.height}>
        {props.pins.map((p) => (
          <button key={p.id} type="button" data-color={p.color} onClick={() => props.onSelect(p.id)}>
            {`dot ${p.label ?? p.title}`}
          </button>
        ))}
        {props.layer === 'satellite' ? <span data-testid="from-above" /> : null}
      </div>
    )
  },
}))

import { TaskPlacesMapCard, type TaskPlacesMapTask } from './TaskPlacesMapCard'

const place = (name: string, lat: number, lng = -98.3): TaskPlace => ({ name, lat, lng, accuracyM: null, setBy: null, setAt: null })
const TASKS: TaskPlacesMapTask[] = [
  { id: 'gate', title: 'Fix the latch on the north gate', place: place('North gate', 29.556), overdue: true },
  { id: 'grease', title: 'Grease the pump bearings', place: place('Pump house', 29.55) },
  { id: 'clamps', title: 'Order hose clamps', place: null },
  { id: 'valve', title: 'Swap the pump valve', place: place('Pump house', 29.55) },
  { id: 'call', title: 'Call the feed store', place: null },
]

afterEach(() => {
  cleanup()
  localStorage.clear()
  phone.asked = 0
  phone.why = null
  opened.length = 0
})

describe('TaskPlacesMapCard', () => {
  it('draws nothing at all when no task has a place', () => {
    render(<TaskPlacesMapCard tasks={[{ id: 'a', title: 'Order hose clamps', place: null }]} onShowTask={() => {}} />)
    expect(document.querySelector('[data-task-places-map]')).toBeNull()
  })

  it('a dot a place, numbered as the list is, red when overdue, and the tasks with no place counted under it', async () => {
    render(<TaskPlacesMapCard tasks={TASKS} onShowTask={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Where my tasks are' })).toBeTruthy()
    const canvas = await screen.findByTestId('canvas')
    expect(canvas.getAttribute('data-height')).toBe('220')
    const dots = [...canvas.querySelectorAll('button')]
    expect(dots.map((d) => d.textContent)).toEqual(['dot 1', 'dot 2+'])
    expect(dots[0]!.getAttribute('data-color')).toBe('#dc2626')
    expect(dots[1]!.getAttribute('data-color')).toBe('#2563eb')
    expect(document.querySelector('[data-task-places-without]')?.textContent).toBe('2 more tasks have no place. They are in the list below.')
    expect(phone.asked).toBe(0)
  })

  it('a press on a dot lists every task at that place, with Show the task on each and Directions once', async () => {
    const onShowTask = vi.fn()
    render(<TaskPlacesMapCard tasks={TASKS} onShowTask={onShowTask} />)
    fireEvent.click(await screen.findByRole('button', { name: 'dot 2+' }))
    const bar = document.querySelector('[data-task-places-selected]') as HTMLElement
    expect(bar.textContent).toContain('Pump house')
    expect(bar.textContent).toContain('2Grease the pump bearings')
    expect(bar.textContent).toContain('3Swap the pump valve')
    const shows = screen.getAllByRole('button', { name: 'Show the task' })
    expect(shows).toHaveLength(2)
    fireEvent.click(shows[1]!)
    expect(onShowTask).toHaveBeenCalledWith('valve')
    fireEvent.click(screen.getByRole('button', { name: 'Directions' }))
    expect(opened).toEqual(['https://www.google.com/maps/dir/?api=1&destination=29.550000,-98.300000'])
  })

  it('Hide map folds it to one line, and the device remembers', async () => {
    const r = render(<TaskPlacesMapCard tasks={TASKS} onShowTask={() => {}} />)
    await screen.findByTestId('canvas')
    fireEvent.click(screen.getByRole('button', { name: 'Hide map' }))
    expect(screen.queryByTestId('canvas')).toBeNull()
    expect(document.querySelector('[data-task-places-map]')?.textContent).toBe('Where my tasks are2 placesShow map')
    r.unmount()
    render(<TaskPlacesMapCard tasks={TASKS} onShowTask={() => {}} />)
    expect(screen.queryByTestId('canvas')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show map' }))
    expect(await screen.findByTestId('canvas')).toBeTruthy()
  })

  it('opens from above while the dots sit on one property, and Streets is one press', async () => {
    render(<TaskPlacesMapCard tasks={TASKS} onShowTask={() => {}} />)
    expect(await screen.findByTestId('from-above')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Satellite' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Streets' }))
    expect(screen.queryByTestId('from-above')).toBeNull()
  })

  it('opens on streets when the tasks are spread across town', async () => {
    render(<TaskPlacesMapCard tasks={[TASKS[0]!, { id: 'far', title: 'Pick up the trailer', place: place('Yard', 29.9) }]} onShowTask={() => {}} />)
    await screen.findByTestId('canvas')
    expect(screen.queryByTestId('from-above')).toBeNull()
    expect(screen.getByRole('button', { name: 'Streets' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('Show where I am asks once, hands the reading to the list, adds a dot for the person and says where the reading goes', async () => {
    const onMe = vi.fn()
    render(<TaskPlacesMapCard tasks={TASKS} onShowTask={() => {}} onMe={onMe} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Show where I am' }))
    await waitFor(() => expect(onMe).toHaveBeenCalledWith({ lat: 29.5, lng: -98.3, accuracyM: 9 }))
    expect(phone.asked).toBe(1)
    expect(screen.getByRole('button', { name: 'dot You' })).toBeTruthy()
    expect(document.querySelector('[data-task-places-me]')?.textContent).toBe('The dark dot is you. Your location stays on this phone.')
    // The person's own dot is not a place: a press on it selects nothing.
    fireEvent.click(screen.getByRole('button', { name: 'dot You' }))
    expect(document.querySelector('[data-task-places-selected]')).toBeNull()
  })

  it('a refusal says the map still works, and the list is told nothing', async () => {
    phone.why = 'refused'
    const onMe = vi.fn()
    render(<TaskPlacesMapCard tasks={TASKS} onShowTask={() => {}} onMe={onMe} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Show where I am' }))
    await waitFor(() => expect(document.querySelector('[data-task-places-no-fix]')?.textContent).toContain('Location is off for this app. The map and Directions still work.'))
    expect(onMe).not.toHaveBeenCalled()
    expect(await screen.findByTestId('canvas')).toBeTruthy()
  })
})
