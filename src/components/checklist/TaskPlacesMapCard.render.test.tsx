// @vitest-environment jsdom
/**
 * Where my tasks are (punch list #328, PR 4): the map at the top of Today. Numbered dots for the
 * tasks that have a place, one dot for tasks that share a place, the tasks with no place counted and
 * never hidden, no map at all when no task has a place, a fold the device remembers, and one press
 * that asks the phone where it is.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { TaskPlace } from '../../lib/tasks/taskPlace'
import { TASK_PLACE_LATE_COLOR, TASK_PLACE_RING_COLOR, TASK_PLACE_WORK_COLOR } from '../../lib/tasks/taskPlaceColors'

vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => true }))
const phone = vi.hoisted(() => ({ asked: 0, why: null as null | 'refused' | 'none' | 'failed', fix: { lat: 29.5, lng: -98.3, accuracyM: 9 }, held: null as null | (() => void), hold: false }))
vi.mock('../../lib/materials/myLocation', () => ({
  requestMyFix: (onOk: (p: unknown) => void, onFail: (w: string) => void) => {
    phone.asked += 1
    const answer = () => {
      if (phone.why) onFail(phone.why)
      else onOk({ ...phone.fix })
    }
    // A case may hold the phone's answer back, to see the press while it waits.
    if (phone.hold) phone.held = answer
    else answer()
  },
}))
/** Which phone the page takes itself to be on, for the Precise Location line's words (#402). */
vi.mock('../../hooks/usePreciseLocation', () => ({ usePhoneKind: () => 'iphone-safari' }))
const opened = vi.hoisted(() => [] as string[])
// Time (punch list #395): the photo archive's walk, answered here with today's photograph and one older.
const walked = vi.hoisted(() => [] as Array<[number, number]>)
vi.mock('../../lib/map/olderPhotosIo', () => ({
  walkOlderPhotos: async (spot: { lat: number; lng: number }, opts: { onChange: (found: unknown[]) => void }) => {
    walked.push([spot.lat, spot.lng])
    const found = [
      { release: 900, publishedYmd: '2026-10-29', size: 5, takenYmd: '2025-02-09' },
      { release: 700, publishedYmd: '2022-03-01', size: 3, takenYmd: '2021-03-20' },
    ]
    opts.onChange(found)
    return found
  },
}))
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (url: string) => opened.push(url) }))
/** The canvas, stood in for: each dot is a button that reads its label and its colour, and the view is named. */
vi.mock('../map/PinsMapImageryCanvas', () => ({
  default: function CanvasStub(props: { pins: Array<{ id: string; label?: string; title: string; color: string; ringColor?: string }>; onSelect: (id: string | null) => void; height: number; layer: string; imagery?: { url: string } | null; fitPoints?: Array<{ lat: number; lng: number }> | null }) {
    return (
      <div data-testid="canvas" data-height={props.height} data-imagery={props.imagery?.url ?? ''} data-fit={props.fitPoints ? props.fitPoints.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join(' ') : ''}>
        {props.pins.map((p) => (
          <button key={p.id} type="button" data-color={p.color} data-ring={p.ringColor ?? ''} onClick={() => props.onSelect(p.id)}>
            {`dot ${p.label ?? p.title}`}
          </button>
        ))}
        {props.layer === 'satellite' ? <span data-testid="from-above" /> : null}
      </div>
    )
  },
}))

/** Google's canvas, stood in for the same way (v2.8032). */
vi.mock('../map/PinsMapGoogleCanvas', () => ({
  default: function GoogleCanvasStub(props: { pins: Array<{ id: string; label?: string; title: string; color: string }>; onSelect: (id: string | null) => void; mapTypeId?: string; zoomAtTopLeft?: boolean }) {
    return (
      <div data-testid="google-canvas" data-map-type={props.mapTypeId} data-zoom-top-left={props.zoomAtTopLeft ? 'yes' : 'no'}>
        {props.pins.map((p) => (
          <button key={p.id} type="button" data-color={p.color} onClick={() => props.onSelect(p.id)}>
            {`dot ${p.label ?? p.title}`}
          </button>
        ))}
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

// With no browser key the map is the Leaflet canvas, as on a build without one. The cases at the foot set a key.
beforeEach(() => {
  vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', '')
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.unstubAllEnvs()
  phone.asked = 0
  phone.why = null
  phone.hold = false
  phone.held = null
  phone.fix = { lat: 29.5, lng: -98.3, accuracyM: 9 }
  opened.length = 0
  walked.length = 0
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
    // Work is the app's safety orange, and red means late (v2.8045). Every dot wears a white ring.
    expect(dots[0]!.getAttribute('data-color')).toBe(TASK_PLACE_LATE_COLOR)
    expect(dots[1]!.getAttribute('data-color')).toBe(TASK_PLACE_WORK_COLOR)
    expect(dots.map((d) => d.getAttribute('data-ring'))).toEqual([TASK_PLACE_RING_COLOR, TASK_PLACE_RING_COLOR])
    expect(document.querySelector('[data-task-places-without]')?.textContent).toBe('2 more tasks have no place. They are in the list below.')
    expect(phone.asked).toBe(0)
  })

  it('an older task that is not late draws in the work colour, as a task due today does, and its number in the bar matches', async () => {
    render(<TaskPlacesMapCard tasks={[{ id: 'old', title: 'Grease the pump bearings', place: place('Pump house', 29.55), old: true }, { id: 'late', title: 'Fix the latch', place: place('North gate', 29.556), overdue: true }]} onShowTask={() => {}} />)
    const canvas = await screen.findByTestId('canvas')
    expect([...canvas.querySelectorAll('button')].map((d) => d.getAttribute('data-color'))).toEqual([TASK_PLACE_WORK_COLOR, TASK_PLACE_LATE_COLOR])
    const rgb = (hex: string) => `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`
    fireEvent.click(screen.getByRole('button', { name: 'dot 1' }))
    expect((document.querySelector('[data-task-places-selected] span[aria-hidden]') as HTMLElement).style.background).toBe(rgb(TASK_PLACE_WORK_COLOR))
    fireEvent.click(screen.getByRole('button', { name: 'dot 2' }))
    expect((document.querySelector('[data-task-places-selected] span[aria-hidden]') as HTMLElement).style.background).toBe(rgb(TASK_PLACE_LATE_COLOR))
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

  it('Time looks at a task’s place and never at the person’s own dot (punch list #395)', async () => {
    // One place and the person's dot: two dots on the map, and still one place for Time.
    render(<TaskPlacesMapCard tasks={[TASKS[1]!]} onShowTask={() => {}} />)
    const canvas = await screen.findByTestId('canvas')
    fireEvent.click(screen.getByRole('button', { name: 'Show where I am' }))
    expect(await screen.findByRole('button', { name: 'dot You' })).toBeTruthy()
    fireEvent.click(document.querySelector('[data-map-time-press]') as HTMLButtonElement)
    await waitFor(() => expect(document.querySelector('[data-map-time-caption]')?.textContent).toBe('Today’s photo of Pump house, taken February 9, 2025. 1 older photo.'))
    expect(walked).toEqual([[29.55, -98.3]])
    expect(canvas.getAttribute('data-fit')).toBe('29.5495,-98.3005 29.5505,-98.2995')
    // A press on the person's dot opens nothing, and Time stays on the place.
    fireEvent.click(screen.getByRole('button', { name: 'dot You' }))
    expect(walked).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Mar 2021' }))
    expect(canvas.getAttribute('data-imagery')).toContain('/tile/700/')
    expect(document.querySelector('[data-map-time-caption]')?.textContent).toBe('Photo taken March 20, 2021. The dots are today’s.')
    // The person's own press is still on the map.
    expect(screen.getByRole('button', { name: 'Find me again' })).toBeTruthy()
  })

  it('with several places and none open, Time asks for a dot', async () => {
    render(<TaskPlacesMapCard tasks={[TASKS[0]!, { id: 'far', title: 'Pick up the trailer', place: place('Yard', 29.9) }]} onShowTask={() => {}} />)
    await screen.findByTestId('canvas')
    fireEvent.click(document.querySelector('[data-map-time-press]') as HTMLButtonElement)
    expect(document.querySelector('[data-map-time-caption]')?.textContent).toBe('Press a dot to pick the spot.')
    expect(walked).toEqual([])
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

  it('a rough reading puts no dot on the map and no distance on the list, and shows the way to the switch (#402)', async () => {
    phone.fix = { lat: 29.9, lng: -98.9, accuracyM: 3200 }
    const onMe = vi.fn()
    render(<TaskPlacesMapCard tasks={TASKS} onShowTask={() => {}} onMe={onMe} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Show where I am' }))
    const alert = await screen.findByRole('alert')
    expect(alert.querySelector('b')?.textContent).toBe('Precise Location looks off.')
    expect(alert.querySelector('[data-precise-note]')?.textContent).toBe('How far cannot be told from a reading that wide.')
    expect(alert.querySelectorAll('ol[data-precise-steps] li')).toHaveLength(5)
    expect(onMe).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'dot You' })).toBeNull()
    expect(document.querySelector('[data-task-places-me]')).toBeNull()
    // The press is still Show where I am, and a sure reading then does what it always did.
    phone.fix = { lat: 29.5, lng: -98.3, accuracyM: 9 }
    fireEvent.click(screen.getByRole('button', { name: 'Show where I am' }))
    await waitFor(() => expect(onMe).toHaveBeenCalledWith({ lat: 29.5, lng: -98.3, accuracyM: 9 }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('button', { name: 'dot You' })).toBeTruthy()
  })

  it('a rough answer to Find me again keeps the dot the last sure reading drew (#402)', async () => {
    const onMe = vi.fn()
    render(<TaskPlacesMapCard tasks={TASKS} onShowTask={() => {}} onMe={onMe} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Show where I am' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'dot You' })).toBeTruthy())
    phone.fix = { lat: 29.9, lng: -98.9, accuracyM: 3200 }
    fireEvent.click(screen.getByRole('button', { name: 'Find me again' }))
    await screen.findByRole('alert')
    expect(screen.getByRole('button', { name: 'dot You' })).toBeTruthy()
    expect(onMe).toHaveBeenCalledTimes(1)
    // The line about the dot gives way to the words about the reading.
    expect(document.querySelector('[data-task-places-me]')).toBeNull()
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

describe('TaskPlacesMapCard on Google Maps (v2.8032)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', 'test-key')
  })

  it('draws on Google with a key: the same numbered dots, the photograph with street names, and the zoom buttons at the top left', async () => {
    render(<TaskPlacesMapCard tasks={TASKS} onShowTask={() => {}} />)
    const google = await screen.findByTestId('google-canvas')
    expect(screen.queryByTestId('canvas')).toBeNull()
    expect(google.getAttribute('data-map-type')).toBe('hybrid')
    expect(google.getAttribute('data-zoom-top-left')).toBe('yes')
    expect([...google.querySelectorAll('button')].map((d) => d.textContent)).toEqual(['dot 1', 'dot 2+'])
    fireEvent.click(screen.getByRole('button', { name: 'Streets' }))
    expect(google.getAttribute('data-map-type')).toBe('roadmap')
    // A dot opens its tasks under the map, as on the other map.
    fireEvent.click(screen.getByRole('button', { name: 'dot 2+' }))
    expect(document.querySelector('[data-task-places-selected]')?.textContent).toContain('Pump house')
  })

  it('one press goes to the OpenStreetMap map, the device remembers, and one press comes back', async () => {
    const view = render(<TaskPlacesMapCard tasks={TASKS} onShowTask={() => {}} />)
    await screen.findByTestId('google-canvas')
    fireEvent.click(screen.getByRole('button', { name: 'Switch to the OpenStreetMap map' }))
    const canvas = await screen.findByTestId('canvas')
    expect([...canvas.querySelectorAll('button')].map((d) => d.textContent)).toEqual(['dot 1', 'dot 2+'])
    expect(localStorage.getItem('task_places_map_provider')).toBe('osm')
    view.unmount()
    render(<TaskPlacesMapCard tasks={TASKS} onShowTask={() => {}} />)
    expect(await screen.findByTestId('canvas')).toBeTruthy()
    expect(screen.queryByTestId('google-canvas')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Google Maps' }))
    expect(await screen.findByTestId('google-canvas')).toBeTruthy()
    expect(localStorage.getItem('task_places_map_provider')).toBe('google')
  })

  it('Show where I am puts the person’s dot on Google, with the distance handed to the list and the line about the dot', async () => {
    const onMe = vi.fn()
    render(<TaskPlacesMapCard tasks={TASKS} onShowTask={() => {}} onMe={onMe} />)
    const google = await screen.findByTestId('google-canvas')
    fireEvent.click(screen.getByRole('button', { name: 'Show where I am' }))
    await waitFor(() => expect(onMe).toHaveBeenCalledWith({ lat: 29.5, lng: -98.3, accuracyM: 9 }))
    expect([...google.querySelectorAll('button')].map((d) => d.textContent)).toEqual(['dot 1', 'dot 2+', 'dot You'])
    expect(document.querySelector('[data-task-places-me]')?.textContent).toBe('The dark dot is you. Your location stays on this phone.')
    // The dot stays through a change of map.
    fireEvent.click(screen.getByRole('button', { name: 'Switch to the OpenStreetMap map' }))
    expect(await screen.findByRole('button', { name: 'dot You' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Find me again' })).toBeTruthy()
  })

  it('a rough reading on Google shows the way to the Precise Location switch and puts no dot on the map (#402)', async () => {
    phone.fix = { lat: 29.9, lng: -98.9, accuracyM: 3200 }
    render(<TaskPlacesMapCard tasks={TASKS} onShowTask={() => {}} />)
    await screen.findByTestId('google-canvas')
    fireEvent.click(screen.getByRole('button', { name: 'Show where I am' }))
    const alert = await screen.findByRole('alert')
    expect(alert.querySelector('b')?.textContent).toBe('Precise Location looks off.')
    expect(screen.queryByRole('button', { name: 'dot You' })).toBeNull()
  })

  it('Time takes Google’s map down for the archive, looks at the task’s place, and gives Google’s map back', async () => {
    render(<TaskPlacesMapCard tasks={[TASKS[1]!]} onShowTask={() => {}} />)
    await screen.findByTestId('google-canvas')
    fireEvent.click(screen.getByRole('button', { name: 'Show where I am' }))
    expect(await screen.findByRole('button', { name: 'dot You' })).toBeTruthy()
    fireEvent.click(document.querySelector('[data-map-time-press]') as HTMLButtonElement)
    const canvas = await screen.findByTestId('canvas')
    expect(screen.queryByTestId('google-canvas')).toBeNull()
    await waitFor(() => expect(document.querySelector('[data-map-time-caption]')?.textContent).toBe('Today’s photo of Pump house, taken February 9, 2025. 1 older photo.'))
    expect(walked).toEqual([[29.55, -98.3]])
    expect(canvas.getAttribute('data-fit')).toBe('29.5495,-98.3005 29.5505,-98.2995')
    // The switch waits while Time is on, and the person's own press does not.
    expect(document.querySelector('[data-map-provider-switch]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Find me again' })).toBeTruthy()
    fireEvent.click(document.querySelector('[data-map-time-press]') as HTMLButtonElement)
    expect(await screen.findByTestId('google-canvas')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Switch to the OpenStreetMap map' })).toBeTruthy()
  })
})

describe('the Show where I am press, an icon since v2.8032', () => {
  it('carries no words on the map: its name and its title say what a press does, at each step', async () => {
    phone.hold = true
    render(<TaskPlacesMapCard tasks={TASKS} onShowTask={() => {}} />)
    await screen.findByTestId('canvas')
    const press = document.querySelector('[data-task-places-where-i-am]') as HTMLButtonElement
    expect(press.textContent).toBe('')
    expect(press.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(press.getAttribute('aria-label')).toBe('Show where I am')
    expect(press.getAttribute('title')).toBe('Show where I am')
    expect(press.getAttribute('data-task-places-where-i-am')).toBe('idle')
    // Waiting on the phone: the press says so, turns, and takes no second press.
    fireEvent.click(press)
    expect(press.getAttribute('aria-label')).toBe('Finding you…')
    expect(press.getAttribute('title')).toBe('Finding you…')
    expect(press.getAttribute('aria-busy')).toBe('true')
    expect(press.disabled).toBe(true)
    expect(press.querySelector('svg')?.getAttribute('class')).toContain('mapCornerPressSpin')
    fireEvent.click(press)
    expect(phone.asked).toBe(1)
    // Found: the press offers to find the person again.
    act(() => phone.held?.())
    expect(press.getAttribute('aria-label')).toBe('Find me again')
    expect(press.getAttribute('data-task-places-where-i-am')).toBe('found')
    expect(press.getAttribute('aria-busy')).toBe('false')
    expect(press.disabled).toBe(false)
  })

  it('sits at the bottom left of the map, a finger wide, across from the switch', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', 'test-key')
    render(<TaskPlacesMapCard tasks={TASKS} onShowTask={() => {}} />)
    await screen.findByTestId('google-canvas')
    const press = document.querySelector('[data-task-places-where-i-am]') as HTMLButtonElement
    const other = document.querySelector('[data-map-provider-switch]') as HTMLButtonElement
    expect([press.style.left, press.style.bottom, press.style.width, press.style.height]).toEqual(['10px', '40px', '40px', '40px'])
    expect([other.style.right, other.style.bottom, other.style.width, other.style.height]).toEqual(['10px', '40px', '40px', '40px'])
    expect(press.style.top).toBe('')
  })
})

