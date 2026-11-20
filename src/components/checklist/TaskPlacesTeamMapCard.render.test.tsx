// @vitest-environment jsdom
/**
 * Where the open tasks are (punch list #328, PR 7): the leader's map over Outstanding by person.
 * Every dot is the work colour (v2.8045), one person's dot wears their initials, a press on a name
 * shows that person alone, a dot several people share wears its count, the tasks with no place are
 * counted, and no phone is asked for anything.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TASK_PLACE_RING_COLOR, TASK_PLACE_WORK_COLOR, type TaskPlace } from '../../lib/tasks/taskPlace'

vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }))
const opened = vi.hoisted(() => [] as string[])
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (url: string) => opened.push(url) }))
const asked = vi.hoisted(() => ({ n: 0 }))
vi.mock('../../lib/materials/myLocation', () => ({ requestMyFix: () => { asked.n += 1 }, requestMyLocation: () => { asked.n += 1 } }))
vi.mock('../map/PinsMapImageryCanvas', () => ({
  default: function CanvasStub(props: { pins: Array<{ id: string; label?: string; title: string; color: string; ringColor?: string }>; onSelect: (id: string | null) => void; height: number; layer: string; imagery?: { url: string } | null; fitPoints?: Array<{ lat: number; lng: number }> | null; fitMaxZoom?: number }) {
    return (
      <div data-testid="canvas" data-height={props.height} data-layer={props.layer} data-imagery={props.imagery?.url ?? ''} data-fit={props.fitPoints ? props.fitPoints.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join(' ') : ''} data-fit-max={props.fitMaxZoom ?? ''}>
        {props.pins.map((p) => (
          <button key={p.id} type="button" data-color={p.color} data-ring={p.ringColor ?? ''} onClick={() => props.onSelect(p.id)}>
            {`dot ${p.title}${p.label ? ` ×${p.label}` : ''}`}
          </button>
        ))}
      </div>
    )
  },
}))

// The Google canvas (v2.7686): the same dots, plus the map type the card asks for and a press that fails it.
vi.mock('../map/PinsMapGoogleCanvas', () => ({
  default: function GoogleCanvasStub(props: { apiKey: string; mapTypeId?: string; onUnavailable: (reason: string) => void; pins: Array<{ id: string; label?: string; title: string; color: string; ringColor?: string }>; onSelect: (id: string | null) => void; scrollZoomAfterClick?: boolean }) {
    return (
      <div data-testid="google-canvas" data-key={props.apiKey} data-map-type={props.mapTypeId} data-scroll-gate={String(props.scrollZoomAfterClick ?? false)}>
        {props.pins.map((p) => (
          <button key={p.id} type="button" data-color={p.color} data-ring={p.ringColor ?? ''} onClick={() => props.onSelect(p.id)}>
            {`dot ${p.title}${p.label ? ` ×${p.label}` : ''}`}
          </button>
        ))}
        <button type="button" onClick={() => props.onUnavailable('auth: test')}>fail google</button>
      </div>
    )
  },
}))

// Time (punch list #395): the archive's walk, answered here. The retry panel reads the sign-in, so it is stood in for.
const walk = vi.hoisted(() => ({ fn: null as null | ((spot: { lat: number; lng: number }, opts: { onChange: (found: unknown[]) => void; onWalked?: () => void; signal?: AbortSignal }) => Promise<unknown[]>), spots: [] as Array<{ lat: number; lng: number }> }))
vi.mock('../../lib/map/olderPhotosIo', () => ({
  walkOlderPhotos: (spot: { lat: number; lng: number }, opts: { onChange: (found: unknown[]) => void; onWalked?: () => void; signal?: AbortSignal }) => {
    walk.spots.push(spot)
    return walk.fn ? walk.fn(spot, opts) : Promise.resolve([])
  },
}))
vi.mock('../OfflineRetryPanel', () => ({
  default: (p: { failure: { message: string } | null; onRetry: () => void }) => (p.failure ? <div data-testid="retry-panel">{p.failure.message}<button type="button" onClick={() => p.onRetry()}>Retry</button></div> : null),
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
  walk.fn = null
  walk.spots.length = 0
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('TaskPlacesTeamMapCard', () => {
  it('draws nothing when no open task has a place', () => {
    render(<TaskPlacesTeamMapCard people={[{ userId: 'wes', name: 'Wes', tasks: [{ id: 'd', title: 'Call the feed store', place: null }] }]} />)
    expect(document.querySelector('[data-task-places-team-map]')).toBeNull()
  })

  it('every dot is the work colour with a white ring: initials on one person\'s dot, the count where people share a place, and the rest counted', async () => {
    render(<TaskPlacesTeamMapCard people={PEOPLE} />)
    expect(screen.getByRole('heading', { name: 'Where the open tasks are' })).toBeTruthy()
    // Only the people with a place on some task get a chip. Wes has none.
    // Each chip wears the person's mark, the initials their dots wear, in the dot's own colour.
    expect(screen.getAllByRole('button', { pressed: false }).map((b) => b.textContent).filter((t) => /·/.test(t ?? ''))).toEqual(['TTheo · 2', 'IImani · 1'])
    const marks = [...document.querySelectorAll('[role="group"][aria-label="Whose tasks"] [data-task-places-team-mark]')] as HTMLElement[]
    expect(marks.map((m) => [m.textContent, m.getAttribute('aria-hidden'), m.style.background, m.style.color])).toEqual([
      ['T', 'true', 'rgb(199, 80, 0)', 'rgb(255, 255, 255)'],
      ['I', 'true', 'rgb(199, 80, 0)', 'rgb(255, 255, 255)'],
    ])
    expect(screen.getByRole('button', { name: 'Everyone · 3' }).getAttribute('aria-pressed')).toBe('true')
    const canvas = await screen.findByTestId('canvas')
    expect(canvas.getAttribute('data-height')).toBe('300')
    const dots = [...canvas.querySelectorAll('button')]
    expect(dots.map((d) => [d.textContent, d.getAttribute('data-color'), d.getAttribute('data-ring')])).toEqual([
      ['dot Pump house ×2', TASK_PLACE_WORK_COLOR, TASK_PLACE_RING_COLOR],
      ['dot North gate ×T', TASK_PLACE_WORK_COLOR, TASK_PLACE_RING_COLOR],
    ])
    expect(document.querySelector('[data-task-places-team-without]')?.textContent).toBe('2 more open tasks have no place.')
    expect(asked.n).toBe(0)
  })

  it('a press on a name shows that person alone, their initials on the dot, and a second press brings everyone back', async () => {
    render(<TaskPlacesTeamMapCard people={PEOPLE} />)
    fireEvent.click(screen.getByRole('button', { name: 'Imani · 1' }))
    const canvas = await screen.findByTestId('canvas')
    expect([...canvas.querySelectorAll('button')].map((d) => [d.textContent, d.getAttribute('data-color')])).toEqual([['dot Pump house ×I', TASK_PLACE_WORK_COLOR]])
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
        ['dot Pump house ×2', TASK_PLACE_WORK_COLOR],
        ['dot North gate ×T', TASK_PLACE_WORK_COLOR],
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
      expect([...canvas.querySelectorAll('button[data-color]')].map((d) => d.textContent)).toEqual(['dot Pump house ×I'])
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

  describe('Time (punch list #395, which began here as Older photos, v2.7693)', () => {
    // Newest first, as the walk hands them over. The frame's own tests walk the row in full.
    const FOUND = [
      { release: 900, publishedYmd: '2026-10-29', size: 5, takenYmd: '2023-10-08' },
      { release: 700, publishedYmd: '2022-03-01', size: 3, takenYmd: '2021-03-20' },
      { release: 500, publishedYmd: '2018-01-10', size: 1, takenYmd: null },
    ]
    const WAYBACK = (release: number) => `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/${release}/{z}/{y}/{x}`
    const timePress = () => document.querySelector('[data-map-time-press]') as HTMLButtonElement
    const answers = async (_spot: unknown, opts: { onChange: (found: unknown[]) => void }) => {
      opts.onChange(FOUND)
      return FOUND
    }

    it('asks for a dot, then frames that place on the archive with a row of dates under the map', async () => {
      walk.fn = answers
      render(<TaskPlacesTeamMapCard people={PEOPLE} />)
      const canvas = await screen.findByTestId('canvas')
      expect(screen.queryByRole('button', { name: 'Older photos' })).toBeNull()
      fireEvent.click(timePress())
      expect(document.querySelector('[data-map-time-caption]')?.textContent).toBe('Press a dot to pick the spot.')
      expect(walk.spots).toEqual([])
      expect(canvas.getAttribute('data-fit')).toBe('')

      fireEvent.click(screen.getByRole('button', { name: 'dot North gate ×T' }))
      await waitFor(() => expect(document.querySelector('[data-map-time-caption]')?.textContent).toBe('Today’s photo of North gate, taken October 8, 2023. 2 older photos.'))
      expect(walk.spots.map((s) => [s.lat, s.lng])).toEqual([[29.556, -98.3]])
      expect(document.querySelector('[data-map-provider]')?.getAttribute('data-map-provider')).toBe('archive')
      expect(canvas.getAttribute('data-layer')).toBe('satellite')
      // Framed close around the spot, not at the canvas's two-kilometre box for one point.
      expect(canvas.getAttribute('data-fit')).toBe('29.5555,-98.3005 29.5565,-98.2995')
      expect(canvas.getAttribute('data-fit-max')).toBe('17')
      expect(canvas.getAttribute('data-imagery')).toBe('')
      // The dots are still the card's dots, and the open dot's tasks are still under the map.
      expect(canvas.querySelectorAll('button')).toHaveLength(2)
      expect(document.querySelector('[data-task-places-team-selected]')?.textContent).toContain('TheoFix the latch')

      fireEvent.click(screen.getByRole('button', { name: 'Mar 2021' }))
      expect(canvas.getAttribute('data-imagery')).toBe(WAYBACK(700))
      expect(timePress().textContent).toBe('Time · Mar 2021')
      expect(document.querySelector('[data-map-time-caption]')?.textContent).toBe('Photo taken March 20, 2021. The dots are today’s.')
    })

    it('takes the Google map down while Time is on, and puts it back after', async () => {
      vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', 'test-key')
      walk.fn = answers
      render(<TaskPlacesTeamMapCard people={PEOPLE} />)
      fireEvent.click(await screen.findByRole('button', { name: 'dot North gate ×T' }))
      fireEvent.click(timePress())
      await screen.findByTestId('canvas')
      expect(screen.queryByTestId('google-canvas')).toBeNull()
      fireEvent.click(timePress())
      expect((await screen.findByTestId('google-canvas')).getAttribute('data-map-type')).toBe('hybrid')
      expect(screen.queryByTestId('canvas')).toBeNull()
    })

    it('Hide map ends it: the map that comes back is the map of today', async () => {
      walk.fn = answers
      render(<TaskPlacesTeamMapCard people={PEOPLE} />)
      fireEvent.click(await screen.findByRole('button', { name: 'dot North gate ×T' }))
      fireEvent.click(timePress())
      fireEvent.click(await screen.findByRole('button', { name: 'Mar 2021' }))
      fireEvent.click(screen.getByRole('button', { name: 'Hide map' }))
      fireEvent.click(screen.getByRole('button', { name: 'Show map' }))
      const canvas = await screen.findByTestId('canvas')
      expect(timePress().getAttribute('aria-pressed')).toBe('false')
      expect(document.querySelector('[data-map-time-row]')).toBeNull()
      expect(canvas.getAttribute('data-imagery')).toBe('')
      expect(canvas.getAttribute('data-fit')).toBe('')
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
