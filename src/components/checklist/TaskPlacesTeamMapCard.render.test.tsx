// @vitest-environment jsdom
/**
 * Where the open tasks are (punch list #328, PR 7): the leader's map over Outstanding by person. A
 * colour a person, a press on a name shows that person alone, a dot several people share wears its
 * count, the tasks with no place are counted, and no phone is asked for anything.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TASK_PLACE_PERSON_COLORS, TASK_PLACE_SHARED_COLOR, type TaskPlace } from '../../lib/tasks/taskPlace'

vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }))
const opened = vi.hoisted(() => [] as string[])
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (url: string) => opened.push(url) }))
const asked = vi.hoisted(() => ({ n: 0 }))
vi.mock('../../lib/materials/myLocation', () => ({ requestMyFix: () => { asked.n += 1 }, requestMyLocation: () => { asked.n += 1 } }))
vi.mock('./TaskPlacesMapCanvas', () => ({
  default: function CanvasStub(props: { pins: Array<{ id: string; label?: string; title: string; color: string }>; onSelect: (id: string | null) => void; height: number }) {
    return (
      <div data-testid="canvas" data-height={props.height}>
        {props.pins.map((p) => (
          <button key={p.id} type="button" data-color={p.color} onClick={() => props.onSelect(p.id)}>
            {`dot ${p.title}${p.label ? ` ×${p.label}` : ''}`}
          </button>
        ))}
      </div>
    )
  },
}))

// The Google canvas (v2.7686): the same dots, plus the map type the card asks for and a press that fails it.
vi.mock('../map/PinsMapGoogleCanvas', () => ({
  default: function GoogleCanvasStub(props: { apiKey: string; mapTypeId?: string; onUnavailable: (reason: string) => void; pins: Array<{ id: string; label?: string; title: string; color: string }>; onSelect: (id: string | null) => void; scrollZoomAfterClick?: boolean }) {
    return (
      <div data-testid="google-canvas" data-key={props.apiKey} data-map-type={props.mapTypeId} data-scroll-gate={String(props.scrollZoomAfterClick ?? false)}>
        {props.pins.map((p) => (
          <button key={p.id} type="button" data-color={p.color} onClick={() => props.onSelect(p.id)}>
            {`dot ${p.title}${p.label ? ` ×${p.label}` : ''}`}
          </button>
        ))}
        <button type="button" onClick={() => props.onUnavailable('auth: test')}>fail google</button>
      </div>
    )
  },
}))

import { TaskPlacesTeamMapCard, type TaskPlacesTeamPerson } from './TaskPlacesTeamMapCard'

const place = (name: string, lat: number): TaskPlace => ({ name, lat, lng: -98.3, accuracyM: null, setBy: null, setAt: null })
const PEOPLE: TaskPlacesTeamPerson[] = [
  { userId: 'theo', name: 'Theo', tasks: [{ id: 'a', title: 'Grease the pump bearings', place: place('Pump house', 29.55) }, { id: 'b', title: 'Fix the latch', place: place('North gate', 29.556) }, { id: 'c', title: 'Order hose clamps', place: null }] },
  { userId: 'wes', name: 'Wes', tasks: [{ id: 'd', title: 'Call the feed store', place: null }] },
  { userId: 'imani', name: 'Imani', tasks: [{ id: 'e', title: 'Swap the pump valve', place: place('Pump house', 29.55) }] },
]

beforeEach(() => {
  vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', '')
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  opened.length = 0
  asked.n = 0
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('TaskPlacesTeamMapCard', () => {
  it('draws nothing when no open task has a place', () => {
    render(<TaskPlacesTeamMapCard people={[{ userId: 'wes', name: 'Wes', tasks: [{ id: 'd', title: 'Call the feed store', place: null }] }]} />)
    expect(document.querySelector('[data-task-places-team-map]')).toBeNull()
  })

  it('a colour a person, a navy dot with its count where people share a place, and the rest counted', async () => {
    render(<TaskPlacesTeamMapCard people={PEOPLE} />)
    expect(screen.getByRole('heading', { name: 'Where the open tasks are' })).toBeTruthy()
    // Only the people with a place on some task get a chip. Wes has none.
    expect(screen.getAllByRole('button', { pressed: false }).map((b) => b.textContent).filter((t) => /·/.test(t ?? ''))).toEqual(['Theo · 2', 'Imani · 1'])
    expect(screen.getByRole('button', { name: 'Everyone · 3' }).getAttribute('aria-pressed')).toBe('true')
    const canvas = await screen.findByTestId('canvas')
    expect(canvas.getAttribute('data-height')).toBe('300')
    const dots = [...canvas.querySelectorAll('button')]
    expect(dots.map((d) => [d.textContent, d.getAttribute('data-color')])).toEqual([
      ['dot Pump house ×2', TASK_PLACE_SHARED_COLOR],
      ['dot North gate', TASK_PLACE_PERSON_COLORS[0]],
    ])
    expect(document.querySelector('[data-task-places-team-without]')?.textContent).toBe('2 more open tasks have no place.')
    expect(asked.n).toBe(0)
  })

  it('a press on a name shows that person alone, in their colour, and a second press brings everyone back', async () => {
    render(<TaskPlacesTeamMapCard people={PEOPLE} />)
    fireEvent.click(screen.getByRole('button', { name: 'Imani · 1' }))
    const canvas = await screen.findByTestId('canvas')
    expect([...canvas.querySelectorAll('button')].map((d) => [d.textContent, d.getAttribute('data-color')])).toEqual([['dot Pump house', TASK_PLACE_PERSON_COLORS[1]]])
    expect(document.querySelector('[data-task-places-team-without]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Imani · 1' }))
    expect(canvas.querySelectorAll('button')).toHaveLength(2)
  })

  it('a press on a dot names the place, who has what there, and the way', async () => {
    render(<TaskPlacesTeamMapCard people={PEOPLE} />)
    fireEvent.click(await screen.findByRole('button', { name: 'dot Pump house ×2' }))
    const bar = document.querySelector('[data-task-places-team-selected]') as HTMLElement
    expect(bar.textContent).toContain('Pump house')
    expect(bar.textContent).toContain('TheoGrease the pump bearings')
    expect(bar.textContent).toContain('ImaniSwap the pump valve')
    fireEvent.click(screen.getByRole('button', { name: 'Directions' }))
    expect(opened).toEqual(['https://www.google.com/maps/dir/?api=1&destination=29.550000,-98.300000'])
  })

  it('with no Google key the card draws on the Leaflet canvas, as before', async () => {
    render(<TaskPlacesTeamMapCard people={PEOPLE} />)
    await screen.findByTestId('canvas')
    expect(screen.queryByTestId('google-canvas')).toBeNull()
    expect(document.querySelector('[data-map-provider]')?.getAttribute('data-map-provider')).toBe('osm')
  })

  describe('on Google Maps (v2.7686)', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', 'test-key')
    })

    it('draws the same dots on the Google canvas, and keeps the wheel for the page until the map is pressed', async () => {
      render(<TaskPlacesTeamMapCard people={PEOPLE} />)
      const canvas = await screen.findByTestId('google-canvas')
      expect(screen.queryByTestId('canvas')).toBeNull()
      expect(canvas.getAttribute('data-key')).toBe('test-key')
      expect(canvas.getAttribute('data-scroll-gate')).toBe('true')
      expect([...canvas.querySelectorAll('button[data-color]')].map((d) => [d.textContent, d.getAttribute('data-color')])).toEqual([
        ['dot Pump house ×2', TASK_PLACE_SHARED_COLOR],
        ['dot North gate', TASK_PLACE_PERSON_COLORS[0]],
      ])
      expect(document.querySelector('[data-task-places-team-without]')?.textContent).toBe('2 more open tasks have no place.')
    })

    it('Satellite is Google\'s photograph with street names and Streets its road map', async () => {
      render(<TaskPlacesTeamMapCard people={PEOPLE} />)
      const canvas = await screen.findByTestId('google-canvas')
      // The two places sit close together, so the card opens on the view from above.
      expect(screen.getByRole('button', { name: 'Satellite' }).getAttribute('aria-pressed')).toBe('true')
      expect(canvas.getAttribute('data-map-type')).toBe('hybrid')
      fireEvent.click(screen.getByRole('button', { name: 'Streets' }))
      expect(canvas.getAttribute('data-map-type')).toBe('roadmap')
      fireEvent.click(screen.getByRole('button', { name: 'Satellite' }))
      expect(canvas.getAttribute('data-map-type')).toBe('hybrid')
    })

    it('a name, a dot and Hide map work as they do on the other canvas', async () => {
      render(<TaskPlacesTeamMapCard people={PEOPLE} />)
      const canvas = await screen.findByTestId('google-canvas')
      fireEvent.click(screen.getByRole('button', { name: 'Imani · 1' }))
      expect([...canvas.querySelectorAll('button[data-color]')].map((d) => d.textContent)).toEqual(['dot Pump house'])
      fireEvent.click(screen.getByRole('button', { name: 'Everyone · 3' }))
      fireEvent.click(screen.getByRole('button', { name: 'dot Pump house ×2' }))
      expect(document.querySelector('[data-task-places-team-selected]')?.textContent).toContain('ImaniSwap the pump valve')
      fireEvent.click(screen.getByRole('button', { name: 'Hide map' }))
      expect(screen.queryByTestId('google-canvas')).toBeNull()
    })

    it('when Google fails on this page the card falls back to the Leaflet canvas and keeps the view', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      render(<TaskPlacesTeamMapCard people={PEOPLE} />)
      await screen.findByTestId('google-canvas')
      fireEvent.click(screen.getByRole('button', { name: 'Streets' }))
      fireEvent.click(screen.getByRole('button', { name: 'fail google' }))
      const canvas = await screen.findByTestId('canvas')
      expect(screen.queryByTestId('google-canvas')).toBeNull()
      expect(canvas.querySelectorAll('button')).toHaveLength(2)
      expect(screen.getByRole('button', { name: 'Streets' }).getAttribute('aria-pressed')).toBe('true')
      expect(warn).toHaveBeenCalledTimes(1)
    })
  })

  it('Hide map folds it to one line and the device remembers', async () => {
    const r = render(<TaskPlacesTeamMapCard people={PEOPLE} />)
    await screen.findByTestId('canvas')
    fireEvent.click(screen.getByRole('button', { name: 'Hide map' }))
    expect(screen.queryByTestId('canvas')).toBeNull()
    expect(document.querySelector('[data-task-places-team-map]')?.textContent).toBe('Where the open tasks are2 placesShow map')
    r.unmount()
    render(<TaskPlacesTeamMapCard people={PEOPLE} />)
    expect(screen.queryByTestId('canvas')).toBeNull()
  })
})
