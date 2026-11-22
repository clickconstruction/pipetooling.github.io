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

type Listener = () => void
/** The map the library hands the canvas, and what the canvas handed the library's Map. */
const lib = vi.hoisted(() => ({
  mapProps: null as null | Record<string, unknown>,
  moves: [] as Array<{ center?: { lat: number; lng: number }; zoom?: number }>,
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
  getDiv: () => ({ clientWidth: lib.box.width, clientHeight: lib.box.height }),
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

import type { PaintedCanvasLine, PaintedCanvasPlace } from './PaintedMapCanvas'
import PaintedMapGoogleCanvas, { type PaintedMapGoogleCanvasProps } from './PaintedMapGoogleCanvas'
import { GOOGLE_MAP_STYLES } from '../../lib/map/googleMapLook'

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
  lib.listeners = {}
  lib.removed.length = 0
  lib.camera = { center: { lat: 29.55, lng: -98.3 }, zoom: 17 }
  lib.box = { width: 600, height: 400 }
  PolylineStub.made = []
  CircleStub.made = []
  OverlayStub.made = []
  OverlayStub.preventMapHitsFrom.mockClear()
  vi.stubGlobal('google', { maps: { Polyline: PolylineStub, Circle: CircleStub, OverlayView: OverlayStub, LatLng: LatLngStub, event: { removeListener: (handle: unknown) => lib.removed.push(handle) } } })
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
