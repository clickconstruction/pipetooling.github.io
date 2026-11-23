// @vitest-environment jsdom
/**
 * Which map is under a painted map (punch list #387), with both maps stood in: the Leaflet map this
 * canvas has always drawn, and Google's. The rule is `paintedMapProvider.ts` and is tested there.
 * These cases are the canvas keeping to it: what it mounts, what it hands across when the map
 * changes, and that it never goes back once something was made.
 */
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('leaflet/dist/leaflet.css', () => ({}))
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }))
vi.mock('react-leaflet', () => {
  // A map that answers anything: the canvas's own layers ask it for its size, its zoom and its centre.
  const map: Record<string, unknown> = new Proxy(
    {},
    {
      get: (_t, key) => {
        if (key === 'getContainer') return () => document.createElement('div')
        if (key === 'getCenter') return () => ({ lat: 30.2, lng: -98.1 })
        if (key === 'getZoom') return () => 18
        if (key === 'getSize') return () => ({ x: 600, y: 400 })
        return () => map
      },
    },
  )
  return {
    MapContainer: (p: { children?: ReactNode; center: [number, number]; zoom: number }) => (
      <div data-testid="leaflet" data-center={p.center.join(',')} data-zoom={p.zoom}>
        {p.children}
      </div>
    ),
    TileLayer: (p: { url: string }) => <div data-testid="tiles" data-url={p.url} />,
    Marker: () => <div data-testid="marker" />,
    Polyline: () => <div data-testid="line" />,
    Circle: () => null,
    useMap: () => map,
    useMapEvents: () => map,
  }
})
vi.mock('../../lib/map/olderPhotosIo', () => ({
  walkOlderPhotos: async (_spot: unknown, opts: { onChange: (found: unknown[]) => void }) => {
    const found = [{ release: 900, publishedYmd: '2026-10-29', size: 5, takenYmd: '2025-02-09' }]
    opts.onChange(found)
    return found
  },
}))

/** Google's canvas, stood in: it says what it was handed, and its presses stand for what the real one tells the canvas. */
const google = vi.hoisted(() => ({ mounts: 0, throws: false, props: null as null | Record<string, unknown> }))
vi.mock('./PaintedMapGoogleCanvas', async () => {
  const { useEffect } = await import('react')
  return {
    default: function GoogleStub(props: { mapTypeId: string; apiKey: string; openOn?: { center: { lat: number; lng: number }; zoom: number } | null; lines: unknown[]; places: Array<{ id: string }>; onUnavailable: (reason: string) => void; onCamera?: (v: { center: { lat: number; lng: number }; zoom: number }) => void; onLive?: (live: unknown) => void; onPlaceTap?: (id: string) => void }) {
      if (google.throws) throw new Error('made-up failure while drawing')
      google.props = props
      useEffect(() => {
        google.mounts += 1
      }, [])
      return (
        <div data-testid="google" data-map-type={props.mapTypeId} data-key={props.apiKey} data-open-on={props.openOn ? `${props.openOn.center.lat},${props.openOn.center.lng},${props.openOn.zoom}` : ''} data-lines={props.lines.length} data-places={props.places.length}>
          <button type="button" onClick={() => props.onUnavailable('auth: Google rejected the browser key for this page')}>google refuses the key</button>
          <button type="button" onClick={() => props.onCamera?.({ center: { lat: 29.5533, lng: -98.2966 }, zoom: 20 })}>the painter moves in on a spot</button>
          <button type="button" onClick={() => props.onPlaceTap?.('gate')}>press the gate</button>
          <button type="button" onClick={() => props.onLive?.({ kind: 'dot', point: { lat: 30.2, lng: -98.1 }, caught: { id: 'gate', lat: 30.2, lng: -98.1, label: 'Truck gate' } })}>the dot nears the gate</button>
          <button type="button" onClick={() => props.onLive?.(null)}>the finger lifts</button>
        </div>
      )
    },
  }
})

import { forgetGoogleKeyRefusalForTests, onGoogleAuthFailure } from '../../lib/map/googleAuthFailure'
import { forgetPaintedGoogleFailureForTests } from '../../lib/paintedMap/paintedGooglePage'
import PaintedMapCanvas, { type PaintedCanvasDraft, type PaintedCanvasGoogleAsk, type PaintedCanvasLine, type PaintedCanvasPlace } from './PaintedMapCanvas'

const LINES: PaintedCanvasLine[] = [{ id: 'l1', points: [{ lat: 30.2, lng: -98.1 }, { lat: 30.202, lng: -98.098 }], poorParts: [], how: 'drawn' }]
const PLACES = [{ id: 'gate', number: 1, name: 'Truck gate', words: '', lat: 30.2, lng: -98.1, mapId: 'm', accuracyM: null, photoPath: null, kind: null, setBy: null, setAt: '2026-11-19T12:00:00Z' }] as PaintedCanvasPlace[]
const DRAFT: PaintedCanvasDraft = { points: [], picked: null, targets: [], onAdd: () => {}, onMove: () => {}, onInsert: () => {}, onPick: () => {} }
const LOOKING: PaintedCanvasGoogleAsk = { screen: 'window', use: 'looking' }
const DRAWING: PaintedCanvasGoogleAsk = { screen: 'window', use: 'drawing' }
const TIME = { name: 'The way in for deliveries' }

const box = () => document.querySelector('[data-painted-map-canvas]') as HTMLElement
const provider = () => box().getAttribute('data-map-provider')
const timePress = () => document.querySelector('[data-map-time-press]') as HTMLButtonElement

beforeEach(() => {
  google.mounts = 0
  google.throws = false
  google.props = null
  forgetPaintedGoogleFailureForTests()
  vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', 'made-up-key')
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  delete (window as Window & { gm_authFailure?: () => void }).gm_authFailure
  forgetGoogleKeyRefusalForTests()
})

/** Google says no, as it does once for a page: through its one global. */
const googleRefusesTheKey = () => {
  const stop = onGoogleAuthFailure(() => {})
  ;(window as Window & { gm_authFailure?: () => void }).gm_authFailure?.()
  stop()
}

describe('a caller that says nothing about Google', () => {
  it('gets the Leaflet map, with a key or without, as it always did', () => {
    render(<PaintedMapCanvas lines={LINES} places={[]} height={360} />)
    expect(provider()).toBe('osm')
    expect(screen.getByTestId('leaflet')).toBeTruthy()
    expect(screen.queryByTestId('google')).toBeNull()
    // It frames what is painted: the middle of the line, close.
    expect(screen.getByTestId('leaflet').getAttribute('data-zoom')).toBe('18')
  })
})

describe('the public page (step 4)', () => {
  const WAY: PaintedCanvasGoogleAsk = { screen: 'way', use: 'looking' }

  it('draws on Google with a good key, one map, light on the page’s light paper, with no Leaflet map beside it', async () => {
    // Every outside reader's open counts with Google: one map for an open, and never a second.
    render(<PaintedMapCanvas lines={LINES} places={PLACES} height={360} google={WAY} />)
    await screen.findByTestId('google')
    expect(provider()).toBe('google')
    expect(screen.queryByTestId('leaflet')).toBeNull()
    expect(google.mounts).toBe(1)
    expect(google.props?.light).toBe(true)
  })

  it('opens on the Leaflet map with no key, and when Google refuses the key under it', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', '')
    const first = render(<PaintedMapCanvas lines={LINES} places={PLACES} height={360} google={WAY} />)
    expect(provider()).toBe('osm')
    expect(google.mounts).toBe(0)
    first.unmount()
    vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', 'made-up-key')
    render(<PaintedMapCanvas lines={LINES} places={PLACES} height={360} google={WAY} />)
    fireEvent.click(await screen.findByRole('button', { name: 'google refuses the key' }))
    expect(provider()).toBe('osm')
    expect(screen.getByTestId('leaflet')).toBeTruthy()
  })

  it('hands Google’s canvas the frame that keeps a reader and the line together, and holds only the page light', async () => {
    const me = { lat: 30.201, lng: -98.099, accuracyM: 6 }
    render(<PaintedMapCanvas lines={LINES} places={PLACES} height="100%" google={LOOKING} me={me} frameMe />)
    await screen.findByTestId('google')
    expect(google.props?.frameMe).toBe(true)
    // The painting window follows the app's theme.
    expect(google.props?.light).toBe(false)
  })
})

describe('the painting window, putting a place down (step 3)', () => {
  const PLACING: PaintedCanvasGoogleAsk = { screen: 'window', use: 'placing' }
  const dot = () => ({ point: { lat: 30.201, lng: -98.099 }, label: 'the gate', onMove: () => {} })

  it('puts the dot down on Google’s map, with no Leaflet map, and opens no place under the finger', async () => {
    const onPlaceTap = vi.fn()
    const d = dot()
    render(<PaintedMapCanvas lines={LINES} places={PLACES} height="100%" google={PLACING} dot={d} onPlaceTap={onPlaceTap} />)
    await screen.findByTestId('google')
    expect(provider()).toBe('google')
    expect(screen.queryByTestId('leaflet')).toBeNull()
    expect(google.props?.dot).toBe(d)
    // A press on a place while a dot is being put down moves the dot. It does not open the place.
    expect(google.props?.onPlaceTap).toBeUndefined()
  })

  it('keeps the one Google map from reading to placing and back', async () => {
    const view = render(<PaintedMapCanvas lines={LINES} places={PLACES} height="100%" google={LOOKING} />)
    await screen.findByTestId('google')
    view.rerender(<PaintedMapCanvas lines={LINES} places={PLACES} height="100%" google={PLACING} dot={dot()} />)
    expect(provider()).toBe('google')
    view.rerender(<PaintedMapCanvas lines={LINES} places={PLACES} height="100%" google={LOOKING} />)
    expect(provider()).toBe('google')
    expect(google.mounts).toBe(1)
  })

  it('says what the dot caught, and tells the window what the glass shows', async () => {
    const onGlass = vi.fn()
    render(<PaintedMapCanvas lines={LINES} places={PLACES} height="100%" google={PLACING} dot={dot()} onGlass={onGlass} />)
    fireEvent.click(await screen.findByRole('button', { name: 'the dot nears the gate' }))
    expect(document.querySelector('[data-painted-caught]')?.textContent).toBe('On Truck gate')
    expect(onGlass).toHaveBeenLastCalledWith({ point: { lat: 30.2, lng: -98.1 }, caught: expect.objectContaining({ label: 'Truck gate' }) })
    fireEvent.click(screen.getByRole('button', { name: 'the finger lifts' }))
    expect(document.querySelector('[data-painted-caught]')).toBeNull()
    expect(onGlass).toHaveBeenLastCalledWith(null)
  })
})

describe('the painting window, on a walk (step 3)', () => {
  const WALKING: PaintedCanvasGoogleAsk = { screen: 'window', use: 'walking' }

  it('paints the walk on Google’s map, follows the walker, and makes no Leaflet map', async () => {
    const me = { lat: 30.201, lng: -98.099, accuracyM: 6 }
    render(<PaintedMapCanvas lines={LINES} places={PLACES} height="100%" google={WALKING} me={me} follow frameMargin />)
    await screen.findByTestId('google')
    expect(provider()).toBe('google')
    expect(screen.queryByTestId('leaflet')).toBeNull()
    expect(google.props?.follow).toBe(true)
    expect(google.props?.frameMargin).toBe(true)
    expect(google.props?.me).toEqual(me)
  })

  it('keeps the one Google map from reading to the walk and back to Look it over', async () => {
    const view = render(<PaintedMapCanvas lines={LINES} places={PLACES} height="100%" google={LOOKING} />)
    await screen.findByTestId('google')
    view.rerender(<PaintedMapCanvas lines={LINES} places={PLACES} height="100%" google={WALKING} follow />)
    expect(provider()).toBe('google')
    view.rerender(<PaintedMapCanvas lines={LINES} places={PLACES} height="100%" google={LOOKING} refit={1} />)
    expect(provider()).toBe('google')
    expect(google.mounts).toBe(1)
  })

  it('stays on the one Google map when a line of the walk is fixed by hand, and after', async () => {
    const view = render(<PaintedMapCanvas lines={LINES} places={PLACES} height="100%" google={WALKING} follow />)
    await screen.findByTestId('google')
    view.rerender(<PaintedMapCanvas lines={LINES} places={PLACES} height="100%" google={DRAWING} draft={DRAFT} />)
    expect(provider()).toBe('google')
    view.rerender(<PaintedMapCanvas lines={LINES} places={PLACES} height="100%" google={LOOKING} />)
    expect(provider()).toBe('google')
    expect(screen.queryByTestId('leaflet')).toBeNull()
    expect(google.mounts).toBe(1)
  })
})

describe('the painting window, reading a saved map', () => {
  it('opens on the Leaflet map at once when Google refused the key under another map of this page', () => {
    // A job's map or the Dashboard's heard the refusal before any painted map was opened. Google does not say it twice.
    googleRefusesTheKey()
    render(<PaintedMapCanvas lines={LINES} places={PLACES} height="100%" google={LOOKING} />)
    expect(provider()).toBe('osm')
    expect(screen.getByTestId('leaflet')).toBeTruthy()
    expect(screen.queryByTestId('google')).toBeNull()
    expect(google.mounts).toBe(0)
  })

  it('draws on Google’s photograph with street names, and no Leaflet map is on the screen', async () => {
    render(<PaintedMapCanvas lines={LINES} places={PLACES} height="100%" google={LOOKING} />)
    const g = await screen.findByTestId('google')
    expect(provider()).toBe('google')
    expect(g.getAttribute('data-map-type')).toBe('hybrid')
    expect(g.getAttribute('data-key')).toBe('made-up-key')
    expect(g.getAttribute('data-lines')).toBe('1')
    expect(g.getAttribute('data-places')).toBe('1')
    // Google's terms keep another provider's map off the screen a Google map is on.
    expect(screen.queryByTestId('leaflet')).toBeNull()
    expect(screen.queryByTestId('tiles')).toBeNull()
  })

  it('keeps the two views: Streets is Google’s road map', async () => {
    render(<PaintedMapCanvas lines={LINES} places={[]} height="100%" google={LOOKING} />)
    await screen.findByTestId('google')
    expect(screen.getByRole('button', { name: 'From above' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Streets' }))
    expect(screen.getByTestId('google').getAttribute('data-map-type')).toBe('roadmap')
    // The same map, not a new one: Google bills by the map made.
    expect(google.mounts).toBe(1)
  })

  it('opens first on what is painted, with no view to carry', async () => {
    render(<PaintedMapCanvas lines={LINES} places={[]} height="100%" google={LOOKING} />)
    const g = await screen.findByTestId('google')
    expect(g.getAttribute('data-open-on')).toBe('')
    expect((google.props?.framed as unknown[]).length).toBe(2)
  })

  it('hands a press on a place to the caller', async () => {
    const onPlaceTap = vi.fn()
    render(<PaintedMapCanvas lines={LINES} places={PLACES} height="100%" google={LOOKING} onPlaceTap={onPlaceTap} />)
    await screen.findByTestId('google')
    fireEvent.click(screen.getByRole('button', { name: 'press the gate' }))
    expect(onPlaceTap).toHaveBeenCalledWith('gate')
  })
})

describe('the rule, kept', () => {
  it('stays on Leaflet with no key', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', '')
    render(<PaintedMapCanvas lines={LINES} places={[]} height="100%" google={LOOKING} />)
    expect(provider()).toBe('osm')
    expect(screen.getByTestId('leaflet')).toBeTruthy()
  })

  it('draws a still on Leaflet', () => {
    render(<PaintedMapCanvas lines={LINES} places={[]} height={150} still google={LOOKING} />)
    expect(provider()).toBe('osm')
  })
})

describe('making something', () => {
  it('draws a line on Google’s map, the one it was read on, and opens no place under the finger (step 3)', async () => {
    const onPlaceTap = vi.fn()
    const view = render(<PaintedMapCanvas lines={LINES} places={PLACES} height="100%" google={LOOKING} onPlaceTap={onPlaceTap} />)
    await screen.findByTestId('google')
    view.rerender(<PaintedMapCanvas lines={LINES} places={PLACES} height="100%" google={DRAWING} draft={DRAFT} onPlaceTap={onPlaceTap} />)
    expect(provider()).toBe('google')
    expect(screen.queryByTestId('leaflet')).toBeNull()
    expect(google.props?.draft).toBe(DRAFT)
    // A press on a place while a line is drawn is a corner. It does not open the place.
    expect(google.props?.onPlaceTap).toBeUndefined()
    expect(google.mounts).toBe(1)
  })

  it('takes the line up on the Leaflet map, on the spot the painter was looking at, when Google fails under it', async () => {
    const view = render(<PaintedMapCanvas lines={LINES} places={[]} height="100%" google={LOOKING} />)
    await screen.findByTestId('google')
    fireEvent.click(screen.getByRole('button', { name: 'the painter moves in on a spot' }))
    view.rerender(<PaintedMapCanvas lines={LINES} places={[]} height="100%" google={DRAWING} draft={DRAFT} />)
    fireEvent.click(screen.getByRole('button', { name: 'google refuses the key' }))
    expect(provider()).toBe('osm')
    expect(screen.queryByTestId('google')).toBeNull()
    const leaflet = screen.getByTestId('leaflet')
    // The spot and the zoom Google's map was on, not the first framing over again.
    expect(leaflet.getAttribute('data-center')).toBe('29.5533,-98.2966')
    expect(leaflet.getAttribute('data-zoom')).toBe('20')
  })

  it('keeps Google’s map after the save: the new line stays on the photograph it was drawn over', async () => {
    const view = render(<PaintedMapCanvas lines={LINES} places={[]} height="100%" google={LOOKING} />)
    await screen.findByTestId('google')
    view.rerender(<PaintedMapCanvas lines={LINES} places={[]} height="100%" google={DRAWING} draft={DRAFT} />)
    view.rerender(<PaintedMapCanvas lines={LINES} places={[]} height="100%" google={LOOKING} />)
    expect(provider()).toBe('google')
    expect(screen.queryByTestId('leaflet')).toBeNull()
    // One Google map was made in this window, and no second one.
    expect(google.mounts).toBe(1)
  })

  it('opens on Google in a window that opened to draw, and reads the saved line on the same map', async () => {
    const view = render(<PaintedMapCanvas lines={[]} places={[]} height="100%" google={DRAWING} draft={DRAFT} />)
    await screen.findByTestId('google')
    expect(provider()).toBe('google')
    view.rerender(<PaintedMapCanvas lines={LINES} places={[]} height="100%" google={LOOKING} />)
    expect(provider()).toBe('google')
    expect(google.mounts).toBe(1)
  })

  it('takes Google’s map down under a picture of the map, and does not bring it back', async () => {
    const view = render(<PaintedMapCanvas lines={LINES} places={[]} height="100%" google={LOOKING} />)
    await screen.findByTestId('google')
    view.rerender(<PaintedMapCanvas lines={LINES} places={[]} height="100%" google={{ ...LOOKING, pictureUp: true }} />)
    expect(provider()).toBe('osm')
    view.rerender(<PaintedMapCanvas lines={LINES} places={[]} height="100%" google={LOOKING} />)
    await waitFor(() => expect(provider()).toBe('osm'))
    expect(google.mounts).toBe(1)
  })
})

describe('Time', () => {
  it('takes Google’s map down for the archive, and gives it back when Time is left', async () => {
    render(<PaintedMapCanvas lines={LINES} places={[]} height="100%" google={LOOKING} time={TIME} />)
    await screen.findByTestId('google')
    fireEvent.click(screen.getByRole('button', { name: 'the painter moves in on a spot' }))
    fireEvent.click(timePress())
    // The archive is Esri's: the Leaflet map, on the spot the painter was on.
    await waitFor(() => expect(provider()).toBe('archive'))
    expect(screen.queryByTestId('google')).toBeNull()
    expect(screen.getByTestId('leaflet').getAttribute('data-center')).toBe('29.5533,-98.2966')
    // Time is a look at an older day and not making: leaving it is today's map again, Google's.
    fireEvent.click(timePress())
    const back = await screen.findByTestId('google')
    expect(provider()).toBe('google')
    // It opens where the Leaflet map was looking.
    expect(back.getAttribute('data-open-on')).toBe('30.2,-98.1,18')
  })

  it('leaves Time for the road map on Streets, on Google', async () => {
    render(<PaintedMapCanvas lines={LINES} places={[]} height="100%" google={LOOKING} time={TIME} />)
    await screen.findByTestId('google')
    fireEvent.click(timePress())
    await waitFor(() => expect(provider()).toBe('archive'))
    fireEvent.click(screen.getByRole('button', { name: 'Streets' }))
    const back = await screen.findByTestId('google')
    expect(back.getAttribute('data-map-type')).toBe('roadmap')
  })
})

describe('Google fails', () => {
  it('falls back to the Leaflet map with its lines, says why once, and stays there', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<PaintedMapCanvas lines={LINES} places={PLACES} height="100%" google={LOOKING} />)
    await screen.findByTestId('google')
    fireEvent.click(screen.getByRole('button', { name: 'google refuses the key' }))
    expect(provider()).toBe('osm')
    expect(screen.queryByTestId('google')).toBeNull()
    expect(screen.getAllByTestId('line').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('marker').length).toBeGreaterThan(0)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('[painted map] Google Maps unavailable, using OpenStreetMap: auth:')
    // The two views still work on the map it fell back to.
    fireEvent.click(screen.getByRole('button', { name: 'Streets' }))
    expect(screen.getByTestId('tiles').getAttribute('data-url')).toContain('openstreetmap')
  })

  it('opens every painted map after it on Leaflet, for as long as the page is open', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<PaintedMapCanvas lines={LINES} places={[]} height="100%" google={LOOKING} />)
    await screen.findByTestId('google')
    fireEvent.click(screen.getByRole('button', { name: 'google refuses the key' }))
    cleanup()
    // The window is closed and another painted map is opened.
    render(<PaintedMapCanvas lines={LINES} places={[]} height="100%" google={LOOKING} />)
    expect(provider()).toBe('osm')
    expect(google.mounts).toBe(1)
  })

  it('falls back when Google’s canvas throws while it draws', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    google.throws = true
    render(<PaintedMapCanvas lines={LINES} places={[]} height="100%" google={LOOKING} />)
    await waitFor(() => expect(provider()).toBe('osm'))
    expect(screen.getByTestId('leaflet')).toBeTruthy()
  })
})
