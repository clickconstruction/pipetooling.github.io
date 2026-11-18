// @vitest-environment jsdom
/**
 * Where the open tasks are (punch list #328, PR 7): the leader's map over Outstanding by person. A
 * colour a person, a press on a name shows that person alone, a dot several people share wears its
 * count, the tasks with no place are counted, and no phone is asked for anything.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TASK_PLACE_PERSON_COLORS, TASK_PLACE_SHARED_COLOR, type TaskPlace } from '../../lib/tasks/taskPlace'

vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }))
const opened = vi.hoisted(() => [] as string[])
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (url: string) => opened.push(url) }))
const asked = vi.hoisted(() => ({ n: 0 }))
vi.mock('../../lib/materials/myLocation', () => ({ requestMyFix: () => { asked.n += 1 }, requestMyLocation: () => { asked.n += 1 } }))
vi.mock('./TaskPlacesMapCanvas', () => ({
  default: function CanvasStub(props: { pins: Array<{ id: string; label?: string; title: string; color: string }>; onSelect: (id: string | null) => void; height: number; layer: string; imagery?: { url: string } | null; fitPoints?: Array<{ lat: number; lng: number }> | null; fitMaxZoom?: number }) {
    return (
      <div data-testid="canvas" data-height={props.height} data-layer={props.layer} data-imagery={props.imagery?.url ?? ''} data-fit={props.fitPoints ? props.fitPoints.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join(' ') : ''} data-fit-max={props.fitMaxZoom ?? ''}>
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

// Older photos (v2.7693): the archive's walk, answered here. The retry panel reads the sign-in, so it is stood in for.
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

  describe('Older photos (v2.7693)', () => {
    const FOUND = [
      { release: 900, publishedYmd: '2026-10-29', size: 5, takenYmd: '2023-10-08' },
      { release: 700, publishedYmd: '2022-03-01', size: 3, takenYmd: '2021-03-20' },
      { release: 500, publishedYmd: '2018-01-10', size: 1, takenYmd: null },
    ]
    const WAYBACK = (release: number) => `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/${release}/{z}/{y}/{x}`

    it('swaps the map for the archive view of the first dot, a press a date, and opens one step back', async () => {
      walk.fn = async (_spot, opts) => {
        opts.onChange(FOUND)
        return FOUND
      }
      render(<TaskPlacesTeamMapCard people={PEOPLE} />)
      await screen.findByTestId('canvas')
      fireEvent.click(screen.getByRole('button', { name: 'Older photos' }))
      const strip = await waitFor(() => {
        const el = document.querySelector('[data-task-places-older]') as HTMLElement
        expect(el.textContent).toContain('Mar 2021')
        return el
      })
      expect(strip.textContent).toContain('Older photos of Pump house')
      expect(walk.spots).toEqual([{ lat: 29.55, lng: -98.3 }])
      expect([...strip.querySelectorAll('[role="group"] button')].map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
        ['Before Jan 2018', 'false'],
        ['Mar 2021', 'true'],
        ['Oct 2023', 'false'],
      ])
      expect(strip.querySelector('[data-task-places-older-caption]')?.textContent).toBe('Photo taken March 20, 2021.')
      const canvas = screen.getByTestId('canvas')
      expect(canvas.getAttribute('data-imagery')).toBe(WAYBACK(700))
      expect(canvas.getAttribute('data-layer')).toBe('satellite')
      // Framed close around the spot, not at the canvas's two-kilometre box for one point.
      expect(canvas.getAttribute('data-fit')).toBe('29.5495,-98.3005 29.5505,-98.2995')
      expect(canvas.getAttribute('data-fit-max')).toBe('17')
      expect(document.querySelector('[data-map-provider]')?.getAttribute('data-map-provider')).toBe('archive')
      // The view from above is the only view, so the Satellite / Streets choice steps aside.
      expect(screen.queryByRole('button', { name: 'Streets' })).toBeNull()
      // The dots are still the card's dots.
      expect(canvas.querySelectorAll('button')).toHaveLength(2)

      fireEvent.click(screen.getByRole('button', { name: 'Before Jan 2018' }))
      expect(canvas.getAttribute('data-imagery')).toBe(WAYBACK(500))
      expect(strip.querySelector('[data-task-places-older-caption]')?.textContent).toBe('Esri published this picture on January 10, 2018. It was taken before that, and the archive did not say when.')

      fireEvent.click(screen.getByRole('button', { name: 'Open this spot in Google Earth' }))
      expect(opened).toEqual(['https://earth.google.com/web/@29.550000,-98.300000,0a,700d,35y,0h,0t,0r'])

      fireEvent.click(screen.getByRole('button', { name: 'Back to today' }))
      expect(document.querySelector('[data-task-places-older]')).toBeNull()
      expect(screen.getByTestId('canvas').getAttribute('data-imagery')).toBe('')
      expect(screen.getByRole('button', { name: 'Streets' })).toBeTruthy()
    })

    it('follows the dot that is open', async () => {
      walk.fn = async (_spot, opts) => {
        opts.onChange(FOUND)
        return FOUND
      }
      render(<TaskPlacesTeamMapCard people={PEOPLE} />)
      fireEvent.click(await screen.findByRole('button', { name: 'dot North gate' }))
      fireEvent.click(screen.getByRole('button', { name: 'Older photos' }))
      await waitFor(() => expect(document.querySelector('[data-task-places-older]')?.textContent).toContain('Older photos of North gate'))
      expect(walk.spots).toEqual([{ lat: 29.556, lng: -98.3 }])
    })

    it('takes the Google map down while the archive shows, and puts it back after', async () => {
      vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', 'test-key')
      walk.fn = async (_spot, opts) => {
        opts.onChange(FOUND)
        return FOUND
      }
      render(<TaskPlacesTeamMapCard people={PEOPLE} />)
      await screen.findByTestId('google-canvas')
      fireEvent.click(screen.getByRole('button', { name: 'Older photos' }))
      await screen.findByTestId('canvas')
      expect(screen.queryByTestId('google-canvas')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Back to today' }))
      await screen.findByTestId('google-canvas')
      expect(screen.queryByTestId('canvas')).toBeNull()
    })

    it('says it is looking, shows a photo before its day is known, then that the archive has one photo, or nothing', async () => {
      let finish: (found: unknown[]) => void = () => {}
      let hand: { onChange: (found: unknown[]) => void; onWalked?: () => void } | null = null
      walk.fn = (_spot, opts) => {
        hand = opts
        return new Promise((resolve) => { finish = resolve })
      }
      render(<TaskPlacesTeamMapCard people={PEOPLE} />)
      await screen.findByTestId('canvas')
      fireEvent.click(screen.getByRole('button', { name: 'Older photos' }))
      expect((await screen.findByRole('status')).textContent).toBe('Looking through the archive…')
      // Until a photograph lands the view from above is today's.
      expect(screen.getByTestId('canvas').getAttribute('data-imagery')).toBe('')
      // A photograph is on the strip before its day is: named by what is true of it.
      act(() => {
        hand!.onChange([{ release: 900, publishedYmd: '2026-10-29', size: 5 }])
        hand!.onWalked?.()
      })
      expect(screen.getByRole('button', { name: 'Before Oct 2026' }).getAttribute('aria-pressed')).toBe('true')
      expect(screen.getByTestId('canvas').getAttribute('data-imagery')).toBe(WAYBACK(900))
      expect(document.querySelector('[data-task-places-older-caption]')?.textContent).toBe('Esri published this picture on October 29, 2026. Finding the day it was taken…')
      expect(screen.getByRole('status').textContent).toBe('Finding the days the photos were taken…')
      finish([FOUND[0]])
      await waitFor(() => expect(document.querySelector('[data-task-places-older-caption]')?.textContent).toBe('Photo taken October 8, 2023. The archive has one photo of this spot.'))
      expect(screen.queryByRole('status')).toBeNull()

      cleanup()
      walk.fn = async () => []
      render(<TaskPlacesTeamMapCard people={[{ userId: 'wes', name: 'Wes', tasks: [{ id: 'z', title: 'Check the well', place: place('Well', 31.2) }] }]} />)
      await screen.findByTestId('canvas')
      fireEvent.click(screen.getByRole('button', { name: 'Older photos' }))
      await waitFor(() => expect(document.querySelector('[data-task-places-older-caption]')?.textContent).toBe('The archive has nothing for this spot.'))
    })

    it('a read that fails names its reason and reads again on Retry', async () => {
      walk.fn = async () => {
        throw new Error('The photo archive answered 503.')
      }
      render(<TaskPlacesTeamMapCard people={PEOPLE} />)
      await screen.findByTestId('canvas')
      fireEvent.click(screen.getByRole('button', { name: 'Older photos' }))
      expect((await screen.findByTestId('retry-panel')).textContent).toContain('The photo archive answered 503.')
      expect(document.querySelector('[data-task-places-older-caption]')).toBeNull()
      walk.fn = async (_spot, opts) => {
        opts.onChange(FOUND)
        return FOUND
      }
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
      await waitFor(() => expect(document.querySelector('[data-task-places-older]')?.textContent).toContain('Mar 2021'))
      expect(screen.queryByTestId('retry-panel')).toBeNull()
      expect(walk.spots).toHaveLength(2)
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
