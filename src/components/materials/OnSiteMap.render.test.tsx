// @vitest-environment jsdom
/**
 * The site map and Time (punch list #395): a map that is being looked at has the Time press and its
 * row, and Time swaps the photograph without moving the map. A map where a pin is being placed, and
 * a still, never have it.
 */
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('leaflet/dist/leaflet.css', () => ({}))
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => true }))
vi.mock('../paintedMap/PaintedMapsLayer', () => ({ PaintedMapsLayer: () => null }))
const moves = vi.hoisted(() => ({ setView: 0, fitBounds: 0 }))
vi.mock('react-leaflet', () => {
  const map = {
    invalidateSize: () => {},
    getContainer: () => document.createElement('div'),
    setView: () => { moves.setView += 1 },
    fitBounds: () => { moves.fitBounds += 1 },
    getCenter: () => ({ lat: 30.2, lng: -98.1 }),
  }
  return {
    MapContainer: (p: { children?: ReactNode; zoom: number }) => <div data-testid="map" data-zoom={p.zoom}>{p.children}</div>,
    TileLayer: (p: { url: string; attribution: string }) => <div data-testid="tiles" data-url={p.url} data-credit={p.attribution} />,
    CircleMarker: (p: { children?: ReactNode }) => <div data-testid="pin">{p.children}</div>,
    Tooltip: (p: { children?: ReactNode }) => <span>{p.children}</span>,
    Circle: () => null,
    Polyline: () => null,
    useMap: () => map,
    useMapEvents: () => map,
  }
})
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

import OnSiteMap, { type OnSiteMapPin } from './OnSiteMap'

const SITE = { lat: 30.2, lng: -98.1 }
const PINS: OnSiteMapPin[] = [
  { id: 'cage', label: 'Cage 1', lat: 30.2004, lng: -98.1003 },
  { id: 'box', label: 'Box 12', lat: 30.2001, lng: -98.0998 },
]
const tiles = () => screen.getByTestId('tiles').getAttribute('data-url') ?? ''
const timePress = () => document.querySelector('[data-map-time-press]') as HTMLButtonElement | null

afterEach(() => {
  cleanup()
  walked.length = 0
  moves.setView = 0
  moves.fitBounds = 0
})

describe('OnSiteMap', () => {
  it('opens from above with Satellite, Streets and Time, and Streets is one press', () => {
    render(<OnSiteMap center={SITE} pins={PINS} height={300} />)
    expect(tiles()).toContain('server.arcgisonline.com')
    expect(screen.getByRole('button', { name: 'Satellite' }).getAttribute('aria-pressed')).toBe('true')
    expect(timePress()?.textContent).toBe('Time')
    fireEvent.click(screen.getByRole('button', { name: 'Streets' }))
    expect(tiles()).toContain('tile.openstreetmap.org')
    expect(document.querySelector('[data-map-time-row]')).toBeNull()
  })

  it('Time looks at the site where the map opened and swaps the photograph without moving the map', async () => {
    render(<OnSiteMap center={SITE} pins={PINS} height={300} focusId="box" />)
    const movesBefore = { ...moves }
    fireEvent.click(timePress()!)
    await waitFor(() => expect(document.querySelector('[data-map-time-caption]')?.textContent).toBe('Today’s photo of this site, taken February 9, 2025. 1 older photo.'))
    // The pin the map opened on is the spot.
    expect(walked).toEqual([[30.2001, -98.0998]])
    expect(document.querySelector('[data-map-provider]')?.getAttribute('data-map-provider')).toBe('archive')
    // Today's photograph is the map's own view from above.
    expect(tiles()).toContain('server.arcgisonline.com')
    fireEvent.click(screen.getByRole('button', { name: 'Mar 2021' }))
    expect(tiles()).toContain('wayback.maptiles.arcgis.com')
    expect(tiles()).toContain('/tile/700/')
    expect(screen.getByTestId('tiles').getAttribute('data-credit')).toContain('Esri')
    expect(document.querySelector('[data-map-time-caption]')?.textContent).toBe('Photo taken March 20, 2021. The pins are today’s.')
    // On a phone the press reads the date alone. The pins are still the map's pins.
    expect(timePress()?.textContent).toBe('Mar 2021')
    expect(screen.getAllByTestId('pin')).toHaveLength(2)
    expect(moves).toEqual(movesBefore)
    fireEvent.click(document.querySelector('[data-map-time-today]') as HTMLButtonElement)
    expect(tiles()).toContain('server.arcgisonline.com')
    expect(moves).toEqual(movesBefore)
  })

  it('a date shows from above even when the map was on Streets, and Streets leaves Time', async () => {
    render(<OnSiteMap center={SITE} pins={[]} height={300} />)
    fireEvent.click(screen.getByRole('button', { name: 'Streets' }))
    fireEvent.click(timePress()!)
    expect(tiles()).toContain('server.arcgisonline.com')
    expect(walked).toEqual([[30.2, -98.1]])
    fireEvent.click(await screen.findByRole('button', { name: 'Mar 2021' }))
    expect(tiles()).toContain('/tile/700/')
    fireEvent.click(screen.getByRole('button', { name: 'Streets' }))
    expect(tiles()).toContain('tile.openstreetmap.org')
    expect(document.querySelector('[data-map-time-row]')).toBeNull()
  })

  it('has no Time press while a pin is being placed, and placing ends a Time that was on', async () => {
    const view = render(<OnSiteMap center={SITE} pins={PINS} height={300} />)
    fireEvent.click(timePress()!)
    fireEvent.click(await screen.findByRole('button', { name: 'Mar 2021' }))
    expect(tiles()).toContain('/tile/700/')
    view.rerender(<OnSiteMap center={SITE} pins={PINS} height={300} placing={{ label: 'Box 12' }} onCenterChange={() => {}} />)
    // The ring never sits on an older photograph.
    expect(tiles()).toContain('server.arcgisonline.com')
    expect(timePress()).toBeNull()
    expect(document.querySelector('[data-map-time-row]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Satellite' })).toBeTruthy()
    // Back to looking: Time is off, not waiting where it was.
    view.rerender(<OnSiteMap center={SITE} pins={PINS} height={300} />)
    expect(timePress()?.getAttribute('aria-pressed')).toBe('false')
    expect(tiles()).toContain('server.arcgisonline.com')
  })

  it('a still has no press at all', () => {
    render(<OnSiteMap center={SITE} pins={PINS} height={150} still />)
    expect(timePress()).toBeNull()
    expect(screen.queryByRole('button', { name: 'Satellite' })).toBeNull()
  })

  it('a map that fills its parent gives the row its room, and a map of a set height keeps it', async () => {
    const filled = render(<OnSiteMap center={SITE} pins={PINS} height="100%" />)
    const outer = document.querySelector('[data-on-site-map]') as HTMLElement
    expect(outer.style.height).toBe('100%')
    expect(outer.style.flexDirection).toBe('column')
    expect((document.querySelector('[data-map-provider]') as HTMLElement).style.flex).toBe('1 1 0px')
    filled.unmount()
    render(<OnSiteMap center={SITE} pins={PINS} height={300} />)
    expect((document.querySelector('[data-on-site-map]') as HTMLElement).style.height).toBe('')
    expect((document.querySelector('[data-map-provider]') as HTMLElement).style.height).toBe('300px')
  })

  it('with nowhere to open says so and draws no map', () => {
    render(<OnSiteMap center={null} pins={[]} height={300} />)
    expect(screen.queryByTestId('map')).toBeNull()
    expect(timePress()).toBeNull()
  })
})
