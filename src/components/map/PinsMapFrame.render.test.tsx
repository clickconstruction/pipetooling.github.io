// @vitest-environment jsdom
/**
 * The frame every map of dots draws in (punch list #395): Google or the Leaflet canvas for today,
 * the Satellite and Streets switch, and Time, which frames one spot on the photo archive with a
 * row of dates under the map and ends when the map leaves the screen.
 */
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const phone = vi.hoisted(() => ({ on: false }))
const opened = vi.hoisted(() => [] as string[])
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (url: string) => opened.push(url) }))

type StubPin = { id: string; title: string }
vi.mock('./PinsMapImageryCanvas', () => ({
  default: function CanvasStub(props: { pins: StubPin[]; onSelect: (id: string | null) => void; selectedId: string | null; renderPopup?: (id: string) => React.ReactNode; layer: string; imagery?: { url: string } | null; fitPoints?: Array<{ lat: number; lng: number }> | null; fitMaxZoom?: number; children?: React.ReactNode }) {
    return (
      <div data-testid="canvas" data-layer={props.layer} data-imagery={props.imagery?.url ?? ''} data-fit={props.fitPoints ? props.fitPoints.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join(' ') : ''} data-fit-max={props.fitMaxZoom ?? ''}>
        {props.pins.map((p) => (
          <button key={p.id} type="button" onClick={() => props.onSelect(p.id)}>{`dot ${p.title}`}</button>
        ))}
        <button type="button" onClick={() => props.onSelect(null)}>press the map</button>
        {props.selectedId && props.renderPopup ? <div data-testid="popup">{props.renderPopup(props.selectedId)}</div> : null}
        {props.children}
      </div>
    )
  },
}))
vi.mock('./PinsMapGoogleCanvas', () => ({
  default: function GoogleCanvasStub(props: { apiKey: string; mapTypeId?: string; onUnavailable: (reason: string) => void; pins: StubPin[]; onSelect: (id: string | null) => void }) {
    return (
      <div data-testid="google-canvas" data-key={props.apiKey} data-map-type={props.mapTypeId}>
        {props.pins.map((p) => (
          <button key={p.id} type="button" onClick={() => props.onSelect(p.id)}>{`dot ${p.title}`}</button>
        ))}
        <button type="button" onClick={() => props.onUnavailable('auth: test')}>fail google</button>
      </div>
    )
  },
}))

type WalkOpts = { onChange: (found: unknown[]) => void; onWalked?: () => void; signal?: AbortSignal }
const walk = vi.hoisted(() => ({ fn: null as null | ((spot: { lat: number; lng: number }, opts: WalkOpts) => Promise<unknown[]>), spots: [] as Array<{ lat: number; lng: number }> }))
vi.mock('../../lib/map/olderPhotosIo', () => ({
  walkOlderPhotos: (spot: { lat: number; lng: number }, opts: WalkOpts) => {
    walk.spots.push({ lat: spot.lat, lng: spot.lng })
    return walk.fn ? walk.fn(spot, opts) : Promise.resolve([])
  },
}))
vi.mock('../OfflineRetryPanel', () => ({
  default: (p: { failure: { message: string } | null; onRetry: () => void; surface: string }) => (p.failure ? <div data-testid="retry-panel" data-surface={p.surface}>{p.failure.message}<button type="button" onClick={() => p.onRetry()}>Retry</button></div> : null),
}))

import { PinsMapFrame, type PinsMapFrameProps } from './PinsMapFrame'

const PINS = [
  { id: 'pump', lat: 29.55, lng: -98.3, color: '#7c3aed', title: 'Pump house' },
  { id: 'gate', lat: 31.2, lng: -97.1, color: '#d97706', title: 'North gate' },
]
// Newest first, as the walk hands them over.
const FOUND = [
  { release: 900, publishedYmd: '2026-10-29', size: 5, takenYmd: '2025-02-09' },
  { release: 700, publishedYmd: '2022-03-01', size: 3, takenYmd: '2021-03-20' },
  { release: 500, publishedYmd: '2018-01-10', size: 1, takenYmd: null },
]
const WAYBACK = (release: number) => `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/${release}/{z}/{y}/{x}`
const answers = (found: unknown[]) => async (_spot: unknown, opts: WalkOpts) => {
  opts.onChange(found)
  return found
}

/** A card: it keeps the open dot, as every card does. */
function Card(props: Partial<PinsMapFrameProps> & { open?: string | null }) {
  const { open = null, ...rest } = props
  const [selectedId, setSelectedId] = useState<string | null>(open)
  return <PinsMapFrame surface="test-map" pins={PINS} selectedId={selectedId} onSelect={setSelectedId} fitSignal={0} height={300} isMobile={phone.on} {...rest} />
}

const provider = () => document.querySelector('[data-map-provider]')?.getAttribute('data-map-provider')
const caption = () => document.querySelector('[data-map-time-caption]')?.textContent
const time = () => document.querySelector('[data-map-time-press]') as HTMLButtonElement
const dates = () => [...document.querySelectorAll('[role="group"][aria-label="Photo dates"] button[aria-pressed]')].map((b) => [b.textContent, b.getAttribute('aria-pressed')])

beforeEach(() => {
  vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', '')
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  opened.length = 0
  phone.on = false
  walk.fn = null
  walk.spots.length = 0
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('the map of today', () => {
  it('with no Google key draws on the Leaflet canvas, on the view the card opens on', async () => {
    render(<Card />)
    const canvas = await screen.findByTestId('canvas')
    expect(screen.queryByTestId('google-canvas')).toBeNull()
    expect(provider()).toBe('osm')
    expect(canvas.getAttribute('data-layer')).toBe('streets')
    expect(screen.getByRole('button', { name: 'Streets' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Satellite' }))
    expect(canvas.getAttribute('data-layer')).toBe('satellite')
    expect(canvas.getAttribute('data-imagery')).toBe('')
    expect(document.querySelector('[data-map-provider]')?.className).toBe('mapImagery')
  })

  it('with a key draws on Google, Satellite as its photograph with street names, and falls back once it fails', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', 'test-key')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<Card defaultLayer="satellite" />)
    const google = await screen.findByTestId('google-canvas')
    expect(provider()).toBe('google')
    expect(google.getAttribute('data-key')).toBe('test-key')
    expect(google.getAttribute('data-map-type')).toBe('hybrid')
    fireEvent.click(screen.getByRole('button', { name: 'Streets' }))
    expect(google.getAttribute('data-map-type')).toBe('roadmap')
    fireEvent.click(screen.getByRole('button', { name: 'fail google' }))
    const canvas = await screen.findByTestId('canvas')
    expect(screen.queryByTestId('google-canvas')).toBeNull()
    expect(canvas.getAttribute('data-layer')).toBe('streets')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('[test-map]')
  })

  it('a map that never draws on Google stays on the Leaflet canvas with a key set, and keeps its own layers', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', 'test-key')
    render(
      <Card leafletOnly>
        <span data-testid="tool">a tool</span>
      </Card>,
    )
    expect((await screen.findByTestId('canvas')).querySelector('[data-testid="tool"]')).toBeTruthy()
    expect(screen.queryByTestId('google-canvas')).toBeNull()
  })

  it('a map with no Time press has the two views and nothing else', async () => {
    render(<Card noTime />)
    await screen.findByTestId('canvas')
    expect(time()).toBeNull()
    expect(screen.getByRole('button', { name: 'Satellite' })).toBeTruthy()
  })
})

describe('Time', () => {
  it('with several dots and none open asks for a dot, reads nothing and leaves the map as it is', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', 'test-key')
    walk.fn = answers(FOUND)
    render(<Card />)
    await screen.findByTestId('google-canvas')
    expect(time().textContent).toBe('Time')
    expect(time().getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(time())
    expect(time().getAttribute('aria-pressed')).toBe('true')
    expect(caption()).toBe('Press a dot to pick the spot.')
    expect(screen.getByTestId('google-canvas')).toBeTruthy()
    expect(provider()).toBe('google')
    expect(walk.spots).toEqual([])
    expect(document.querySelector('[data-map-time-today]')).toBeNull()

    // The dot is the spot: the Google map comes down and the archive frames it, on today's photograph.
    fireEvent.click(screen.getByRole('button', { name: 'dot North gate' }))
    const canvas = await screen.findByTestId('canvas')
    expect(screen.queryByTestId('google-canvas')).toBeNull()
    expect(provider()).toBe('archive')
    expect(walk.spots).toEqual([{ lat: 31.2, lng: -97.1 }])
    expect(canvas.getAttribute('data-layer')).toBe('satellite')
    expect(canvas.getAttribute('data-imagery')).toBe('')
    expect(canvas.getAttribute('data-fit')).toBe('31.1995,-97.1005 31.2005,-97.0995')
    expect(canvas.getAttribute('data-fit-max')).toBe('17')
    await waitFor(() => expect(caption()).toBe('Today’s photo of North gate, taken February 9, 2025. 2 older photos.'))
  })

  it('opens on Today with the dates oldest first, and a date swaps the photograph and nothing else', async () => {
    walk.fn = answers(FOUND)
    render(<Card open="pump" />)
    const canvas = await screen.findByTestId('canvas')
    fireEvent.click(time())
    await waitFor(() => expect(dates()).toEqual([['Before Jan 2018', 'false'], ['Mar 2021', 'false']]))
    const today = document.querySelector('[data-map-time-today]') as HTMLButtonElement
    expect(today.textContent).toBe('Today')
    expect(today.getAttribute('aria-pressed')).toBe('true')
    // Neither view is lit while Time is on.
    expect(screen.getByRole('button', { name: 'Satellite' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: 'Streets' }).getAttribute('aria-pressed')).toBe('false')
    const fit = canvas.getAttribute('data-fit')
    expect(fit).toBe('29.5495,-98.3005 29.5505,-98.2995')

    fireEvent.click(screen.getByRole('button', { name: 'Mar 2021' }))
    expect(canvas.getAttribute('data-imagery')).toBe(WAYBACK(700))
    expect(canvas.getAttribute('data-fit')).toBe(fit)
    expect(time().textContent).toBe('Time · Mar 2021')
    expect(caption()).toBe('Photo taken March 20, 2021. The dots are today’s.')
    expect(today.getAttribute('aria-pressed')).toBe('false')
    expect(dates()).toEqual([['Before Jan 2018', 'false'], ['Mar 2021', 'true']])
    // The dots are still the card's dots, and the same canvas is up.
    expect(screen.getByTestId('canvas')).toBe(canvas)
    expect(canvas.querySelectorAll('button')).toHaveLength(3)

    fireEvent.click(today)
    expect(canvas.getAttribute('data-imagery')).toBe('')
    expect(canvas.getAttribute('data-fit')).toBe(fit)
    expect(time().textContent).toBe('Time')
    expect(today.getAttribute('aria-pressed')).toBe('true')
  })

  it('steps along the row a photograph at a time, and stops at each end', async () => {
    walk.fn = answers(FOUND)
    render(<Card open="pump" />)
    const canvas = await screen.findByTestId('canvas')
    fireEvent.click(time())
    const older = await screen.findByRole('button', { name: 'An older photo' })
    const newer = screen.getByRole('button', { name: 'A newer photo' })
    expect((newer as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(older)
    expect(canvas.getAttribute('data-imagery')).toBe(WAYBACK(700))
    fireEvent.click(older)
    expect(canvas.getAttribute('data-imagery')).toBe(WAYBACK(500))
    expect((older as HTMLButtonElement).disabled).toBe(true)
    expect(caption()).toBe('Esri published this picture on January 10, 2018. It was taken before that, and the archive did not say when.')
    fireEvent.click(newer)
    fireEvent.click(newer)
    expect(canvas.getAttribute('data-imagery')).toBe('')
  })

  it('a pin opens its popup on the map of today and none while Time is on, where it would cover the photograph', async () => {
    walk.fn = answers(FOUND)
    render(<Card open="pump" renderPopup={(id) => <span>{`popup of ${id}`}</span>} />)
    await screen.findByTestId('canvas')
    expect(screen.getByTestId('popup').textContent).toBe('popup of pump')
    fireEvent.click(time())
    await waitFor(() => expect(dates()).toHaveLength(2))
    expect(screen.queryByTestId('popup')).toBeNull()
    fireEvent.click(time())
    expect(screen.getByTestId('popup').textContent).toBe('popup of pump')
  })

  it('a card says what on its map is not from that day', async () => {
    walk.fn = answers(FOUND)
    render(<Card open="pump" timeDotsWords="The pins are as of Sep 1." />)
    await screen.findByTestId('canvas')
    fireEvent.click(time())
    fireEvent.click(await screen.findByRole('button', { name: 'Mar 2021' }))
    expect(caption()).toBe('Photo taken March 20, 2021. The pins are as of Sep 1.')
  })

  it('Time again leaves, and so does a press on a view, which the map then shows', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', 'test-key')
    walk.fn = answers(FOUND)
    render(<Card open="pump" defaultLayer="satellite" />)
    await screen.findByTestId('google-canvas')
    fireEvent.click(time())
    await screen.findByTestId('canvas')
    fireEvent.click(await screen.findByRole('button', { name: 'Mar 2021' }))
    fireEvent.click(time())
    expect(document.querySelector('[data-map-time-row]')).toBeNull()
    expect((await screen.findByTestId('google-canvas')).getAttribute('data-map-type')).toBe('hybrid')
    expect(time().textContent).toBe('Time')
    expect(screen.getByRole('button', { name: 'Satellite' }).getAttribute('aria-pressed')).toBe('true')

    // On again it opens on Today: the date is not kept.
    fireEvent.click(time())
    const canvas = await screen.findByTestId('canvas')
    expect(canvas.getAttribute('data-imagery')).toBe('')
    fireEvent.click(screen.getByRole('button', { name: 'Streets' }))
    expect(document.querySelector('[data-map-time-row]')).toBeNull()
    expect((await screen.findByTestId('google-canvas')).getAttribute('data-map-type')).toBe('roadmap')
  })

  it('holds its spot when the map lets go of the open dot', async () => {
    walk.fn = answers(FOUND)
    render(<Card open="pump" />)
    const canvas = await screen.findByTestId('canvas')
    fireEvent.click(time())
    fireEvent.click(await screen.findByRole('button', { name: 'Mar 2021' }))
    fireEvent.click(screen.getByRole('button', { name: 'press the map' }))
    expect(provider()).toBe('archive')
    expect(canvas.getAttribute('data-imagery')).toBe(WAYBACK(700))
    expect(canvas.getAttribute('data-fit')).toBe('29.5495,-98.3005 29.5505,-98.2995')
    expect(walk.spots).toHaveLength(1)
  })

  it('carries a date to another dot: the release it pressed draws there until that spot’s own dates are in', async () => {
    const THERE = [
      { release: 880, publishedYmd: '2026-08-12', size: 7, takenYmd: '2026-01-02' },
      { release: 610, publishedYmd: '2021-06-15', size: 6, takenYmd: '2020-11-30' },
      { release: 300, publishedYmd: '2015-04-01', size: 2, takenYmd: '2014-09-09' },
    ]
    let hand: WalkOpts | null = null
    let finish: (found: unknown[]) => void = () => {}
    walk.fn = answers(FOUND)
    render(<Card open="pump" />)
    const canvas = await screen.findByTestId('canvas')
    fireEvent.click(time())
    fireEvent.click(await screen.findByRole('button', { name: 'Mar 2021' }))

    walk.fn = (_spot, opts) => {
      hand = opts
      return new Promise((resolve) => { finish = resolve })
    }
    fireEvent.click(screen.getByRole('button', { name: 'dot North gate' }))
    expect(walk.spots).toEqual([{ lat: 29.55, lng: -98.3 }, { lat: 31.2, lng: -97.1 }])
    expect(canvas.getAttribute('data-fit')).toBe('31.1995,-97.1005 31.2005,-97.0995')
    // The release covers the whole map, so it draws at the new spot at once.
    expect(canvas.getAttribute('data-imagery')).toBe(WAYBACK(700))
    expect(screen.getByRole('status').textContent).toBe('Looking through the archive…')
    // That spot's own photograph for the day: the one that was up when the pressed one first was.
    act(() => {
      hand!.onChange(THERE)
      hand!.onWalked?.()
    })
    expect(canvas.getAttribute('data-imagery')).toBe(WAYBACK(610))
    expect(time().textContent).toBe('Time · Nov 2020')
    expect(dates()).toEqual([['Sep 2014', 'false'], ['Nov 2020', 'true']])
    await act(async () => { finish(THERE) })
    expect(caption()).toBe('Photo taken November 30, 2020. The dots are today’s.')
  })

  it('says it is looking, names a photograph before its day is known, and counts once the walk is over', async () => {
    let hand: WalkOpts | null = null
    let finish: (found: unknown[]) => void = () => {}
    walk.fn = (_spot, opts) => {
      hand = opts
      return new Promise((resolve) => { finish = resolve })
    }
    render(<Card open="pump" />)
    await screen.findByTestId('canvas')
    fireEvent.click(time())
    expect((await screen.findByRole('status')).textContent).toBe('Looking through the archive…')
    expect(caption()).toBe('Today’s photo of Pump house.')
    act(() => {
      hand!.onChange([{ release: 900, publishedYmd: '2026-10-29', size: 5 }, { release: 700, publishedYmd: '2022-03-01', size: 3 }])
      hand!.onWalked?.()
    })
    expect(dates()).toEqual([['Before Mar 2022', 'false']])
    expect(screen.getByRole('status').textContent).toBe('Finding the days the photos were taken…')
    expect(caption()).toBe('Today’s photo of Pump house. 1 older photo.')
    await act(async () => { finish(FOUND.slice(0, 2)) })
    expect(screen.queryByRole('status')).toBeNull()
    expect(caption()).toBe('Today’s photo of Pump house, taken February 9, 2025. 1 older photo.')
    expect(dates()).toEqual([['Mar 2021', 'false']])
  })

  it('with nothing older says so, and offers Google Earth, which keeps its own older photos', async () => {
    walk.fn = answers(FOUND.slice(0, 1))
    render(<Card open="pump" />)
    await screen.findByTestId('canvas')
    fireEvent.click(time())
    await waitFor(() => expect(caption()).toBe('Today’s photo of Pump house, taken February 9, 2025. The archive has no older photo of this spot.'))
    expect(dates()).toEqual([])
    expect(screen.queryByRole('button', { name: 'An older photo' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Open this spot in Google Earth' }))
    expect(opened).toEqual(['https://earth.google.com/web/@29.550000,-98.300000,0a,700d,35y,0h,0t,0r'])
  })

  it('a read that fails names its reason and reads again on Retry', async () => {
    walk.fn = async () => {
      throw new Error('The photo archive answered 503.')
    }
    render(<Card open="pump" />)
    await screen.findByTestId('canvas')
    fireEvent.click(time())
    const panel = await screen.findByTestId('retry-panel')
    expect(panel.textContent).toContain('The photo archive answered 503.')
    expect(panel.getAttribute('data-surface')).toBe('test-map-time')
    expect(caption()).toBeUndefined()
    walk.fn = answers(FOUND)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(dates()).toHaveLength(2))
    expect(screen.queryByTestId('retry-panel')).toBeNull()
  })

  it('looks at the screen’s own place when the card names one, whatever dot is open', async () => {
    walk.fn = answers(FOUND)
    render(<Card open="gate" timeSpot={{ lat: 30.1, lng: -97.9, name: '418 Quarry Rd' }} />)
    await screen.findByTestId('canvas')
    fireEvent.click(time())
    await waitFor(() => expect(caption()).toContain('Today’s photo of 418 Quarry Rd'))
    expect(walk.spots).toEqual([{ lat: 30.1, lng: -97.9 }])
  })

  it('on a phone the press reads the date alone and the row has no step presses', async () => {
    phone.on = true
    walk.fn = answers(FOUND)
    render(<Card open="pump" />)
    await screen.findByTestId('canvas')
    fireEvent.click(time())
    fireEvent.click(await screen.findByRole('button', { name: 'Mar 2021' }))
    expect(time().textContent).toBe('Mar 2021')
    expect(screen.queryByRole('button', { name: 'An older photo' })).toBeNull()
  })

  it('is kept nowhere: a map that leaves the screen comes back as the map of today', async () => {
    walk.fn = answers(FOUND)
    const first = render(<Card open="pump" />)
    await screen.findByTestId('canvas')
    fireEvent.click(time())
    fireEvent.click(await screen.findByRole('button', { name: 'Mar 2021' }))
    first.unmount()
    expect(Object.keys(localStorage)).toEqual([])
    render(<Card open="pump" />)
    const canvas = await screen.findByTestId('canvas')
    expect(time().getAttribute('aria-pressed')).toBe('false')
    expect(document.querySelector('[data-map-time-row]')).toBeNull()
    expect(canvas.getAttribute('data-imagery')).toBe('')
    expect(canvas.getAttribute('data-fit')).toBe('')
    expect(provider()).toBe('osm')
  })
})
