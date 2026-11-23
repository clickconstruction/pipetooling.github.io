// @vitest-environment jsdom
/**
 * A painted map on a Google map, for looking (punch list #387), with the Maps library stood in: what
 * it draws, where it opens, how it moves when asked, and that it lets go of everything when it leaves.
 * Its doors to Leaflet are the pins canvas's own and are tested there. One case here shows they are on.
 */
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { forgetGoogleKeyRefusalForTests } from '../../lib/map/googleAuthFailure'
import { MARGIN_FRAME_PADDING_PX, MARGIN_FRAME_ZOOM, areaBox } from '../../lib/paintedMap/marginFrame'
import { paintedFitView, PAINTED_POINT_ZOOM, PAINTED_WIDE_VIEW } from '../../lib/paintedMap/paintedMapView'

type Listener = (e?: unknown) => void
/** The map the library hands the canvas, and what the canvas handed the library's Map. */
const lib = vi.hoisted(() => ({
  mapProps: null as null | Record<string, unknown>,
  moves: [] as Array<{ center?: { lat: number; lng: number }; zoom?: number }>,
  /** Each change of the map's own options the canvas asked for: a held press stops the map moving under the finger. */
  options: [] as Array<Record<string, unknown>>,
  /** Each slide the canvas asked for: a walker followed. */
  pans: [] as Array<{ lat: number; lng: number }>,
  listeners: {} as Record<string, Listener>,
  removed: [] as unknown[],
  /** Where the map is looking: where it opened, then wherever the canvas last moved it. */
  camera: { center: { lat: 29.55, lng: -98.3 }, zoom: 17 },
  /** The map's box as the page has it now. A case shrinks it, as when the panel beside the map grows. */
  box: { width: 600, height: 400 },
  /** Whether Google's script is in when the canvas comes up. A case holds it back, as a weak signal does. */
  loads: true,
  /** The script arrives now, for a case that held it back. */
  load: () => {},
  /** The map's own box on the page: presses on it reach the canvas's listeners. */
  div: null as unknown as HTMLDivElement,
}))
const fakeMap = {
  moveCamera: (to: { center?: { lat: number; lng: number }; zoom?: number }) => {
    lib.moves.push(to)
    lib.camera = { center: to.center ?? lib.camera.center, zoom: to.zoom ?? lib.camera.zoom }
  },
  panTo: (to: { lat: number; lng: number }) => {
    lib.pans.push(to)
    lib.camera = { ...lib.camera, center: to }
  },
  getDiv: () => lib.div,
  setOptions: (o: Record<string, unknown>) => {
    lib.options.push(o)
  },
  getCenter: () => ({ lat: () => lib.camera.center.lat, lng: () => lib.camera.center.lng }),
  getZoom: () => lib.camera.zoom,
  addListener: (name: string, fn: Listener) => {
    lib.listeners[name] = fn
    return name
  },
}
vi.mock('@vis.gl/react-google-maps', async () => {
  const { useEffect } = await import('react')
  return {
    APIProvider: (p: { onLoad?: () => void; children?: ReactNode }) => {
      const { onLoad } = p
      useEffect(() => {
        lib.load = () => onLoad?.()
        if (lib.loads) onLoad?.()
        // once, as the library's own loader calls it
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return <>{p.children}</>
    },
    Map: (p: { children?: ReactNode } & Record<string, unknown>) => {
      lib.mapProps = p
      return <div data-testid="map-div">{p.children}</div>
    },
    useMap: () => fakeMap,
  }
})

import type { PaintedCanvasDot, PaintedCanvasDraft, PaintedCanvasLine, PaintedCanvasPlace } from './PaintedMapCanvas'
import PaintedMapGoogleCanvas, { type PaintedMapGoogleCanvasProps } from './PaintedMapGoogleCanvas'
import { GOOGLE_MAP_STYLES } from '../../lib/map/googleMapLook'
import { forgetPaintedGlassForTests } from './paintedGoogleGlassMap'

class PolylineStub {
  static made: PolylineStub[] = []
  on: unknown
  constructor(readonly opts: Record<string, unknown> & { path: Array<{ lat: number; lng: number }> }) {
    this.on = opts.map
    PolylineStub.made.push(this)
  }
  setMap(map: unknown) {
    this.on = map
  }
  setPath(path: Array<{ lat: number; lng: number }>) {
    this.opts.path = path
  }
}
class CircleStub {
  static made: CircleStub[] = []
  on: unknown
  constructor(readonly opts: Record<string, unknown>) {
    this.on = opts.map
    CircleStub.made.push(this)
  }
  setMap(map: unknown) {
    this.on = map
  }
}
/** Google's overlay, stood in: it adds and draws at once, as the real one does once the map is up. */
class OverlayStub {
  static made: OverlayStub[] = []
  static preventMapHitsFrom = vi.fn()
  on: unknown = null
  onAdd?: () => void
  draw?: () => void
  onRemove?: () => void
  readonly panes = { overlayMouseTarget: document.createElement('div'), markerLayer: document.createElement('div') }
  constructor() {
    OverlayStub.made.push(this)
  }
  getPanes() {
    return this.panes
  }
  getProjection() {
    // A flat ground: ten pixels to the degree, so a mark's place is easy to read.
    return { fromLatLngToDivPixel: (at: { lat: number; lng: number }) => ({ x: at.lng * 10, y: at.lat * 10 }) }
  }
  setMap(map: unknown) {
    if (map) {
      this.on = map
      this.onAdd?.()
      this.draw?.()
    } else {
      this.onRemove?.()
      this.on = null
    }
  }
  /** The mark this overlay put on the map, wherever it put it. */
  get mark(): HTMLElement | null {
    return this.panes.overlayMouseTarget.querySelector('[data-painted-mark]') ?? this.panes.markerLayer.querySelector('[data-painted-mark]')
  }
}
/** One of Google's own markers, stood in: it keeps what it was made with and a case fires its events. */
class MarkerStub {
  static made: MarkerStub[] = []
  on: unknown
  position: unknown
  title: unknown
  readonly handlers: Record<string, (e: unknown) => void> = {}
  constructor(readonly opts: Record<string, unknown>) {
    this.on = opts.map
    this.position = opts.position
    this.title = opts.title
    MarkerStub.made.push(this)
  }
  addListener(name: string, fn: (e: unknown) => void) {
    this.handlers[name] = fn
    return name
  }
  fire(name: string, e: unknown) {
    this.handlers[name]?.(e)
  }
  setPosition(p: unknown) {
    this.position = p
  }
  setTitle(t: unknown) {
    this.title = t
  }
  setMap(map: unknown) {
    this.on = map
  }
}
/**
 * The glass's own map, stood in: the page makes one and a case counts them. Like Google's, it gives a zoom no deeper
 * than its photograph goes at the spot, and says the zoom it took.
 */
class GlassMapStub {
  static made: GlassMapStub[] = []
  /** How deep the photograph goes where the finger is. A case makes it shallow. */
  static depth = 22
  /**
   * Google on ground it has not drawn before: it takes the zoom it is asked for, draws at its photograph's depth, and
   * says the zoom it truly took only when it is asked again.
   */
  static late = false
  readonly moves: Array<{ center?: { lat: number; lng: number }; zoom?: number }> = []
  readonly heard: Record<string, () => void> = {}
  zoom: number
  private told = false
  constructor(readonly host: HTMLElement, readonly opts: Record<string, unknown>) {
    this.zoom = GlassMapStub.late ? Number(opts.zoom) : Math.min(Number(opts.zoom), GlassMapStub.depth)
    GlassMapStub.made.push(this)
  }
  setOptions() {}
  moveCamera(to: { center?: { lat: number; lng: number }; zoom?: number }) {
    this.moves.push(to)
    if (to.zoom == null) return
    const was = this.zoom
    this.zoom = GlassMapStub.late && !this.told ? to.zoom : Math.min(to.zoom, GlassMapStub.depth)
    this.told = true
    if (this.zoom !== was) this.heard.zoom_changed?.()
  }
  getZoom() {
    return this.zoom
  }
  addListener(name: string, fn: () => void) {
    this.heard[name] = fn
    return `glass-${name}`
  }
  /** Google thinks better of the zoom it gave, a moment after it was asked. */
  settle(zoom: number) {
    this.zoom = zoom
    this.heard.zoom_changed?.()
  }
  /** The map's pictures have come in. */
  drawn() {
    this.heard.tilesloaded?.()
  }
}
class SizeStub {
  constructor(readonly width: number, readonly height: number) {}
}
class PointStub {
  constructor(readonly x: number, readonly y: number) {}
}
class LatLngStub {
  constructor(readonly lat: number, readonly lng: number) {}
}

/** A made-up site: a line drawn by hand, a walked line with a stretch the phone was not sure of, and three places. */
const DRAWN: PaintedCanvasLine = { id: 'drawn', how: 'drawn', poorParts: [], points: [{ lat: 29.55, lng: -98.3 }, { lat: 29.551, lng: -98.299 }] }
// The stretch between its second and third points is one the phone was not sure of.
const WALKED: PaintedCanvasLine = { id: 'walked', how: 'walked', poorParts: [[1, 2]], points: [{ lat: 29.552, lng: -98.298 }, { lat: 29.553, lng: -98.297 }, { lat: 29.554, lng: -98.296 }, { lat: 29.555, lng: -98.295 }] }
const place = (over: Partial<PaintedCanvasPlace> & Pick<PaintedCanvasPlace, 'id' | 'number' | 'name' | 'lat' | 'lng'>): PaintedCanvasPlace => ({ mapId: 'map', words: '', accuracyM: null, photoPath: null, kind: null, setBy: null, setAt: '2026-11-19T12:00:00Z', ...over }) as PaintedCanvasPlace
const GATE = place({ id: 'gate', number: 1, name: 'Truck gate', kind: 'gate', lat: 29.55, lng: -98.3 })
const PLAIN = place({ id: 'plain', number: 2, name: 'Stack the pipe here', lat: 29.551, lng: -98.299 })
const FROM_JOB = place({ id: 'job', number: 1, letter: 'A', fromJob: true, name: 'Meter', lat: 29.552, lng: -98.298 })
const ALL_POINTS = [...DRAWN.points, ...WALKED.points]

function mount(over: Partial<PaintedMapGoogleCanvasProps> = {}) {
  const onUnavailable = vi.fn<(reason: string) => void>()
  const props: PaintedMapGoogleCanvasProps = { apiKey: 'made-up-key', onUnavailable, mapTypeId: 'hybrid', lines: [], places: [], framed: [], ...over }
  const view = render(<PaintedMapGoogleCanvas {...props} />)
  return { view, onUnavailable, rerender: (next: Partial<PaintedMapGoogleCanvasProps>) => view.rerender(<PaintedMapGoogleCanvas {...props} {...next} />) }
}

beforeEach(() => {
  lib.mapProps = null
  lib.loads = true
  lib.load = () => {}
  lib.moves.length = 0
  lib.pans.length = 0
  lib.options.length = 0
  lib.listeners = {}
  lib.removed.length = 0
  lib.camera = { center: { lat: 29.55, lng: -98.3 }, zoom: 17 }
  lib.box = { width: 600, height: 400 }
  lib.div = document.createElement('div')
  Object.defineProperty(lib.div, 'clientWidth', { get: () => lib.box.width })
  Object.defineProperty(lib.div, 'clientHeight', { get: () => lib.box.height })
  MarkerStub.made = []
  GlassMapStub.made = []
  GlassMapStub.depth = 22
  GlassMapStub.late = false
  forgetPaintedGlassForTests()
  PolylineStub.made = []
  CircleStub.made = []
  OverlayStub.made = []
  OverlayStub.preventMapHitsFrom.mockClear()
  vi.stubGlobal('google', { maps: { Polyline: PolylineStub, Circle: CircleStub, OverlayView: OverlayStub, LatLng: LatLngStub, Marker: MarkerStub, Size: SizeStub, Point: PointStub, event: { removeListener: (handle: unknown) => lib.removed.push(handle) } } })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  delete (window as Window & { gm_authFailure?: () => void }).gm_authFailure
  forgetGoogleKeyRefusalForTests()
})

describe('where it opens', () => {
  it('frames what the map opened with, no closer than the photograph is sharp', () => {
    mount({ lines: [DRAWN, WALKED], framed: ALL_POINTS })
    // The box has no size in this test, so the kernel frames for a box it has not measured.
    const want = paintedFitView(ALL_POINTS, { width: 0, height: 0 })!
    expect(lib.mapProps?.defaultCenter).toEqual(want.center)
    expect(lib.mapProps?.defaultZoom).toBe(want.zoom)
  })

  it('opens on the view carried from the other canvas, so the painter keeps their spot', () => {
    const carried = { center: { lat: 29.5533, lng: -98.2966 }, zoom: 20 }
    mount({ lines: [DRAWN], framed: DRAWN.points, openOn: carried })
    expect(lib.mapProps?.defaultCenter).toEqual(carried.center)
    expect(lib.mapProps?.defaultZoom).toBe(20)
  })

  it('opens a map with nothing on it at its address, and on the country with none', () => {
    const address = { lat: 29.6, lng: -98.4 }
    mount({ start: address })
    expect(lib.mapProps?.defaultCenter).toEqual(address)
    expect(lib.mapProps?.defaultZoom).toBe(PAINTED_POINT_ZOOM)
    cleanup()
    mount()
    expect(lib.mapProps?.defaultCenter).toEqual(PAINTED_WIDE_VIEW.center)
    expect(lib.mapProps?.defaultZoom).toBe(PAINTED_WIDE_VIEW.zoom)
  })
})

describe('the map it asks Google for', () => {
  it('holds the photograph flat, and leaves the road map as Google draws it', () => {
    const { rerender } = mount({ mapTypeId: 'hybrid' })
    expect(lib.mapProps?.mapTypeId).toBe('hybrid')
    expect(lib.mapProps?.tilt).toBe(0)
    rerender({ mapTypeId: 'roadmap' })
    expect(lib.mapProps?.mapTypeId).toBe('roadmap')
    expect(lib.mapProps && 'tilt' in lib.mapProps).toBe(false)
  })

  it('follows the app’s theme, and stays light on a screen that is always light', () => {
    document.documentElement.dataset.theme = 'dark'
    try {
      const { rerender } = mount()
      expect(lib.mapProps?.colorScheme).toBe('DARK')
      // The public page wears the portal's light paper whatever the app's theme.
      rerender({ light: true })
      expect(lib.mapProps?.colorScheme).toBe('LIGHT')
    } finally {
      delete document.documentElement.dataset.theme
    }
  })

  it('keeps one map for the page: Google bills by the map made', () => {
    mount()
    expect(lib.mapProps?.reuseMaps).toBe(true)
  })

  it('moves under one finger, and carries none of Google’s own places to press', () => {
    mount()
    expect(lib.mapProps?.gestureHandling).toBe('greedy')
    expect(lib.mapProps?.clickableIcons).toBe(false)
    expect(lib.mapProps?.disableDefaultUI).toBe(true)
    expect(lib.mapProps?.zoomControl).toBe(true)
  })

  it('wears the app’s one look for a Google map: none of Google’s own place labels beside a line', () => {
    mount()
    expect(lib.mapProps?.styles).toEqual(GOOGLE_MAP_STYLES)
    mount({ mapTypeId: 'roadmap' })
    expect(lib.mapProps?.styles).toEqual(GOOGLE_MAP_STYLES)
  })
})

describe('the lines', () => {
  it('draws a line made by hand as a dark edge under dashes', () => {
    mount({ lines: [DRAWN] })
    expect(PolylineStub.made).toHaveLength(2)
    const [edge, paint] = PolylineStub.made
    expect(edge?.opts.strokeWeight).toBe(8)
    expect(edge?.opts.icons).toBeUndefined()
    expect(paint?.opts.strokeOpacity).toBe(0)
    expect((paint?.opts.icons as Array<{ repeat: string }>)[0]?.repeat).toBe('21px')
    expect(edge?.opts.path).toEqual(DRAWN.points)
  })

  it('draws a walked line solid, and the stretch the phone was not sure of as faint dots', () => {
    mount({ lines: [WALKED] })
    // Sure before the poor stretch and sure after it: two runs of an edge and a paint each. Then the dots.
    const solid = PolylineStub.made.filter((l) => l.opts.strokeOpacity === 1 && !l.opts.icons)
    const dotted = PolylineStub.made.filter((l) => (l.opts.icons as Array<{ repeat: string }> | undefined)?.[0]?.repeat === '11px')
    expect(solid).toHaveLength(2)
    expect(dotted).toHaveLength(1)
    expect(dotted[0]?.opts.path).toEqual([WALKED.points[1], WALKED.points[2]])
  })

  it('lets a press through every line to the map', () => {
    mount({ lines: [DRAWN, WALKED] })
    expect(PolylineStub.made.length).toBeGreaterThan(0)
    for (const line of PolylineStub.made) expect(line.opts.clickable).toBe(false)
  })

  it('takes the old lines off when the list changes, and all of them when it leaves', () => {
    const { rerender, view } = mount({ lines: [DRAWN] })
    const first = [...PolylineStub.made]
    rerender({ lines: [WALKED] })
    for (const line of first) expect(line.on).toBeNull()
    const second = PolylineStub.made.filter((l) => !first.includes(l))
    expect(second.length).toBeGreaterThan(0)
    view.unmount()
    for (const line of PolylineStub.made) expect(line.on).toBeNull()
  })
})

describe('the places', () => {
  it('wears the number, the letter and the kind’s mark the Leaflet canvas draws', () => {
    mount({ places: [GATE, PLAIN, FROM_JOB], onPlaceTap: () => {} })
    const marks = OverlayStub.made.map((o) => o.mark!)
    expect(marks).toHaveLength(3)
    expect(marks[0]?.innerHTML).toContain('<svg')
    expect(marks[0]?.textContent).toBe('1')
    expect(marks[1]?.textContent).toBe('2')
    expect(marks[1]?.innerHTML).not.toContain('<svg')
    // A place kept on the job wears its letter and a dashed ring.
    expect(marks[2]?.textContent).toBe('A')
    expect(marks[2]?.innerHTML).toContain('dashed')
  })

  it('sits with its middle on its spot', () => {
    mount({ places: [PLAIN] })
    const mark = OverlayStub.made[0]!.mark!
    // 26 px wide, and the stand-in ground is ten pixels to the degree.
    expect(mark.style.left).toBe(`${Math.round(PLAIN.lng * 10 - 13)}px`)
    expect(mark.style.top).toBe(`${Math.round(PLAIN.lat * 10 - 13)}px`)
  })

  it('tells the caller which place was pressed, and keeps the press from the map', () => {
    const onPlaceTap = vi.fn()
    mount({ places: [GATE, PLAIN], onPlaceTap })
    const mark = OverlayStub.made[1]!.mark!
    expect(mark.getAttribute('role')).toBe('button')
    expect(mark.getAttribute('aria-label')).toBe('Stack the pipe here')
    mark.click()
    expect(onPlaceTap).toHaveBeenCalledWith('plain')
    expect(OverlayStub.preventMapHitsFrom).toHaveBeenCalledWith(mark)
    // A key works as a press does.
    mark.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(onPlaceTap).toHaveBeenCalledTimes(2)
  })

  it('reads the caller’s newest press without making the marks again', () => {
    const first = vi.fn()
    const second = vi.fn()
    // One list, kept, as a caller keeps it. Only the press is new.
    const places = [PLAIN]
    const { rerender } = mount({ places, onPlaceTap: first })
    const made = OverlayStub.made.length
    rerender({ places, onPlaceTap: second })
    expect(OverlayStub.made).toHaveLength(made)
    OverlayStub.made[0]!.mark!.click()
    expect(second).toHaveBeenCalledWith('plain')
    expect(first).not.toHaveBeenCalled()
  })

  it('is not a press at all for a caller that takes none', () => {
    mount({ places: [PLAIN] })
    const mark = OverlayStub.made[0]!.mark!
    expect(mark.getAttribute('role')).toBeNull()
    expect(mark.style.pointerEvents).toBe('none')
  })

  it('takes every mark off when it leaves', () => {
    const { view } = mount({ places: [GATE, PLAIN], onPlaceTap: () => {} })
    view.unmount()
    for (const o of OverlayStub.made) expect(o.mark).toBeNull()
  })
})

describe('the person’s dot', () => {
  it('draws the dot with the ring of how sure the phone was', () => {
    mount({ me: { lat: 29.55, lng: -98.3, accuracyM: 12 } })
    expect(CircleStub.made).toHaveLength(1)
    expect(CircleStub.made[0]?.opts.radius).toBe(12)
    expect(CircleStub.made[0]?.opts.clickable).toBe(false)
    const dot = OverlayStub.made.map((o) => o.mark).find((m) => m?.dataset.paintedMark === 'me')
    expect(dot).toBeTruthy()
    expect(dot?.style.pointerEvents).toBe('none')
  })

  it('draws no ring when the phone did not say how sure it was', () => {
    mount({ me: { lat: 29.55, lng: -98.3, accuracyM: null } })
    expect(CircleStub.made).toHaveLength(0)
    expect(OverlayStub.made).toHaveLength(1)
  })

  it('goes when the person does', () => {
    const { rerender } = mount({ me: { lat: 29.55, lng: -98.3, accuracyM: 12 } })
    rerender({ me: null })
    expect(CircleStub.made[0]?.on).toBeNull()
    expect(OverlayStub.made[0]?.mark).toBeNull()
  })
})

describe('a rough reading (punch list #402)', () => {
  const ROUGH = { lat: 29.55, lng: -98.3, accuracyM: 3200, area: true }
  const SURE = { lat: 29.5501, lng: -98.2999, accuracyM: 6 }

  it('draws an area as its whole circle, dashed, with no dot in its middle', () => {
    mount({ me: ROUGH })
    // The circle is fill alone, and the dashed edge is a line run round it.
    expect(CircleStub.made).toHaveLength(1)
    expect(CircleStub.made[0]?.opts.radius).toBe(3200)
    expect(CircleStub.made[0]?.opts.strokeOpacity).toBe(0)
    expect(CircleStub.made[0]?.opts.fillOpacity).toBe(0.18)
    const edge = PolylineStub.made.find((l) => (l.opts.icons as Array<{ repeat: string }> | undefined)?.[0]?.repeat === '12px')
    expect(edge).toBeTruthy()
    expect(edge?.opts.path).toHaveLength(73)
    expect(OverlayStub.made.map((o) => o.mark).filter((m) => m?.dataset.paintedMark === 'me')).toHaveLength(0)
  })

  it('draws a spot as it always was, and takes the area away when the phone finds the person', () => {
    const { rerender } = mount({ me: ROUGH })
    const area = [...CircleStub.made, ...PolylineStub.made]
    rerender({ me: SURE })
    for (const shape of area) expect(shape.on).toBeNull()
    const spot = CircleStub.made[CircleStub.made.length - 1]
    expect(spot?.opts.strokeOpacity).toBe(1)
    expect(spot?.opts.fillOpacity).toBe(0.15)
    expect(OverlayStub.made.map((o) => o.mark).filter((m) => m?.dataset.paintedMark === 'me')).toHaveLength(1)
  })

  it('pulls back to the whole circle with frameMargin, then comes in to the person on the first sure reading', () => {
    const { rerender } = mount({ lines: [DRAWN], me: ROUGH, frameMargin: true })
    const box = areaBox(ROUGH, DRAWN.points)!
    const fit = paintedFitView([{ lat: box.south, lng: box.west }, { lat: box.north, lng: box.east }], { width: 600, height: 400 }, MARGIN_FRAME_PADDING_PX)
    expect(lib.moves).toEqual([fit])
    // The wait: the caller hands no reading, and nothing moves.
    rerender({ lines: [DRAWN], me: null, frameMargin: true })
    expect(lib.moves).toHaveLength(1)
    rerender({ lines: [DRAWN], me: SURE, frameMargin: true })
    expect(lib.moves[1]).toEqual({ center: { lat: SURE.lat, lng: SURE.lng }, zoom: MARGIN_FRAME_ZOOM })
  })

  it('leaves the circle alone while it still shows, and fits it again to a box that got shorter in this draw', () => {
    const { rerender } = mount({ lines: [DRAWN], me: ROUGH, frameMargin: true })
    expect(lib.moves).toHaveLength(1)
    // A new reading of the same area, the box as it was: the whole circle still shows, so nothing moves.
    rerender({ lines: [DRAWN], me: { ...ROUGH, accuracyM: 3150 }, frameMargin: true })
    expect(lib.moves).toHaveLength(1)
    // The panel beside the map grows, and the map's box is much shorter in the same draw that hands in a reading.
    lib.box = { width: 600, height: 150 }
    rerender({ lines: [DRAWN], me: { ...ROUGH, accuracyM: 3100 }, frameMargin: true })
    expect(lib.moves).toHaveLength(2)
    const box = areaBox({ ...ROUGH, accuracyM: 3100 }, DRAWN.points)!
    expect(lib.moves[1]).toEqual(paintedFitView([{ lat: box.south, lng: box.west }, { lat: box.north, lng: box.east }], { width: 600, height: 150 }, MARGIN_FRAME_PADDING_PX))
  })

  it('moves nothing for a rough reading without frameMargin', () => {
    mount({ lines: [DRAWN], me: ROUGH })
    expect(lib.moves).toHaveLength(0)
  })
})

describe('a line drawn by hand (step 3)', () => {
  const A = { lat: 29.55, lng: -98.3 }
  const B = { lat: 29.551, lng: -98.299 }
  const C = { lat: 29.552, lng: -98.2985 }
  const draftOf = (points: Array<{ lat: number; lng: number }>, over: Partial<PaintedCanvasDraft> = {}): PaintedCanvasDraft => ({ points, picked: null, targets: [], onAdd: vi.fn(), onMove: vi.fn(), onInsert: vi.fn(), onPick: vi.fn(), ...over })
  const event = (lat: number, lng: number) => ({ latLng: { lat: () => lat, lng: () => lng } })
  const corners = () => MarkerStub.made.filter((m) => m.on !== null && m.opts.title === 'Drag to move this corner')
  const middles = () => MarkerStub.made.filter((m) => m.on !== null && m.opts.title === 'Drag to make a corner here')
  const iconOf = (m: MarkerStub) => decodeURIComponent((m.opts.icon as { url: string }).url)
  /** The line in hand: the two lines drawn over every saved one. */
  const inHand = () => PolylineStub.made.filter((l) => l.on !== null && (l.opts.zIndex as number) > 10)
  /** A pointer event on the map's box, or on the window for a move and a lift. */
  const pointer = (on: EventTarget, type: string, at: { x: number; y: number }, pointerType = 'touch', pointerId = 1) => {
    const e = new Event(type, { bubbles: true, cancelable: true })
    Object.assign(e, { clientX: at.x, clientY: at.y, pointerId })
    Object.defineProperty(e, 'pointerType', { value: pointerType })
    act(() => void on.dispatchEvent(e))
  }

  beforeEach(() => {
    ;(globalThis as unknown as { google: { maps: Record<string, unknown> } }).google.maps.Map = GlassMapStub
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('draws a corner at each point and a small dot in the middle of each leg, each a marker a finger can drag', () => {
    mount({ draft: draftOf([A, B, C]) })
    expect(corners().map((m) => m.opts.position)).toEqual([A, B, C])
    expect(middles().map((m) => m.opts.position)).toEqual([
      { lat: (A.lat + B.lat) / 2, lng: (A.lng + B.lng) / 2 },
      { lat: (B.lat + C.lat) / 2, lng: (B.lng + C.lng) / 2 },
    ])
    for (const m of [...corners(), ...middles()]) expect(m.opts.draggable).toBe(true)
    // A corner is over a middle, so a finger on both takes the corner.
    expect(corners()[0]?.opts.zIndex as number).toBeGreaterThan(middles()[0]?.opts.zIndex as number)
    // Two presses on a line being drawn are two corners, not a zoom.
    expect(lib.mapProps?.disableDoubleClickZoom).toBe(true)
  })

  it('rings the picked corner in purple and the others in ink', () => {
    mount({ draft: draftOf([A, B, C], { picked: 1 }) })
    expect(iconOf(corners()[1]!)).toContain('stroke="#7c3aed"')
    expect(iconOf(corners()[0]!)).not.toContain('#7c3aed')
  })

  it('draws the line in hand over every saved line, dashed as a line drawn by hand, and no line for one corner', () => {
    const { rerender } = mount({ lines: [DRAWN], draft: draftOf([A]) })
    expect(inHand()).toHaveLength(2)
    expect(inHand().every((l) => l.opts.path.length === 0)).toBe(true)
    rerender({ lines: [DRAWN], draft: draftOf([A, B]) })
    expect(inHand()).toHaveLength(2)
    expect(inHand()[0]?.opts.path).toEqual([A, B])
    // The paint is a dash repeated along a line that is not itself drawn.
    expect((inHand()[1]?.opts.icons as unknown[] | undefined)?.length).toBe(1)
  })

  it('adds a corner where the map is pressed, and lets go of any picked corner', () => {
    const draft = draftOf([A, B], { picked: 0 })
    mount({ draft })
    act(() => lib.listeners.click?.(event(29.553, -98.297)))
    expect(draft.onPick).toHaveBeenCalledWith(null)
    expect(draft.onAdd).toHaveBeenCalledWith({ lat: 29.553, lng: -98.297 })
  })

  it('picks a pressed corner, lets it go on a second press, and takes neither press for a new corner', () => {
    const draft = draftOf([A, B])
    const { rerender } = mount({ draft })
    act(() => corners()[1]!.fire('click', event(B.lat, B.lng)))
    expect(draft.onPick).toHaveBeenLastCalledWith(1)
    // Google tells the map of the same press a moment after.
    act(() => lib.listeners.click?.(event(B.lat, B.lng)))
    expect(draft.onAdd).not.toHaveBeenCalled()
    const picked = draftOf([A, B], { picked: 1 })
    rerender({ draft: picked })
    act(() => corners()[1]!.fire('click', event(B.lat, B.lng)))
    expect(picked.onPick).toHaveBeenLastCalledWith(null)
  })

  it('moves a dragged corner: the line follows the finger, and the caller is told when it lifts', () => {
    const draft = draftOf([A, B, C])
    const onLive = vi.fn()
    mount({ draft, onLive })
    const to = { lat: 29.5512, lng: -98.2987 }
    act(() => corners()[1]!.fire('dragstart', event(B.lat, B.lng)))
    act(() => corners()[1]!.fire('drag', event(to.lat, to.lng)))
    expect(onLive).toHaveBeenLastCalledWith({ kind: 'move', index: 1, point: to, caught: null })
    expect(inHand()[0]?.opts.path).toEqual([A, to, C])
    expect(draft.onMove).not.toHaveBeenCalled()
    act(() => corners()[1]!.fire('dragend', event(to.lat, to.lng)))
    expect(draft.onMove).toHaveBeenCalledWith(1, to)
    expect(onLive).toHaveBeenLastCalledWith(null)
    // The lift is not also a press on the map.
    act(() => lib.listeners.click?.(event(to.lat, to.lng)))
    expect(draft.onAdd).not.toHaveBeenCalled()
  })

  it('makes a corner in a leg when the dot in its middle is dragged', () => {
    const draft = draftOf([A, B, C])
    mount({ draft })
    const to = { lat: 29.5507, lng: -98.2992 }
    act(() => middles()[0]!.fire('drag', event(to.lat, to.lng)))
    expect(inHand()[0]?.opts.path).toEqual([A, to, B, C])
    act(() => middles()[0]!.fire('dragend', event(to.lat, to.lng)))
    expect(draft.onInsert).toHaveBeenCalledWith(0, to)
  })

  it('catches the end of another line, lands the corner on it, and says what it caught', () => {
    const end = { id: 'end', lat: 29.553, lng: -98.297, label: 'the end of line 1' }
    const draft = draftOf([A, B], { targets: [end] })
    const onLive = vi.fn()
    mount({ draft, onLive })
    act(() => corners()[1]!.fire('drag', event(29.55302, -98.297)))
    expect(onLive).toHaveBeenLastCalledWith({ kind: 'move', index: 1, point: { lat: end.lat, lng: end.lng }, caught: end })
    act(() => corners()[1]!.fire('dragend', event(29.55302, -98.297)))
    expect(draft.onMove).toHaveBeenCalledWith(1, { lat: end.lat, lng: end.lng })
  })

  it('makes its corners again when the line changes, and takes the old ones off', () => {
    const { rerender } = mount({ draft: draftOf([A, B]) })
    const before = [...corners(), ...middles()]
    rerender({ draft: draftOf([A, B, C]) })
    for (const m of before) expect(m.on).toBeNull()
    expect(corners()).toHaveLength(3)
    expect(middles()).toHaveLength(2)
  })

  it('places a corner under the glass when a finger is held still, then slid, and stops the map moving under it', () => {
    vi.useFakeTimers()
    const draft = draftOf([A, B])
    const onLive = vi.fn()
    mount({ draft, onLive })
    // The middle of the 600 by 400 box is the middle of the view: 29.55, -98.3.
    pointer(lib.div, 'pointerdown', { x: 300, y: 200 })
    act(() => vi.advanceTimersByTime(379))
    expect(onLive).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(lib.options).toContainEqual({ gestureHandling: 'none' })
    const first = onLive.mock.calls[0]?.[0] as { kind: string; point: { lat: number; lng: number } }
    expect(first.kind).toBe('add')
    expect(first.point.lat).toBeCloseTo(29.55, 6)
    expect(first.point.lng).toBeCloseTo(-98.3, 6)
    expect(document.querySelector('[data-painted-glass]')).not.toBeNull()
    // Slid to the right: the corner goes east, and the line in hand reaches for it.
    pointer(window, 'pointermove', { x: 340, y: 200 })
    const slid = onLive.mock.calls[onLive.mock.calls.length - 1]?.[0] as { point: { lat: number; lng: number } }
    expect(slid.point.lng).toBeGreaterThan(-98.3)
    expect(inHand()[0]?.opts.path).toHaveLength(3)
    pointer(window, 'pointerup', { x: 340, y: 200 })
    expect(draft.onAdd).toHaveBeenCalledTimes(1)
    expect((draft.onAdd as ReturnType<typeof vi.fn>).mock.calls[0]?.[0].lng).toBeCloseTo(slid.point.lng, 9)
    expect(onLive).toHaveBeenLastCalledWith(null)
    // The map moves under a finger again, and the lift is not also a press on the map.
    expect(lib.options[lib.options.length - 1]).toEqual({ gestureHandling: 'greedy' })
    act(() => lib.listeners.click?.(event(29.55, -98.3)))
    expect(draft.onAdd).toHaveBeenCalledTimes(1)
  })

  it('takes a press that slides before the hold for a drag of the map, and a second finger for a pinch', () => {
    vi.useFakeTimers()
    const onLive = vi.fn()
    mount({ draft: draftOf([A, B]), onLive })
    pointer(lib.div, 'pointerdown', { x: 300, y: 200 })
    pointer(window, 'pointermove', { x: 320, y: 200 })
    act(() => vi.advanceTimersByTime(1000))
    expect(onLive).not.toHaveBeenCalled()
    pointer(window, 'pointerup', { x: 320, y: 200 })
    // Held, then a second finger comes down: the hold is over and nothing is placed.
    pointer(lib.div, 'pointerdown', { x: 300, y: 200 })
    act(() => vi.advanceTimersByTime(400))
    expect(onLive).toHaveBeenCalledTimes(1)
    pointer(lib.div, 'pointerdown', { x: 100, y: 100 }, 'touch', 2)
    expect(onLive).toHaveBeenLastCalledWith(null)
    expect(lib.options[lib.options.length - 1]).toEqual({ gestureHandling: 'greedy' })
  })

  it('never holds for a mouse, which places with a click, or for a press on a corner or one of Google’s buttons', () => {
    vi.useFakeTimers()
    const onLive = vi.fn()
    mount({ draft: draftOf([A, B]), onLive })
    pointer(lib.div, 'pointerdown', { x: 300, y: 200 }, 'mouse')
    act(() => vi.advanceTimersByTime(1000))
    expect(onLive).not.toHaveBeenCalled()
    // Google's marker is a box with a title inside the map's own box.
    const mark = document.createElement('div')
    mark.title = 'Drag to move this corner'
    lib.div.appendChild(mark)
    pointer(mark, 'pointerdown', { x: 300, y: 200 })
    act(() => vi.advanceTimersByTime(1000))
    expect(onLive).not.toHaveBeenCalled()
    expect(lib.options).toHaveLength(0)
  })

  it('shows the line in hand in the glass, with the move a finger is making', () => {
    mount({ draft: draftOf([A, B]) })
    const down = new Event('pointerdown', { bubbles: true })
    Object.defineProperty(down, 'pointerType', { value: 'touch' })
    Object.assign(down, { clientX: 5, clientY: 5, pointerId: 9 })
    const mark = document.createElement('div')
    mark.title = 'Drag to move this corner'
    lib.div.appendChild(mark)
    act(() => void mark.dispatchEvent(down))
    act(() => corners()[1]!.fire('drag', event(29.5511, -98.2989)))
    const glass = document.querySelector('[data-painted-glass]')
    expect(glass).not.toBeNull()
    // The line in hand alone: its dark edge and its dashes.
    expect(glass?.querySelectorAll('polyline')).toHaveLength(2)
  })

  it('takes no press on the map for a corner while a finger is held, whenever Google says it', () => {
    // Google may tell the map it was pressed before this canvas hears the finger lift. The hold is quiet from its start.
    vi.useFakeTimers()
    const draft = draftOf([A, B])
    mount({ draft })
    pointer(lib.div, 'pointerdown', { x: 300, y: 200 })
    act(() => vi.advanceTimersByTime(380))
    act(() => lib.listeners.click?.(event(29.55, -98.3)))
    expect(draft.onAdd).not.toHaveBeenCalled()
    pointer(window, 'pointerup', { x: 300, y: 200 })
    expect(draft.onAdd).toHaveBeenCalledTimes(1)
  })

  it('gives a press to the corner Google gave it to: the corner’s own drag ends a hold the same press began', () => {
    vi.useFakeTimers()
    const draft = draftOf([A, B])
    const onLive = vi.fn()
    mount({ draft, onLive })
    pointer(lib.div, 'pointerdown', { x: 300, y: 200 })
    act(() => vi.advanceTimersByTime(380))
    expect(lib.options[lib.options.length - 1]).toEqual({ gestureHandling: 'none' })
    const to = { lat: 29.5512, lng: -98.2987 }
    act(() => corners()[1]!.fire('dragstart', event(to.lat, to.lng)))
    // The map moves under a finger again, and the move in hand is the corner's and not a new one.
    expect(lib.options[lib.options.length - 1]).toEqual({ gestureHandling: 'greedy' })
    expect(onLive).toHaveBeenLastCalledWith({ kind: 'move', index: 1, point: to, caught: null })
    act(() => corners()[1]!.fire('dragend', event(to.lat, to.lng)))
    pointer(window, 'pointerup', { x: 320, y: 180 })
    expect(draft.onMove).toHaveBeenCalledTimes(1)
    expect(draft.onAdd).not.toHaveBeenCalled()
  })

  it('never begins a hold for a press that turned out to be a press on a corner', () => {
    vi.useFakeTimers()
    const draft = draftOf([A, B])
    const onLive = vi.fn()
    mount({ draft, onLive })
    pointer(lib.div, 'pointerdown', { x: 300, y: 200 })
    act(() => vi.advanceTimersByTime(100))
    act(() => corners()[0]!.fire('click', event(A.lat, A.lng)))
    act(() => vi.advanceTimersByTime(1000))
    expect(onLive).not.toHaveBeenCalled()
    expect(lib.options).toHaveLength(0)
    expect(draft.onPick).toHaveBeenCalledWith(0)
    expect(draft.onAdd).not.toHaveBeenCalled()
  })

  it('lets go of everything when the drawing ends: its corners, its line, its listeners and the map’s own drag', () => {
    vi.useFakeTimers()
    const onLive = vi.fn()
    const { rerender } = mount({ draft: draftOf([A, B, C]), onLive })
    pointer(lib.div, 'pointerdown', { x: 300, y: 200 })
    act(() => vi.advanceTimersByTime(400))
    rerender({ draft: null })
    expect(corners()).toHaveLength(0)
    expect(middles()).toHaveLength(0)
    expect(inHand()).toHaveLength(0)
    expect(lib.removed).toEqual(expect.arrayContaining(['click', 'dragstart', 'drag', 'dragend']))
    // The hold that was under way gave the map back its drag.
    expect(lib.options[lib.options.length - 1]).toEqual({ gestureHandling: 'greedy' })
    const calls = onLive.mock.calls.length
    pointer(window, 'pointermove', { x: 350, y: 220 })
    pointer(window, 'pointerup', { x: 350, y: 220 })
    expect(onLive.mock.calls.length).toBe(calls)
  })
})

describe('a place’s dot, put down by hand (step 3)', () => {
  const AT = { lat: 29.5505, lng: -98.2995 }
  const dotAt = (point: { lat: number; lng: number }, over: Partial<PaintedCanvasDot> = {}): PaintedCanvasDot => ({ point, label: 'the gate', onMove: vi.fn(), ...over })
  const event = (lat: number, lng: number) => ({ latLng: { lat: () => lat, lng: () => lng } })
  const marker = () => MarkerStub.made[MarkerStub.made.length - 1]!
  /** A finger, or a mouse, comes down on the map. */
  const down = (pointerType: string) => {
    const e = new Event('pointerdown', { bubbles: true })
    Object.defineProperty(e, 'pointerType', { value: pointerType })
    act(() => void lib.div.dispatchEvent(e))
  }
  const glass = () => document.querySelector('[data-painted-glass]')

  // Google's own map class is on the page by the time a finger can place anything. The other cases leave it out, so a
  // canvas that has just come up still reads the page as waiting on Google's script.
  beforeEach(() => {
    ;(globalThis as unknown as { google: { maps: Record<string, unknown> } }).google.maps.Map = GlassMapStub
  })

  it('is one of Google’s markers a finger can drag, on its spot, named for the place', () => {
    mount({ dot: dotAt(AT) })
    expect(MarkerStub.made).toHaveLength(1)
    expect(marker().opts.position).toEqual(AT)
    expect(marker().opts.draggable).toBe(true)
    expect(marker().opts.title).toBe('Drag to place the gate')
    // Google would lift a dragged marker off its spot and draw a cross under it. The glass shows the spot instead.
    expect(marker().opts.crossOnDrag).toBe(false)
    // Its picture is the dot in a box a fingertip can find, its middle on the spot.
    const icon = marker().opts.icon as { url: string; anchor: { x: number; y: number }; scaledSize: { width: number } }
    expect(icon.url.startsWith('data:image/svg+xml')).toBe(true)
    expect(icon.scaledSize.width).toBe(44)
    expect(icon.anchor).toEqual({ x: 22, y: 22 })
    // Two presses on a dot being placed are two presses, not a zoom.
    expect(lib.mapProps?.disableDoubleClickZoom).toBe(true)
  })

  it('draws no marker and zooms on two presses when nothing is being placed', () => {
    mount()
    expect(MarkerStub.made).toHaveLength(0)
    expect(lib.mapProps?.disableDoubleClickZoom).toBe(false)
  })

  it('says where the finger is while it drags, and sets the dot where it lifts', () => {
    const dot = dotAt(AT)
    const onLive = vi.fn()
    mount({ dot, onLive })
    act(() => marker().fire('dragstart', event(29.5506, -98.2994)))
    act(() => marker().fire('drag', event(29.5507, -98.2993)))
    expect(onLive).toHaveBeenLastCalledWith({ kind: 'dot', point: { lat: 29.5507, lng: -98.2993 }, caught: null })
    expect(dot.onMove).not.toHaveBeenCalled()
    act(() => marker().fire('dragend', event(29.5508, -98.2992)))
    expect(dot.onMove).toHaveBeenCalledTimes(1)
    expect(dot.onMove).toHaveBeenCalledWith({ lat: 29.5508, lng: -98.2992 })
    expect(marker().position).toEqual({ lat: 29.5508, lng: -98.2992 })
    expect(onLive).toHaveBeenLastCalledWith(null)
  })

  it('brings the dot to a press on the map, for a dot that is a long drag away', () => {
    const dot = dotAt(AT)
    mount({ dot })
    act(() => lib.listeners.click?.(event(29.556, -98.29)))
    expect(dot.onMove).toHaveBeenCalledWith({ lat: 29.556, lng: -98.29 })
  })

  it('catches a target it nears, lands on it, and says what it caught', () => {
    const gate = { id: 'gate', lat: 29.55, lng: -98.3, label: 'Truck gate' }
    const dot = dotAt(AT, { targets: [gate] })
    const onLive = vi.fn()
    mount({ dot, onLive })
    // The map is at zoom 17: a catch reaches about 13 m, and this is about 2 m from the gate.
    act(() => marker().fire('drag', event(29.55002, -98.3)))
    expect(onLive).toHaveBeenLastCalledWith({ kind: 'dot', point: { lat: gate.lat, lng: gate.lng }, caught: gate })
    act(() => marker().fire('dragend', event(29.55002, -98.3)))
    expect(dot.onMove).toHaveBeenCalledWith({ lat: gate.lat, lng: gate.lng })
    // The marker is put on the gate, not left where the finger lifted.
    expect(marker().position).toEqual({ lat: gate.lat, lng: gate.lng })
  })

  it('follows the caller to a new spot with the same marker, and wears a new name', () => {
    const { rerender } = mount({ dot: dotAt(AT) })
    rerender({ dot: dotAt({ lat: 29.551, lng: -98.299 }, { label: 'the meter' }) })
    expect(MarkerStub.made).toHaveLength(1)
    expect(marker().position).toEqual({ lat: 29.551, lng: -98.299 })
    expect(marker().title).toBe('Drag to place the meter')
  })

  it('takes the marker and its listeners off when the placing ends', () => {
    const { rerender } = mount({ dot: dotAt(AT) })
    const m = marker()
    rerender({ dot: null })
    expect(m.on).toBeNull()
    expect(lib.removed).toEqual(expect.arrayContaining(['dragstart', 'drag', 'dragend', 'click']))
  })

  it('shows no glass to a mouse, which is already that exact', () => {
    mount({ lines: [DRAWN], dot: dotAt(AT) })
    down('mouse')
    act(() => marker().fire('drag', event(29.5506, -98.2994)))
    expect(glass()).toBeNull()
    expect(GlassMapStub.made).toHaveLength(0)
  })

  it('shows a finger the spot under it in the glass: the kept map, the lines and a place that is near', () => {
    mount({ lines: [DRAWN], places: [GATE, place({ id: 'far', number: 3, name: 'Far gate', lat: 29.6, lng: -98.2 })], dot: dotAt(AT) })
    down('touch')
    // On the gate, which is at 29.55, -98.3.
    act(() => marker().fire('drag', event(29.55001, -98.29999)))
    expect(glass()?.getAttribute('data-painted-glass')).toBe('open')
    expect(GlassMapStub.made).toHaveLength(1)
    // The picture is the glass's own view: the spot under the finger, two zoom steps in from the big map's 17.
    expect(GlassMapStub.made[0]?.moves[GlassMapStub.made[0].moves.length - 1]).toEqual({ center: { lat: 29.55001, lng: -98.29999 }, zoom: 19 })
    expect(glass()?.querySelector('[data-painted-glass-map]')?.contains(GlassMapStub.made[0]?.host ?? null)).toBe(true)
    // The drawn line: its dark edge and its dashes.
    expect(glass()?.querySelectorAll('polyline')).toHaveLength(2)
    expect(glass()?.querySelectorAll('[data-painted-glass-place]')).toHaveLength(1)
    act(() => marker().fire('dragend', event(29.55001, -98.29999)))
    expect(glass()).toBeNull()
  })

  /** The box that holds the glass's map: its size, and how much larger it is drawn. */
  const picture = () => {
    const box = glass()?.querySelector<HTMLElement>('[data-painted-glass-map]')
    return { scale: box?.getAttribute('data-glass-scale'), width: box?.style.width, transform: box?.style.transform }
  }

  it('draws the glass’s photograph as it is where Google’s goes two steps deeper: sharp, and no larger', () => {
    mount({ dot: dotAt(AT) })
    down('touch')
    act(() => marker().fire('drag', event(29.5506, -98.2994)))
    expect(GlassMapStub.made[0]?.zoom).toBe(19)
    // The whole glass, 132 px, is the map's own pixels.
    expect(picture()).toEqual({ scale: '1', width: '132px', transform: 'scale(1)' })
  })

  it('draws it larger only by the steps Google held back, where the photograph ends sooner', () => {
    // One step past the big map's 17, where the glass asks for 19.
    GlassMapStub.depth = 18
    mount({ dot: dotAt(AT) })
    down('touch')
    act(() => marker().fire('drag', event(29.5506, -98.2994)))
    expect(GlassMapStub.made[0]?.zoom).toBe(18)
    expect(picture()).toEqual({ scale: '2', width: '66px', transform: 'scale(2)' })
    // No deeper than the big map's own zoom: four times the size, as it was before the glass asked for more.
    GlassMapStub.depth = 17
    act(() => marker().fire('drag', event(29.5507, -98.2993)))
    expect(picture()).toEqual({ scale: '4', width: '33px', transform: 'scale(4)' })
  })

  it('follows Google when it changes the zoom it gave a moment after', () => {
    mount({ dot: dotAt(AT) })
    down('touch')
    act(() => marker().fire('drag', event(29.5506, -98.2994)))
    expect(picture().scale).toBe('1')
    act(() => GlassMapStub.made[0]?.settle(17))
    expect(picture()).toEqual({ scale: '4', width: '33px', transform: 'scale(4)' })
  })

  it('asks again while the finger rests on a spot Google held back, and sharpens when Google gives it', () => {
    vi.useFakeTimers()
    try {
      // A spot Google has not seen: it holds the glass's map back until it knows how deep its photograph goes there.
      GlassMapStub.depth = 17
      mount({ dot: dotAt(AT) })
      down('touch')
      act(() => marker().fire('drag', event(29.5506, -98.2994)))
      const map = GlassMapStub.made[0]!
      expect(picture().scale).toBe('4')
      const asks = map.moves.length
      // Now it knows. The finger has not moved.
      GlassMapStub.depth = 22
      act(() => vi.advanceTimersByTime(150))
      expect(map.moves).toHaveLength(asks + 1)
      expect(map.moves[map.moves.length - 1]).toEqual({ center: { lat: 29.5506, lng: -98.2994 }, zoom: 19 })
      expect(picture()).toEqual({ scale: '1', width: '132px', transform: 'scale(1)' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not trust the zoom Google says on new ground: it asks again, and draws by what Google then says', () => {
    vi.useFakeTimers()
    try {
      // The photograph ends at the big map's own 17, and Google has not drawn this ground before.
      GlassMapStub.depth = 17
      GlassMapStub.late = true
      mount({ dot: dotAt(AT) })
      down('touch')
      act(() => marker().fire('drag', event(29.5506, -98.2994)))
      const map = GlassMapStub.made[0]!
      // It says the zoom it was asked for, though it draws two steps short of it.
      expect(map.zoom).toBe(19)
      expect(picture().scale).toBe('1')
      // The finger rests. The glass asks again by the clock, Google says what it took, and the picture is drawn by that.
      act(() => vi.advanceTimersByTime(150))
      expect(map.zoom).toBe(17)
      expect(picture()).toEqual({ scale: '4', width: '33px', transform: 'scale(4)' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('asks again when the map’s pictures have come in, however slow the signal', () => {
    vi.useFakeTimers()
    try {
      mount({ dot: dotAt(AT) })
      down('touch')
      act(() => marker().fire('drag', event(29.5506, -98.2994)))
      const map = GlassMapStub.made[0]!
      // Every ask by the clock has gone by, and Google still says the zoom it was asked for.
      act(() => vi.advanceTimersByTime(10_000))
      expect(picture().scale).toBe('1')
      const asks = map.moves.length
      // It has drawn one step short of that all along. Its pictures come in, the glass asks, and Google says so.
      GlassMapStub.depth = 18
      act(() => map.drawn())
      expect(map.moves).toHaveLength(asks + 1)
      expect(picture()).toEqual({ scale: '2', width: '66px', transform: 'scale(2)' })
      // A map that says its pictures came in after every ask is asked twice for a spot, and no more.
      act(() => map.drawn())
      act(() => map.drawn())
      act(() => map.drawn())
      expect(map.moves).toHaveLength(asks + 2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('stops asking: a few times for a rest of the finger, and not at all once the glass is down', () => {
    vi.useFakeTimers()
    try {
      mount({ dot: dotAt(AT) })
      down('touch')
      act(() => marker().fire('drag', event(29.5506, -98.2994)))
      const map = GlassMapStub.made[0]!
      const asks = map.moves.length
      act(() => vi.advanceTimersByTime(60_000))
      expect(map.moves).toHaveLength(asks + 3)
      // A new spot under the finger, then the finger lifts before the first ask again is due.
      act(() => marker().fire('drag', event(29.5507, -98.2993)))
      const moved = map.moves.length
      act(() => marker().fire('dragend', event(29.5507, -98.2993)))
      act(() => vi.advanceTimersByTime(60_000))
      expect(map.moves).toHaveLength(moved)
      // The glass no longer listens to its map: not for its zoom, and not for its pictures coming in.
      expect(lib.removed).toEqual(expect.arrayContaining(['glass-zoom_changed', 'glass-tilesloaded']))
    } finally {
      vi.useRealTimers()
    }
  })

  it('makes the glass’s map once for the page, however many drags and painted maps follow', () => {
    const first = mount({ dot: dotAt(AT) })
    down('touch')
    act(() => marker().fire('drag', event(29.5506, -98.2994)))
    act(() => marker().fire('dragend', event(29.5506, -98.2994)))
    act(() => marker().fire('drag', event(29.5507, -98.2993)))
    expect(glass()).not.toBeNull()
    act(() => marker().fire('dragend', event(29.5507, -98.2993)))
    first.view.unmount()
    // Another painted map, later on the same page.
    mount({ dot: dotAt(AT) })
    down('touch')
    act(() => marker().fire('drag', event(29.5506, -98.2994)))
    expect(glass()).not.toBeNull()
    expect(GlassMapStub.made).toHaveLength(1)
  })

  it('keeps one glass map for each look, however often the theme goes back and forth', () => {
    document.documentElement.dataset.theme = 'dark'
    try {
      const { rerender } = mount({ dot: dotAt(AT) })
      down('touch')
      const dragOnce = () => {
        act(() => marker().fire('drag', event(29.5506, -98.2994)))
        act(() => marker().fire('dragend', event(29.5506, -98.2994)))
      }
      dragOnce()
      expect(GlassMapStub.made.map((g) => g.opts.colorScheme)).toEqual(['DARK'])
      rerender({ dot: dotAt(AT), light: true })
      dragOnce()
      expect(GlassMapStub.made.map((g) => g.opts.colorScheme)).toEqual(['DARK', 'LIGHT'])
      rerender({ dot: dotAt(AT), light: false })
      dragOnce()
      rerender({ dot: dotAt(AT), light: true })
      dragOnce()
      expect(GlassMapStub.made).toHaveLength(2)
    } finally {
      delete document.documentElement.dataset.theme
    }
  })

  it('leaves no glass up when the placing ends with a finger still down', () => {
    const onLive = vi.fn()
    const { rerender } = mount({ dot: dotAt(AT), onLive })
    down('touch')
    act(() => marker().fire('drag', event(29.5506, -98.2994)))
    expect(glass()).not.toBeNull()
    rerender({ dot: null, onLive })
    expect(onLive).toHaveBeenLastCalledWith(null)
    expect(glass()).toBeNull()
  })

  it('rings the glass green when the dot has caught a target', () => {
    const gate = { id: 'gate', lat: 29.55, lng: -98.3, label: 'Truck gate' }
    mount({ dot: dotAt(AT, { targets: [gate] }) })
    down('touch')
    act(() => marker().fire('drag', event(29.55002, -98.3)))
    expect(glass()?.getAttribute('data-painted-glass')).toBe('caught')
  })
})

describe('a walk being painted (step 3)', () => {
  // The walk so far, and the same walk one reading later: a new list and a new line, around the same points.
  const STEP_1 = { lat: 29.556, lng: -98.294 }
  const STEP_2 = { lat: 29.5561, lng: -98.2939 }
  const STEP_3 = { lat: 29.5562, lng: -98.2938 }
  const walk = (points: Array<{ lat: number; lng: number }>): PaintedCanvasLine => ({ id: 'walk-0', how: 'walked', poorParts: [], points })
  const on = () => PolylineStub.made.filter((l) => l.on !== null)

  it('draws only the line that grew, and leaves the saved lines beside it as they are', () => {
    const { rerender } = mount({ lines: [DRAWN, walk([STEP_1, STEP_2])] })
    const saved = PolylineStub.made.filter((l) => l.opts.path[0]?.lat === DRAWN.points[0]?.lat)
    const first = PolylineStub.made.filter((l) => !saved.includes(l))
    expect(saved.length).toBeGreaterThan(0)
    expect(first.length).toBeGreaterThan(0)
    const madeBefore = PolylineStub.made.length
    // The window builds its list again on every reading: a new object for each line, the saved line's points the same.
    rerender({ lines: [{ ...DRAWN }, walk([STEP_1, STEP_2, STEP_3])] })
    for (const l of saved) expect(l.on).not.toBeNull()
    for (const l of first) expect(l.on).toBeNull()
    const grown = PolylineStub.made.slice(madeBefore)
    expect(grown).toHaveLength(first.length)
    expect(grown[0]?.opts.path).toHaveLength(3)
    expect(on()).toHaveLength(saved.length + grown.length)
  })

  it('draws nothing again for a reading that changed no line', () => {
    const points = [STEP_1, STEP_2]
    const { rerender } = mount({ lines: [DRAWN, walk(points)] })
    const madeBefore = PolylineStub.made.length
    // A copy of the same points, as the window hands a walk waiting to be looked over.
    rerender({ lines: [{ ...DRAWN }, walk(points.slice())] })
    expect(PolylineStub.made).toHaveLength(madeBefore)
  })

  it('takes a line off when it leaves the list, and every line when the canvas leaves', () => {
    const { rerender, view } = mount({ lines: [DRAWN, walk([STEP_1, STEP_2])] })
    rerender({ lines: [DRAWN] })
    expect(on().every((l) => l.opts.path[0]?.lat === DRAWN.points[0]?.lat)).toBe(true)
    expect(on().length).toBeGreaterThan(0)
    view.unmount()
    expect(on()).toHaveLength(0)
  })

  it('draws a line again when it turns from walked to fixed by hand, or gains an unsure stretch', () => {
    const points = [STEP_1, STEP_2, STEP_3]
    const { rerender } = mount({ lines: [walk(points)] })
    const madeBefore = PolylineStub.made.length
    rerender({ lines: [{ ...walk(points), poorParts: [[1, 2]] }] })
    expect(PolylineStub.made.length).toBeGreaterThan(madeBefore)
  })

  it('leaves the map alone while the walker is in its middle, and slides to them when they near its edge', () => {
    // The map is on 29.55, -98.3 at zoom 17 in a 600 by 400 box: its middle is the box less 100 px all round.
    const middle = { lat: 29.55, lng: -98.3, accuracyM: 6 }
    const { rerender } = mount({ lines: [DRAWN], me: middle, follow: true })
    expect(lib.pans).toHaveLength(0)
    const nearEdge = { lat: 29.55, lng: -98.2978, accuracyM: 6 }
    rerender({ lines: [DRAWN], me: nearEdge, follow: true })
    expect(lib.pans).toEqual([{ lat: nearEdge.lat, lng: nearEdge.lng }])
    // Now they are the middle, and a step on moves nothing.
    rerender({ lines: [DRAWN], me: { ...nearEdge, lat: 29.55005 }, follow: true })
    expect(lib.pans).toHaveLength(1)
  })

  it('never slides without follow, and never to the middle of an area', () => {
    const away = { lat: 29.56, lng: -98.29, accuracyM: 6 }
    const { rerender } = mount({ lines: [DRAWN], me: away })
    expect(lib.pans).toHaveLength(0)
    rerender({ lines: [DRAWN], me: { ...away, accuracyM: 3200, area: true }, follow: true })
    expect(lib.pans).toHaveLength(0)
  })
})

describe('a reader and the line together (step 4, the public page)', () => {
  const BOX = { width: 600, height: 400 }
  // Off the map's first picture, which opens on the line.
  const AWAY = { lat: 29.556, lng: -98.292, accuracyM: 6 }

  it('frames the whole map with the reader on the first reading, by the kernel’s own numbers', () => {
    mount({ lines: [DRAWN], places: [GATE], me: AWAY, frameMe: true })
    expect(lib.moves).toEqual([paintedFitView([...DRAWN.points, GATE, AWAY], BOX)])
  })

  it('leaves the map as the reader has it while their dot is well inside, and frames again at its edge', () => {
    const { rerender } = mount({ lines: [DRAWN], me: AWAY, frameMe: true })
    expect(lib.moves).toHaveLength(1)
    // A step along the way: the dot is still well inside what the map shows.
    rerender({ lines: [DRAWN], me: { ...AWAY, lat: AWAY.lat - 0.0005 }, frameMe: true })
    expect(lib.moves).toHaveLength(1)
    // Off the picture altogether.
    const gone = { ...AWAY, lat: 29.59 }
    rerender({ lines: [DRAWN], me: gone, frameMe: true })
    expect(lib.moves).toHaveLength(2)
    expect(lib.moves[1]).toEqual(paintedFitView([...DRAWN.points, gone], BOX))
  })

  it('reads the box as it is now, not as the map last measured it', () => {
    lib.box = { width: 360, height: 360 }
    mount({ lines: [DRAWN], me: AWAY, frameMe: true })
    expect(lib.moves).toEqual([paintedFitView([...DRAWN.points, AWAY], { width: 360, height: 360 })])
  })

  it('moves nothing without frameMe: the painting window never asks for it', () => {
    mount({ lines: [DRAWN], me: AWAY })
    expect(lib.moves).toHaveLength(0)
  })

  it('never frames an area as if it were a spot', () => {
    mount({ lines: [DRAWN], me: { ...AWAY, accuracyM: 3200, area: true }, frameMe: true })
    expect(lib.moves).toHaveLength(0)
  })
})

describe('moving when asked', () => {
  it('frames everything again when the number changes, and not when the map opens', () => {
    const { rerender } = mount({ lines: [DRAWN, WALKED], places: [GATE], refit: 0 })
    expect(lib.moves).toHaveLength(0)
    rerender({ lines: [DRAWN, WALKED], places: [GATE], refit: 1 })
    expect(lib.moves).toEqual([paintedFitView([...ALL_POINTS, GATE], { width: 600, height: 400 })])
  })

  it('goes where the caller says, close', () => {
    const { rerender } = mount()
    const there = { lat: 29.7, lng: -98.1 }
    rerender({ flyTo: there })
    expect(lib.moves).toEqual([{ center: there, zoom: PAINTED_POINT_ZOOM }])
  })

  it('does not fly back to a place it was taken to before this canvas came up', () => {
    const before = { lat: 29.7, lng: -98.1 }
    const carried = { center: { lat: 29.5533, lng: -98.2966 }, zoom: 20 }
    const { rerender } = mount({ openOn: carried, flyTo: before })
    expect(lib.moves).toHaveLength(0)
    // A new place asked for afterwards is flown to.
    const next = { lat: 29.8, lng: -98.0 }
    rerender({ openOn: carried, flyTo: next })
    expect(lib.moves).toEqual([{ center: next, zoom: PAINTED_POINT_ZOOM }])
  })

  it('flies to a place asked for before it opened when no view was carried', () => {
    const there = { lat: 29.7, lng: -98.1 }
    mount({ flyTo: there })
    expect(lib.moves).toEqual([{ center: there, zoom: PAINTED_POINT_ZOOM }])
  })
})

describe('saying where it looks', () => {
  it('says so when it opens and each time it settles, with its zoom for the other canvas', () => {
    const onView = vi.fn()
    const onCamera = vi.fn()
    mount({ onView, onCamera })
    expect(onView).toHaveBeenCalledWith({ lat: 29.55, lng: -98.3 })
    expect(onCamera).toHaveBeenCalledWith({ center: { lat: 29.55, lng: -98.3 }, zoom: 17 })
    act(() => lib.listeners.idle?.())
    expect(onView).toHaveBeenCalledTimes(2)
  })

  it('stops listening when it leaves', () => {
    const { view } = mount({ onView: () => {} })
    view.unmount()
    expect(lib.removed).toContain('idle')
  })
})

describe('while Google’s script is on its way', () => {
  const words = () => document.querySelector('[data-painted-google-loading]')

  it('the frame says it is loading, and stops saying so when the script is in', () => {
    // Seen on a slow script (2026-11-20): a blank white box for the ten seconds before the other map came up.
    lib.loads = false
    mount({ lines: [DRAWN], framed: DRAWN.points })
    expect(words()?.textContent).toBe('Loading the map…')
    expect(words()?.getAttribute('role')).toBe('status')
    act(() => lib.load())
    expect(words()).toBeNull()
  })

  it('a script that is already in says nothing', () => {
    mount()
    expect(words()).toBeNull()
  })

  it('draws the lines and the places for the wait, and says it is loading under them (punch list #387)', () => {
    lib.loads = false
    mount({ lines: [DRAWN], places: [PLAIN], framed: DRAWN.points })
    expect(document.querySelector('[data-painted-wait-sketch]')).not.toBeNull()
    // At the bottom, in the room the first view keeps clear, so the words never sit on a line.
    expect((words() as HTMLElement).style.alignItems).toBe('flex-end')
  })

  it('an empty map keeps the words in the middle of its frame', () => {
    lib.loads = false
    mount()
    expect((words() as HTMLElement).style.alignItems).toBe('center')
  })
})

describe('its doors to Leaflet', () => {
  it('hears Google refuse the key, as every Google canvas does', () => {
    const { onUnavailable } = mount()
    act(() => (window as Window & { gm_authFailure?: () => void }).gm_authFailure?.())
    expect(onUnavailable).toHaveBeenCalledWith('auth: Google rejected the browser key for this page')
  })
})
