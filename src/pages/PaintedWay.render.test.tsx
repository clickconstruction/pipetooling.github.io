// @vitest-environment jsdom
/**
 * A painted map, shared (punch list #345, PR 4): what `/way/<code>` opens with no sign-in. The page
 * shows the map and nothing else from the app. A reader who is not signed in gives a name first,
 * and the page says what the company keeps before it asks. The reader's own position is read only
 * after their press, whose words say the company will see it. A dead link reads the same whatever
 * killed it. The sample sends nothing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { PaintedWayAsk, PaintedWayIo, PaintedWayView } from '../lib/paintedMap/paintedMapLinkIo'
import type { SharedPaintedMap } from '../lib/paintedMap/paintedMapLink'

vi.mock('../components/paintedMap/PaintedMapCanvas', () => ({
  default: function CanvasStub(props: { lines: Array<{ id: string }>; places: Array<{ number: number; kind?: string | null }>; me?: { lat: number } | null; frameMe?: boolean }) {
    return <div data-testid="canvas" data-kinds={props.places.map((p) => p.kind ?? 'plain').join(',')}>lines:{props.lines.length} dots:{props.places.map((p) => p.number).join(',')} me:{props.me ? 'yes' : 'no'} frame:{props.frameMe ? 'yes' : 'no'}</div>
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
const OPEN: PaintedWayView = { kind: 'open', map: MAP, company: { name: 'Made Up Plumbing', phone: '' }, endsOn: '2027-02-11', visitor: { name: 'Dana Reyes', signedIn: false } }
const ASK_NAME: PaintedWayView = { kind: 'name', mapName: 'The way in for deliveries', company: { name: 'Made Up Plumbing', phone: '' }, endsOn: '2027-02-11' }

type Point = { lat: number; lng: number; accuracyM: number | null }
const fakeIo = (views: PaintedWayView[]): PaintedWayIo & { reads: string[]; asks: PaintedWayAsk[]; points: Array<{ code: string; deviceId: string; point: Point }> } => {
  const reads: string[] = []
  const asks: PaintedWayAsk[] = []
  const points: Array<{ code: string; deviceId: string; point: Point }> = []
  return {
    reads,
    asks,
    points,
    open: async (code, ask) => {
      reads.push(code)
      asks.push(ask)
      return views[Math.min(reads.length - 1, views.length - 1)]!
    },
    here: async (code, deviceId, point) => {
      points.push({ code, deviceId, point })
      return true
    },
    photoUrl: (code, placeId, deviceId) => `https://fn.test/?code=${code}&photo=${placeId}${deviceId ? '&device=yes' : ''}`,
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
  window.localStorage.clear()
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
    // The length is one line. How it was made and what it is worth are one sentence, under it.
    const lineRow = document.querySelector('[data-way-line]')
    expect(lineRow?.firstElementChild?.textContent).toBe('About 1,050 ft, give or take 40 ft')
    expect(lineRow?.querySelector('[data-way-line-under]')?.textContent).toBe('Walked, so the length is a guide for how far, not a measurement.')
    expect(document.querySelector('[data-way-lines]')?.textContent).toBe('About 1,050 ft, give or take 40 ftWalked, so the length is a guide for how far, not a measurement.')
    expect(screen.getByText(/Made Up Plumbing shared this map with you\. The link ends by itself on Feb 11\./)).toBeTruthy()
    expect(document.querySelector('[data-theme="light"]')).not.toBeNull()
  })

  it('draws a place\'s kind as its mark, beside its name and on the map, and a kind it does not know as the plain dot (#393)', async () => {
    const map: SharedPaintedMap = {
      ...MAP,
      places: [
        { id: 'p1', number: 1, name: 'Open trench', words: 'Keep the truck off it.', lat: 29.5, lng: -98.2, photo: false, kind: 'hazard' },
        { id: 'p2', number: 2, name: 'Meter', words: '', lat: 29.5005, lng: -98.199, photo: false },
        { id: 'p3', number: 3, name: 'Hydrant', words: '', lat: 29.5006, lng: -98.199, photo: false, kind: 'fire_hydrant' },
      ],
    }
    open(fakeIo([{ ...OPEN, map } as PaintedWayView]))
    await screen.findByRole('heading', { name: 'The way in for deliveries' })
    const rows = [...document.querySelectorAll('[data-way-place]')]
    expect(rows.map((r) => r.querySelector('[data-place-mark]')?.getAttribute('data-place-mark'))).toEqual(['hazard', 'plain', 'plain'])
    expect(rows[0]!.querySelector('[data-place-mark]')?.getAttribute('aria-label')).toBe('Hazard, place 1')
    expect(rows[0]!.querySelector('[data-place-mark-number]')?.textContent).toBe('1')
    // The row still reads number, name, words, as it did.
    expect(rows[0]!.textContent).toContain('1Open trenchKeep the truck off it.')
    expect(rows[1]!.textContent).toContain('2Meter')
    expect((await screen.findByTestId('canvas')).getAttribute('data-kinds')).toBe('hazard,plain,plain')
  })

  it('points Directions at the start of the first line', async () => {
    open(fakeIo([OPEN]))
    const link = (await screen.findByRole('link', { name: 'Directions to the start' })) as HTMLAnchorElement
    expect(link.href).toContain('destination=29.500000,-98.200000')
  })

  it('asks the phone nothing until Show where I am, says first that the company will see it, then sends where the reader stands', async () => {
    const p = phone()
    const io = fakeIo([OPEN])
    open(io)
    await screen.findByRole('heading', { name: 'The way in for deliveries' })
    expect(p.watches).toBe(0)
    expect(document.querySelector('[data-way-will-see]')?.textContent).toBe('Made Up Plumbing will see where you are while this is on.')
    fireEvent.click(screen.getByRole('button', { name: 'Show where I am' }))
    expect(p.watches).toBe(1)
    expect(document.querySelector('[data-way-where]')?.textContent).toContain('Finding you…')
    // About 380 ft west of the start, on no line.
    act(() => p.ok!({ coords: { latitude: 29.5, longitude: -98.2012, accuracy: 6 } }))
    const where = document.querySelector('[data-way-where]')?.textContent ?? ''
    expect(where).toContain('The start is 380 ft east of you.')
    expect(where).toContain('Your phone is sure within 20 ft.')
    expect(where).toContain('Made Up Plumbing sees where you are while this is on. Press Hide where I am to stop.')
    expect(where).not.toContain('We never see it')
    expect(screen.getByTestId('canvas').textContent).toContain('me:yes frame:yes')
    // The first point goes at once, with the device the map was opened on. A second one a moment later does not.
    expect(io.points).toEqual([{ code: 'q7m2kd4x9p', deviceId: io.asks[0]!.device.id, point: { lat: 29.5, lng: -98.2012, accuracyM: 6 } }])
    act(() => p.ok!({ coords: { latitude: 29.5001, longitude: -98.2012, accuracy: 6 } }))
    expect(io.points).toHaveLength(1)
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
    expect(document.querySelector('[data-way-photo] img')?.getAttribute('src')).toBe('https://fn.test/?code=q7m2kd4x9p&photo=p1&device=yes')
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
    // The sample's gate wears a gate's mark, so the office sees what a kind looks like to a reader.
    expect(screen.getByTestId('canvas').getAttribute('data-kinds')).toBe('gate,plain,plain')
  })

  it('the sample sends no place and says it stays on the phone', async () => {
    const p = phone()
    const io = fakeIo([{ kind: 'gone' }])
    open(io, '/way/sample')
    await screen.findByRole('heading', { name: 'The way in for deliveries' })
    expect(document.querySelector('[data-way-will-see]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show where I am' }))
    act(() => p.ok!({ coords: { latitude: 29.5, longitude: -98.2012, accuracy: 6 } }))
    expect(document.querySelector('[data-way-where]')?.textContent).toContain('Where you are stays on your phone. We never see it.')
    expect(io.points).toEqual([])
  })
})

describe('PaintedWay, who is looking', () => {
  it('asks a reader with no name for one, says what is kept, and shows nothing of the map but its name', async () => {
    const io = fakeIo([ASK_NAME, OPEN])
    open(io)
    expect(await screen.findByRole('heading', { name: 'The way in for deliveries' })).toBeTruthy()
    expect(screen.getByText('Made Up Plumbing')).toBeTruthy()
    expect(screen.queryByTestId('canvas')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Show where I am' })).toBeNull()
    expect(document.querySelector('[data-way-kept]')?.textContent).toBe('Made Up Plumbing keeps your name, the phone or computer you are on, and when you open this map. If you press Show where I am, they also see where you are.')
    // The first ask carries the device and no name.
    expect(io.asks[0]?.name).toBeNull()
    expect(io.asks[0]?.device.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)

    // A name that is no name is refused on the page, with no call.
    fireEvent.click(screen.getByRole('button', { name: 'Open the map' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Type your name to open the map.')
    expect(io.reads).toHaveLength(1)

    fireEvent.change(screen.getByRole('textbox', { name: 'Your name' }), { target: { value: '  Dana   Reyes ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Open the map' }))
    expect(await screen.findByTestId('canvas')).toBeTruthy()
    expect(io.asks[1]).toEqual({ name: 'Dana Reyes', device: io.asks[0]!.device })
    expect(document.querySelector('[data-way-opened-as]')?.textContent).toContain('You opened this map as Dana Reyes.')
  })

  it('keeps the name and the device on the phone, so the same reader is not asked twice', async () => {
    const first = fakeIo([ASK_NAME, OPEN])
    open(first)
    await screen.findByRole('button', { name: 'Open the map' })
    fireEvent.change(screen.getByRole('textbox', { name: 'Your name' }), { target: { value: 'Dana Reyes' } })
    fireEvent.click(screen.getByRole('button', { name: 'Open the map' }))
    await screen.findByTestId('canvas')
    cleanup()

    const second = fakeIo([OPEN])
    open(second, '/way/k3m9pd7x2q')
    await screen.findByTestId('canvas')
    expect(second.asks[0]).toEqual({ name: 'Dana Reyes', device: first.asks[0]!.device })
  })

  it('Not you? forgets the name and asks again, with the dot off', async () => {
    const io = fakeIo([OPEN, { ...OPEN, visitor: { name: 'Sam Ortiz', signedIn: false } }])
    open(io)
    await screen.findByTestId('canvas')
    fireEvent.click(screen.getByRole('button', { name: 'Not you? Change the name' }))
    expect(screen.queryByTestId('canvas')).toBeNull()
    expect(window.localStorage.getItem('pt.way.name')).toBeNull()
    fireEvent.change(screen.getByRole('textbox', { name: 'Your name' }), { target: { value: 'Sam Ortiz' } })
    fireEvent.click(screen.getByRole('button', { name: 'Open the map' }))
    await screen.findByTestId('canvas')
    expect(io.asks[1]?.name).toBe('Sam Ortiz')
    expect(document.querySelector('[data-way-opened-as]')?.textContent).toContain('You opened this map as Sam Ortiz.')
  })

  it('a signed-in teammate is named from their account, and the phone does not keep that name', async () => {
    open(fakeIo([{ ...OPEN, visitor: { name: 'Robert Douglas', signedIn: true } }]))
    await screen.findByTestId('canvas')
    expect(document.querySelector('[data-way-opened-as]')?.textContent).toBe('You opened this map as Robert Douglas. ')
    expect(screen.queryByRole('button', { name: 'Not you? Change the name' })).toBeNull()
    expect(window.localStorage.getItem('pt.way.name')).toBeNull()
  })

  it('a name typed when the signal drops is sent again by Try again, and not asked for twice', async () => {
    const io = fakeIo([ASK_NAME, { kind: 'signal' }, OPEN])
    open(io)
    await screen.findByRole('button', { name: 'Open the map' })
    fireEvent.change(screen.getByRole('textbox', { name: 'Your name' }), { target: { value: 'Dana Reyes' } })
    fireEvent.click(screen.getByRole('button', { name: 'Open the map' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    await screen.findByTestId('canvas')
    expect(io.asks[2]?.name).toBe('Dana Reyes')
  })
})
