// @vitest-environment jsdom
/**
 * The drawing a painted map shows while Google's map is on its way (punch list #387), with the Maps
 * library stood in: what it draws and where, that a place can be pressed, and each way it goes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { placeSaysWords } from '../../lib/paintedMap/paintedPlaceKind'
import { sketchSpot } from '../../lib/paintedMap/paintedWaitSketch'

type Listener = () => void
/** The map the library hands the drawing: none until a case says Google's map is made. */
const lib = vi.hoisted(() => ({
  map: null as null | { addListener: (name: string, fn: () => void) => string },
  listeners: {} as Record<string, Array<() => void>>,
  removed: [] as unknown[],
}))
vi.mock('@vis.gl/react-google-maps', () => ({ useMap: () => lib.map }))

import type { PaintedCanvasLine, PaintedCanvasPlace } from './PaintedMapCanvas'
import { PaintedWaitSketch, WAIT_SKETCH_LINGER_MS, type PaintedWaitSketchProps } from './PaintedWaitSketch'

const BOX = { width: 390, height: 560 }
// A made-up site on public ground: a walked line with a stretch the phone was not sure of, a line drawn by hand, three places.
const A = { lat: 29.42585, lng: -98.48615 }
const B = { lat: 29.42775, lng: -98.48985 }
const WALKED: PaintedCanvasLine = { id: 'walked', how: 'walked', poorParts: [[1, 2]], points: [B, { lat: 29.42745, lng: -98.4889 }, { lat: 29.4271, lng: -98.4875 }, A] }
const DRAWN: PaintedCanvasLine = { id: 'drawn', how: 'drawn', poorParts: [], points: [A, { lat: 29.4254, lng: -98.4874 }] }
const place = (over: Partial<PaintedCanvasPlace> & Pick<PaintedCanvasPlace, 'id' | 'number' | 'name' | 'lat' | 'lng'>): PaintedCanvasPlace => ({ mapId: 'map', words: '', accuracyM: null, photoPath: null, kind: null, setBy: null, setAt: '2026-11-21T12:00:00Z', ...over }) as PaintedCanvasPlace
const METER = place({ id: 'meter', number: 1, name: 'ZZ Test meter', ...B })
const GATE = place({ id: 'gate', number: 2, name: 'ZZ Test north side', kind: 'gate', ...A })
const FROM_JOB = place({ id: 'job', number: 1, letter: 'A', fromJob: true, name: 'ZZ Test shutoff', lat: 29.4254, lng: -98.4874 })
const VIEW = { center: { lat: 29.4268, lng: -98.488 }, zoom: 16 }

const sketch = () => document.querySelector('[data-painted-wait-sketch]')
const spot = (id: string) => document.querySelector<HTMLButtonElement>(`[data-painted-wait-place="${id}"]`)

function mount(over: Partial<PaintedWaitSketchProps> = {}) {
  const props: PaintedWaitSketchProps = { view: VIEW, loaded: false, lines: [WALKED, DRAWN], places: [METER, GATE, FROM_JOB], ...over }
  const view = render(<PaintedWaitSketch {...props} />)
  return { view, rerender: (next: Partial<PaintedWaitSketchProps>) => view.rerender(<PaintedWaitSketch {...props} {...next} />) }
}

/** Google's map is made: the library hands it to the drawing from the next draw on. */
function makeMap() {
  lib.map = {
    addListener: (name: string, fn: Listener) => {
      ;(lib.listeners[name] ??= []).push(fn)
      return name
    },
  }
}

beforeEach(() => {
  lib.map = null
  lib.listeners = {}
  lib.removed = []
  // The frame's own size: jsdom lays nothing out.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: BOX.width, bottom: BOX.height, width: BOX.width, height: BOX.height, toJSON: () => ({}) })
  // Google's script is not on the page: it has events to let go of and no map code yet.
  vi.stubGlobal('google', { maps: { event: { removeListener: (handle: unknown) => lib.removed.push(handle) } } })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('what it draws while Google’s script is on its way', () => {
  it('every line at once: a walked line solid, its unsure stretch as faint dots, a line drawn by hand dashed', () => {
    mount()
    const sure = document.querySelectorAll('[data-sketch-look="sure"]')
    const drawn = document.querySelectorAll('[data-sketch-look="drawn"]')
    const poor = document.querySelectorAll('[data-sketch-look="poor"]')
    expect(sure).toHaveLength(2)
    expect(drawn).toHaveLength(1)
    expect(poor).toHaveLength(1)
    // The dark edge under the paint, as both maps stroke a line.
    const [edge, paint] = [...sure[0]!.querySelectorAll('path')]
    expect(edge?.getAttribute('stroke-width')).toBe('8')
    expect(paint?.getAttribute('stroke-width')).toBe('5')
    expect(paint?.getAttribute('stroke-dasharray')).toBeNull()
    expect(drawn[0]!.querySelectorAll('path')[1]?.getAttribute('stroke-dasharray')).toBe('14 7')
    expect(poor[0]!.getAttribute('stroke-dasharray')).toBe('2 9')
  })

  it('every place with its middle on the pixel Google’s map will put it', () => {
    mount()
    const at = sketchSpot(METER, VIEW, BOX)
    const dot = spot('meter')!
    expect(dot.style.left).toBe(`${Math.round(at.x - 13)}px`)
    expect(dot.style.top).toBe(`${Math.round(at.y - 13)}px`)
    expect(dot.style.width).toBe('26px')
    expect(dot.textContent).toBe('1')
    // A place with a kind is drawn a size up, as on the map, and still sits on its own middle.
    const gate = sketchSpot(GATE, VIEW, BOX)
    expect(spot('gate')!.style.width).toBe('30px')
    expect(spot('gate')!.style.left).toBe(`${Math.round(gate.x - 15)}px`)
  })

  it('a place kept on the job wears its letter, and each place says its name', () => {
    mount()
    expect(spot('job')!.textContent).toBe('A')
    expect(spot('meter')!.getAttribute('aria-label')).toBe('ZZ Test meter')
    // A place with a kind says its kind first, in the kernel's own words, as its mark on the map does.
    expect(spot('gate')!.getAttribute('aria-label')).toBe(placeSaysWords(GATE))
    expect(placeSaysWords(GATE)).not.toBe('ZZ Test north side')
  })

  it('takes no drag: the drawing lets every press through but a press on a place', () => {
    mount({ onPlaceTap: () => {} })
    expect((sketch() as HTMLElement).style.pointerEvents).toBe('none')
    expect(spot('meter')!.style.pointerEvents).toBe('auto')
  })

  it('draws no line before the frame is measured or the view is known', () => {
    mount({ view: null })
    expect(document.querySelectorAll('[data-painted-wait-sketch] path')).toHaveLength(0)
    expect(spot('meter')).toBeNull()
  })

  it('a map with nothing on it draws nothing', () => {
    mount({ lines: [], places: [] })
    expect(document.querySelectorAll('[data-painted-wait-sketch] path')).toHaveLength(0)
    expect(document.querySelectorAll('[data-painted-wait-place]')).toHaveLength(0)
  })
})

describe('a press on a place', () => {
  it('reaches the caller during the wait, as on the map', () => {
    const onPlaceTap = vi.fn()
    mount({ onPlaceTap })
    fireEvent.click(spot('gate')!)
    expect(onPlaceTap).toHaveBeenCalledWith('gate')
  })

  it('a canvas with no press for a place draws them as marks alone', () => {
    mount()
    expect(spot('meter')!.disabled).toBe(true)
    expect(spot('meter')!.style.pointerEvents).toBe('none')
  })
})

describe('when it goes', () => {
  it('stays through the whole wait, however long the script takes', () => {
    vi.useFakeTimers()
    mount()
    act(() => vi.advanceTimersByTime(9900))
    expect(sketch()).not.toBeNull()
  })

  it('goes when Google’s map says it has settled, and lets go of the map', () => {
    const { rerender } = mount()
    makeMap()
    rerender({ loaded: true })
    expect(sketch()).not.toBeNull()
    act(() => lib.listeners['idle']?.forEach((fn) => fn()))
    expect(sketch()).toBeNull()
    expect(lib.removed.sort()).toEqual(['dragstart', 'idle', 'zoom_changed'])
  })

  it('goes at once when the reader begins to move the map', () => {
    for (const move of ['dragstart', 'zoom_changed']) {
      const { rerender, view } = mount()
      makeMap()
      rerender({ loaded: true })
      act(() => lib.listeners[move]?.forEach((fn) => fn()))
      expect(sketch()).toBeNull()
      view.unmount()
      lib.map = null
      lib.listeners = {}
    }
  })

  it('goes a few seconds after the script is in when the map never says it has settled', () => {
    vi.useFakeTimers()
    const { rerender } = mount()
    rerender({ loaded: true })
    act(() => vi.advanceTimersByTime(WAIT_SKETCH_LINGER_MS - 1))
    expect(sketch()).not.toBeNull()
    act(() => vi.advanceTimersByTime(1))
    expect(sketch()).toBeNull()
  })

  it('does not come back once it has gone', () => {
    const { rerender } = mount()
    makeMap()
    rerender({ loaded: true })
    act(() => lib.listeners['idle']?.forEach((fn) => fn()))
    rerender({ loaded: true, lines: [WALKED] })
    expect(sketch()).toBeNull()
  })

  it('lets go of the map when the canvas leaves first', () => {
    const { rerender, view } = mount()
    makeMap()
    rerender({ loaded: true })
    view.unmount()
    expect(lib.removed.sort()).toEqual(['dragstart', 'idle', 'zoom_changed'])
  })
})

describe('a page where Google’s map code is already in', () => {
  it('draws nothing: the map is up at once, as when a painted map comes back from Time', () => {
    vi.stubGlobal('google', { maps: { Map: function Map() {}, event: { removeListener: () => {} } } })
    mount({ loaded: true })
    expect(sketch()).toBeNull()
  })

  it('draws nothing even before the loader has said so', () => {
    vi.stubGlobal('google', { maps: { Map: function Map() {}, event: { removeListener: () => {} } } })
    mount({ loaded: false })
    expect(sketch()).toBeNull()
  })
})
