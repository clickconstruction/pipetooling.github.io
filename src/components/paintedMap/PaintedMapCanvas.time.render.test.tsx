// @vitest-environment jsdom
/**
 * The painting canvas and Time (punch list #395): a map that is only being read may wear the Time
 * press and its row. Time swaps the photograph under the lines and is never there while a line or a
 * place is being drawn, on a still, or for a caller that did not ask for it (the public page).
 */
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
    MapContainer: (p: { children?: ReactNode }) => <div data-testid="map">{p.children}</div>,
    TileLayer: (p: { url: string }) => <div data-testid="tiles" data-url={p.url} />,
    Marker: () => <div data-testid="place" />,
    Polyline: () => <div data-testid="line" />,
    Circle: () => null,
    useMap: () => map,
    useMapEvents: () => map,
  }
})
const walked = vi.hoisted(() => [] as Array<[number, number]>)
vi.mock('../../lib/map/olderPhotosIo', () => ({
  walkOlderPhotos: async (spot: { lat: number; lng: number }, opts: { onChange: (found: unknown[]) => void }) => {
    walked.push([Number(spot.lat.toFixed(4)), Number(spot.lng.toFixed(4))])
    const found = [
      { release: 900, publishedYmd: '2026-10-29', size: 5, takenYmd: '2025-02-09' },
      { release: 700, publishedYmd: '2022-03-01', size: 3, takenYmd: '2021-03-20' },
    ]
    opts.onChange(found)
    return found
  },
}))

import PaintedMapCanvas, { type PaintedCanvasDraft, type PaintedCanvasLine } from './PaintedMapCanvas'

const LINES: PaintedCanvasLine[] = [{ id: 'l1', points: [{ lat: 30.2, lng: -98.1 }, { lat: 30.202, lng: -98.098 }], poorParts: [], how: 'drawn' }]
const DRAFT: PaintedCanvasDraft = { points: [], picked: null, targets: [], onAdd: () => {}, onMove: () => {}, onInsert: () => {}, onPick: () => {} }
const TIME = { name: 'The way in for deliveries' }
const tiles = () => screen.getAllByTestId('tiles')[0]!.getAttribute('data-url') ?? ''
const timePress = () => document.querySelector('[data-map-time-press]') as HTMLButtonElement | null
const caption = () => document.querySelector('[data-map-time-caption]')?.textContent

afterEach(() => {
  cleanup()
  walked.length = 0
})

describe('PaintedMapCanvas and Time', () => {
  it('a caller that hands no time gets the two views and no Time press, as the public page does', () => {
    render(<PaintedMapCanvas lines={LINES} places={[]} height={360} />)
    expect(screen.getByRole('button', { name: 'From above' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Streets' })).toBeTruthy()
    expect(timePress()).toBeNull()
    expect(tiles()).toContain('server.arcgisonline.com')
  })

  it('a map being read has Time: it looks at the middle of the map and swaps the photograph under the lines', async () => {
    render(<PaintedMapCanvas lines={LINES} places={[]} height="100%" time={TIME} />)
    fireEvent.click(timePress()!)
    await waitFor(() => expect(caption()).toBe('Today’s photo of The way in for deliveries, taken February 9, 2025. 1 older photo.'))
    expect(walked).toEqual([[30.201, -98.099]])
    expect(tiles()).toContain('server.arcgisonline.com')
    fireEvent.click(screen.getByRole('button', { name: 'Mar 2021' }))
    expect(tiles()).toContain('/tile/700/')
    expect(caption()).toBe('Photo taken March 20, 2021. The lines are today’s.')
    expect(timePress()?.textContent).toBe('Time · Mar 2021')
    expect(screen.getAllByTestId('line').length).toBeGreaterThan(0)
    // Neither view is lit while Time is on, and a press on one leaves Time.
    expect(screen.getByRole('button', { name: 'From above' }).getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: 'From above' }))
    expect(tiles()).toContain('server.arcgisonline.com')
    expect(document.querySelector('[data-map-time-row]')).toBeNull()
  })

  it('drawing that begins while Time is on puts today’s photograph back and takes the press away', async () => {
    const view = render(<PaintedMapCanvas lines={LINES} places={[]} height="100%" time={TIME} />)
    fireEvent.click(timePress()!)
    fireEvent.click(await screen.findByRole('button', { name: 'Mar 2021' }))
    expect(tiles()).toContain('/tile/700/')
    view.rerender(<PaintedMapCanvas lines={LINES} places={[]} height="100%" time={TIME} draft={DRAFT} />)
    expect(tiles()).toContain('server.arcgisonline.com')
    expect(timePress()).toBeNull()
    expect(document.querySelector('[data-map-time-row]')).toBeNull()
    // Back to reading: Time is off, not waiting on its date.
    view.rerender(<PaintedMapCanvas lines={LINES} places={[]} height="100%" time={TIME} />)
    expect(timePress()?.getAttribute('aria-pressed')).toBe('false')
    expect(tiles()).toContain('server.arcgisonline.com')
  })

  it('a still, and a map with nothing on it yet, have no Time press', () => {
    const still = render(<PaintedMapCanvas lines={LINES} places={[]} height={150} still time={TIME} />)
    expect(timePress()).toBeNull()
    still.unmount()
    render(<PaintedMapCanvas lines={[]} places={[]} height={360} time={TIME} />)
    expect(timePress()).toBeNull()
  })

  it('a map that fills its parent gives the row its room', () => {
    render(<PaintedMapCanvas lines={LINES} places={[]} height="100%" time={TIME} />)
    const outer = document.querySelector('[data-painted-map-frame]') as HTMLElement
    expect(outer.style.height).toBe('100%')
    expect(outer.style.flexDirection).toBe('column')
    expect((document.querySelector('[data-painted-map-canvas]') as HTMLElement).style.flex).toBe('1 1 0px')
  })
})
