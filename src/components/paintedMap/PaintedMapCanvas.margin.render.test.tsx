// @vitest-environment jsdom
/**
 * The painting canvas and how sure the phone is (punch list #402). A reading marked `area` is drawn
 * as its whole circle, dashed, with no dot in its middle, and nothing slides the map to that middle.
 * With `frameMargin` the map pulls back until the circle and the map's own lines show, and the first
 * spot after it brings the map in to the person. The rule itself is `marginFrame.test.ts`; this is
 * the Leaflet canvas doing what the rule says.
 */
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MARGIN_FRAME_PADDING_PX, areaBox, type PaintedCanvasMe } from '../../lib/paintedMap/marginFrame'

vi.mock('leaflet/dist/leaflet.css', () => ({}))
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }))

/** The map, stood in for: it says how far in it is and what it shows, and keeps every move it is asked to make. */
const world = vi.hoisted(() => ({
  zoom: 18,
  view: { south: 29.4995, west: -98.2005, north: 29.5005, east: -98.1995 },
  /** Is the person in the middle of the picture? `follow` slides the map only when they are not. */
  inMiddle: true,
  moves: [] as Array<{ fn: 'fitBounds' | 'setView' | 'panTo'; args: unknown[] }>,
}))
vi.mock('react-leaflet', () => {
  const map = {
    getContainer: () => document.createElement('div'),
    getCenter: () => ({ lat: 29.5, lng: -98.2 }),
    getZoom: () => world.zoom,
    getSize: () => ({ x: 400, y: 300 }),
    getBounds: () => ({ getSouth: () => world.view.south, getWest: () => world.view.west, getNorth: () => world.view.north, getEast: () => world.view.east, pad: () => ({ contains: () => world.inMiddle }) }),
    latLngToContainerPoint: () => (world.inMiddle ? { x: 200, y: 150 } : { x: 4, y: 4 }),
    invalidateSize: () => {},
    fitBounds: (...args: unknown[]) => void world.moves.push({ fn: 'fitBounds', args }),
    setView: (...args: unknown[]) => void world.moves.push({ fn: 'setView', args }),
    panTo: (...args: unknown[]) => void world.moves.push({ fn: 'panTo', args }),
  }
  return {
    MapContainer: (p: { children?: ReactNode }) => <div data-testid="map">{p.children}</div>,
    TileLayer: () => null,
    Marker: (p: { title?: string }) => <div data-testid="marker" data-title={p.title ?? ''} />,
    Polyline: () => null,
    Circle: (p: { radius: number; pathOptions: { weight?: number; dashArray?: string; fillOpacity?: number } }) => <div data-testid="circle" data-radius={p.radius} data-weight={p.pathOptions.weight} data-dash={p.pathOptions.dashArray ?? ''} data-fill={p.pathOptions.fillOpacity} />,
    useMap: () => map,
    useMapEvents: () => map,
  }
})

import PaintedMapCanvas, { type PaintedCanvasLine } from './PaintedMapCanvas'

const LINES: PaintedCanvasLine[] = [{ id: 'l1', points: [{ lat: 29.5, lng: -98.2 }, { lat: 29.5004, lng: -98.1996 }], poorParts: [], how: 'walked' }]
const POINTS = LINES[0]!.points
const SPOT: PaintedCanvasMe = { lat: 29.5002, lng: -98.1998, accuracyM: 5 }
const AREA: PaintedCanvasMe = { lat: 29.52, lng: -98.19, accuracyM: 3200, area: true }

const you = () => screen.queryAllByTestId('marker').filter((m) => m.getAttribute('data-title') === 'You')
const circle = () => screen.queryAllByTestId('circle')
/** The moves the margin frame asked for: the first framing of a map leaves its own room around it, and animates nothing. */
const fits = () => world.moves.filter((m) => m.fn === 'fitBounds' && (m.args[1] as { padding: number[] }).padding[0] === MARGIN_FRAME_PADDING_PX)
const zooms = () => world.moves.filter((m) => m.fn === 'setView')
const slides = () => world.moves.filter((m) => m.fn === 'panTo')
/** What `frameMe` asks for: it is the one move here that is animated. */
const framesOfMe = () => world.moves.filter((m) => m.fn === 'fitBounds' && (m.args[1] as { animate?: boolean }).animate === true)

beforeEach(() => {
  world.zoom = 18
  world.view = { south: 29.4995, west: -98.2005, north: 29.5005, east: -98.1995 }
  world.inMiddle = true
  world.moves = []
})
afterEach(cleanup)

describe('how the canvas draws where the person is', () => {
  it('draws a spot as a dot inside its margin', () => {
    render(<PaintedMapCanvas lines={LINES} places={[]} height={300} me={SPOT} />)
    expect(you()).toHaveLength(1)
    expect(circle()).toHaveLength(1)
    expect(circle()[0]!.getAttribute('data-radius')).toBe('5')
    expect(circle()[0]!.getAttribute('data-weight')).toBe('1')
    expect(circle()[0]!.getAttribute('data-dash')).toBe('')
  })

  it('draws an area as its whole circle, dashed, with no dot in its middle', () => {
    render(<PaintedMapCanvas lines={LINES} places={[]} height={300} me={AREA} />)
    expect(you()).toHaveLength(0)
    expect(circle()).toHaveLength(1)
    expect(circle()[0]!.getAttribute('data-radius')).toBe('3200')
    expect(circle()[0]!.getAttribute('data-weight')).toBe('2')
    expect(circle()[0]!.getAttribute('data-dash')).toBe('6 6')
  })

  it('draws a rough margin as a spot when the caller has not called it an area: the wait is the caller’s', () => {
    render(<PaintedMapCanvas lines={LINES} places={[]} height={300} me={{ ...AREA, area: false }} />)
    expect(you()).toHaveLength(1)
    expect(circle()[0]!.getAttribute('data-dash')).toBe('')
  })

  it('draws nobody when there is no reading to draw', () => {
    render(<PaintedMapCanvas lines={LINES} places={[]} height={300} me={null} frameMargin follow />)
    expect(you()).toHaveLength(0)
    expect(circle()).toHaveLength(0)
    expect(fits()).toEqual([])
    expect(zooms()).toEqual([])
    expect(slides()).toEqual([])
  })
})

describe('how the canvas frames by how sure the phone is', () => {
  it('pulls back until the whole circle and the map’s own lines show', () => {
    render(<PaintedMapCanvas lines={LINES} places={[]} height={300} me={AREA} frameMargin />)
    const box = areaBox(AREA, POINTS)!
    expect(fits()).toEqual([{ fn: 'fitBounds', args: [[[box.south, box.west], [box.north, box.east]], { padding: [28, 28], animate: false }] }])
    expect(zooms()).toEqual([])
  })

  it('moves nothing for an area when the caller did not ask for the frame', () => {
    render(<PaintedMapCanvas lines={LINES} places={[]} height={300} me={AREA} />)
    expect(fits()).toEqual([])
  })

  it('never slides the map to the middle of an area', () => {
    world.inMiddle = false
    const view = render(<PaintedMapCanvas lines={LINES} places={[]} height={300} me={AREA} follow frameMargin />)
    expect(slides()).toEqual([])
    // A spot out of the middle of the picture is slid to, as before.
    view.rerender(<PaintedMapCanvas lines={LINES} places={[]} height={300} me={SPOT} follow frameMargin />)
    expect(slides()).toHaveLength(1)
    expect(slides()[0]!.args[0]).toEqual([SPOT.lat, SPOT.lng])
  })

  it('brings the map in to the person on the first spot after an area', () => {
    const view = render(<PaintedMapCanvas lines={LINES} places={[]} height={300} me={AREA} frameMargin />)
    world.zoom = 11
    view.rerender(<PaintedMapCanvas lines={LINES} places={[]} height={300} me={SPOT} frameMargin />)
    expect(zooms()).toEqual([{ fn: 'setView', args: [[SPOT.lat, SPOT.lng], 18, { animate: false }] }])
    // The next spot moves nothing: the view is the person’s own again.
    view.rerender(<PaintedMapCanvas lines={LINES} places={[]} height={300} me={{ ...SPOT, lat: 29.5003 }} frameMargin />)
    expect(zooms()).toHaveLength(1)
  })

  it('remembers the area across a wait in which nobody is drawn', () => {
    const view = render(<PaintedMapCanvas lines={LINES} places={[]} height={300} me={AREA} frameMargin />)
    view.rerender(<PaintedMapCanvas lines={LINES} places={[]} height={300} me={null} frameMargin />)
    expect(zooms()).toEqual([])
    view.rerender(<PaintedMapCanvas lines={LINES} places={[]} height={300} me={SPOT} frameMargin />)
    expect(zooms()).toHaveLength(1)
  })

  it('leaves the view alone when a later area still fits in it, and fits again when one does not', () => {
    const view = render(<PaintedMapCanvas lines={LINES} places={[]} height={300} me={AREA} frameMargin />)
    expect(fits()).toHaveLength(1)
    // The map now shows the whole area and more.
    world.view = { south: 29.4, west: -98.3, north: 29.6, east: -98.1 }
    view.rerender(<PaintedMapCanvas lines={LINES} places={[]} height={300} me={{ ...AREA, accuracyM: 3300 }} frameMargin />)
    expect(fits()).toHaveLength(1)
    view.rerender(<PaintedMapCanvas lines={LINES} places={[]} height={300} me={{ ...AREA, lat: 29.9 }} frameMargin />)
    expect(fits()).toHaveLength(2)
  })

  it('brings a map that opened far out in to the person on the first reading of all', () => {
    world.zoom = 4
    render(<PaintedMapCanvas lines={[]} places={[]} height={300} me={SPOT} frameMargin follow />)
    expect(zooms()).toEqual([{ fn: 'setView', args: [[SPOT.lat, SPOT.lng], 18, { animate: false }] }])
  })

  it('leaves a map that opened on the job where it is', () => {
    render(<PaintedMapCanvas lines={LINES} places={[]} height={300} me={SPOT} frameMargin follow />)
    expect(zooms()).toEqual([])
    expect(fits()).toEqual([])
  })

  it('does not frame an area as a reader’s dot: the shared page’s own frame waits for a spot', () => {
    const view = render(<PaintedMapCanvas lines={LINES} places={[]} height={300} me={AREA} frameMe />)
    expect(framesOfMe()).toEqual([])
    view.rerender(<PaintedMapCanvas lines={LINES} places={[]} height={300} me={SPOT} frameMe />)
    expect(framesOfMe()).toHaveLength(1)
  })
})
