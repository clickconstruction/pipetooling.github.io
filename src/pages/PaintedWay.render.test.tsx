// @vitest-environment jsdom
/**
 * A painted map, shared (punch list #345, PR 4): what `/way/<code>` opens with no sign-in. The page
 * shows the map and nothing else from the app, reads the reader's own position only after their
 * press, and says that it stays on their phone. A dead link reads the same whatever killed it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { PaintedWayIo, PaintedWayView } from '../lib/paintedMap/paintedMapLinkIo'
import type { SharedPaintedMap } from '../lib/paintedMap/paintedMapLink'

vi.mock('../components/paintedMap/PaintedMapCanvas', () => ({
  default: function CanvasStub(props: { lines: Array<{ id: string }>; places: Array<{ number: number }>; me?: { lat: number } | null; frameMe?: boolean }) {
    return <div data-testid="canvas">lines:{props.lines.length} dots:{props.places.map((p) => p.number).join(',')} me:{props.me ? 'yes' : 'no'} frame:{props.frameMe ? 'yes' : 'no'}</div>
  },
}))

import PaintedWay from './PaintedWay'

const MAP: SharedPaintedMap = {
  name: 'The way in for deliveries',
  words: 'Start at the truck gate.',
  lines: [{ how: 'walked', points: [[29.5, -98.2], [29.5, -98.198], [29.5012, -98.198]], poorParts: [], fixedByHand: false, lengthM: 327, marginM: 12, measuredFt: null, measuredHow: null }],
  places: [
    { id: 'p1', number: 1, name: 'Truck gate', words: 'Close it behind you.', lat: 29.5, lng: -98.2, photo: true },
    { id: 'p2', number: 2, name: 'Meter', words: '', lat: 29.5005, lng: -98.199, photo: false },
  ],
}
const OPEN: PaintedWayView = { kind: 'open', map: MAP, company: { name: 'Made Up Plumbing', phone: '' }, endsOn: '2027-02-11' }

const fakeIo = (views: PaintedWayView[]): PaintedWayIo & { reads: string[] } => {
  const reads: string[] = []
  return {
    reads,
    read: async (code) => {
      reads.push(code)
      return views[Math.min(reads.length - 1, views.length - 1)]!
    },
    photoUrl: (code, placeId) => `https://fn.test/?code=${code}&photo=${placeId}`,
  }
}
const open = (io: PaintedWayIo, path = '/way/q7m2kd4x9p') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/way/:code" element={<PaintedWay io={io} />} />
      </Routes>
    </MemoryRouter>,
  )

/** A phone that can be asked where it is, and counts the asks. */
function phone() {
  const state = { watches: 0, cleared: 0, ok: null as null | ((pos: unknown) => void), fail: null as null | ((err: unknown) => void) }
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      watchPosition: (ok: (pos: unknown) => void, fail: (err: unknown) => void) => {
        state.watches += 1
        state.ok = ok
        state.fail = fail
        return 7
      },
      clearWatch: () => void (state.cleared += 1),
    },
  })
  return state
}

afterEach(() => {
  cleanup()
  delete (navigator as unknown as { geolocation?: unknown }).geolocation
})

describe('PaintedWay', () => {
  it('shows the map, its places and its line, and who sent it', async () => {
    const io = fakeIo([OPEN])
    open(io)
    expect(await screen.findByRole('heading', { name: 'The way in for deliveries' })).toBeTruthy()
    expect(io.reads).toEqual(['q7m2kd4x9p'])
    expect(screen.getByText('Start at the truck gate.')).toBeTruthy()
    expect(screen.getByText('Made Up Plumbing')).toBeTruthy()
    expect(await screen.findByTestId('canvas')).toHaveProperty('textContent', 'lines:1 dots:1,2 me:no frame:no')
    const places = [...document.querySelectorAll('[data-way-place]')].map((e) => e.textContent)
    expect(places[0]).toContain('1Truck gateClose it behind you.')
    expect(places[1]).toContain('2Meter')
    expect(document.querySelector('[data-way-lines]')?.textContent).toContain('About 1,050 ft, give or take 40 ft · walked')
    expect(screen.getByText(/A length here is a guide for how far\. It is not a measurement\./)).toBeTruthy()
    expect(screen.getByText(/Made Up Plumbing shared this map with you\. The link ends by itself on Feb 11\./)).toBeTruthy()
    expect(document.querySelector('[data-theme="light"]')).not.toBeNull()
  })

  it('points Directions at the start of the first line', async () => {
    open(fakeIo([OPEN]))
    const link = (await screen.findByRole('link', { name: 'Directions to the start' })) as HTMLAnchorElement
    expect(link.href).toContain('destination=29.500000,-98.200000')
  })

  it('asks the phone nothing until Show where I am, then says where the reader stands and that it stays on the phone', async () => {
    const p = phone()
    open(fakeIo([OPEN]))
    await screen.findByRole('heading', { name: 'The way in for deliveries' })
    expect(p.watches).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Show where I am' }))
    expect(p.watches).toBe(1)
    expect(document.querySelector('[data-way-where]')?.textContent).toContain('Finding you…')
    // About 380 ft west of the start, on no line.
    act(() => p.ok!({ coords: { latitude: 29.5, longitude: -98.2012, accuracy: 6 } }))
    const where = document.querySelector('[data-way-where]')?.textContent ?? ''
    expect(where).toContain('The start is 380 ft east of you.')
    expect(where).toContain('Your phone is sure within 20 ft.')
    expect(where).toContain('Where you are stays on your phone. We never see it.')
    expect(screen.getByTestId('canvas').textContent).toContain('me:yes frame:yes')
    fireEvent.click(screen.getByRole('button', { name: 'Hide where I am' }))
    expect(p.cleared).toBe(1)
    expect(screen.getByTestId('canvas').textContent).toContain('me:no frame:no')
    expect(document.querySelector('[data-way-where]')).toBeNull()
  })

  it('leaves the picture on the map for a reader across town, and says how far the start is', async () => {
    const p = phone()
    open(fakeIo([OPEN]))
    fireEvent.click(await screen.findByRole('button', { name: 'Show where I am' }))
    // About six miles west.
    act(() => p.ok!({ coords: { latitude: 29.5, longitude: -98.3, accuracy: 10 } }))
    expect(screen.getByTestId('canvas').textContent).toContain('me:yes frame:no')
    expect(document.querySelector('[data-way-where]')?.textContent).toContain('The start is 6.0 mi east of you.')
  })

  it('says a reader on the line is on it', async () => {
    const p = phone()
    open(fakeIo([OPEN]))
    fireEvent.click(await screen.findByRole('button', { name: 'Show where I am' }))
    act(() => p.ok!({ coords: { latitude: 29.50002, longitude: -98.199, accuracy: 5 } }))
    expect(document.querySelector('[data-way-where]')?.textContent).toContain('You are on the painted line.')
  })

  it('loses only the dot when location is refused', async () => {
    const p = phone()
    open(fakeIo([OPEN]))
    fireEvent.click(await screen.findByRole('button', { name: 'Show where I am' }))
    act(() => p.fail!({ code: 1 }))
    expect(screen.getByText('Location is off for this page. The map and Directions still work.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Show where I am' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Directions to the start' })).toBeTruthy()
  })

  it('opens a place\'s photo through the function, by the place and the code alone', async () => {
    open(fakeIo([OPEN]))
    fireEvent.click(await screen.findByRole('button', { name: 'Open the photo of Truck gate' }))
    expect(document.querySelector('[data-way-photo] img')?.getAttribute('src')).toBe('https://fn.test/?code=q7m2kd4x9p&photo=p1')
    expect(screen.queryByRole('button', { name: 'Open the photo of Meter' })).toBeNull()
  })

  it('reads the same for a link that was ended, expired or never was', async () => {
    open(fakeIo([{ kind: 'gone' }]))
    expect((await screen.findByRole('status')).textContent).toBe('This map is no longer shared.Ask whoever sent it for a new link.')
    expect(screen.queryByTestId('canvas')).toBeNull()
  })

  it('does not ask the function about a code that is not a code', async () => {
    const io = fakeIo([OPEN])
    open(io, '/way/nope')
    expect((await screen.findByRole('status')).textContent).toContain('This map is no longer shared.')
    expect(io.reads).toEqual([])
  })

  it('says when too many wrong links came from this connection', async () => {
    open(fakeIo([{ kind: 'locked' }]))
    expect((await screen.findByRole('status')).textContent).toContain('Too many wrong links from this connection')
  })

  it('offers Try again when the map did not load, and opens on the next try', async () => {
    const io = fakeIo([{ kind: 'signal' }, OPEN])
    open(io)
    expect((await screen.findByRole('alert')).textContent).toBe('The map did not load. There may be no signal here.')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await screen.findByRole('heading', { name: 'The way in for deliveries' })
    expect(io.reads).toHaveLength(2)
  })

  it('draws a made-up map for the sample and reads no link', async () => {
    const io = fakeIo([{ kind: 'gone' }])
    open(io, '/way/sample')
    await screen.findByRole('heading', { name: 'The way in for deliveries' })
    expect(io.reads).toEqual([])
    expect(screen.getByText(/Sample — this is what a customer sees/)).toBeTruthy()
    await waitFor(() => expect(screen.getByTestId('canvas').textContent).toContain('lines:2 dots:1,2,3'))
  })
})
