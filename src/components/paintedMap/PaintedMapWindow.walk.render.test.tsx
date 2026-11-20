// @vitest-environment jsdom
/**
 * Painting a walk in a map's window (punch list #345). The bar is red while the phone is read and
 * says so. A locked screen leaves a gap and the person chooses what happens to it. Done opens Look
 * it over, where nothing has left the phone, a line is set right by hand, and Save writes shapes
 * with no time in them. A walk closed unsaved stays on the phone, paused. Look it over has its own
 * ＋ Place (punch list #393): the place is saved when it is added, and the walk's lines wait.
 *
 * While the phone is read, one line says how its location is doing in every state (punch list #402).
 * A rough reading waits 4 seconds before the line says the switch looks off, and the map waits the
 * same 4 seconds before it pulls back to the whole circle.
 */
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { fromPlane, type PaintedPoint } from '../../lib/paintedMap/paintedLine'
import type { PaintedFix } from '../../lib/paintedMap/paintedTrack'
import { startWalk, walkFix, walkHidden, walkPause, walkResume, walkShown, type WalkState } from '../../lib/paintedMap/paintedWalk'
import type { PaintedLine, PaintedMap } from '../../lib/paintedMap/paintedMap'
import type { PaintedCanvasDraft } from './PaintedMapCanvas'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me' }, role: 'helpers' }) }))
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => true }))
vi.mock('../../hooks/useModalStackEntry', () => ({ useModalStackEntry: () => () => true }))
vi.mock('../../hooks/useAddressGeocodeCoords', () => ({ useAddressGeocodeCoords: () => ({ coords: new Map(), resolving: false }) }))
vi.mock('../../hooks/useTaskShot', () => ({ useTaskShot: () => ({ shot: null, shrinking: false, kept: false, error: null, pick: async () => {}, clear: () => {}, markKept: () => {} }) }))
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: () => {} }))
vi.mock('../../lib/materials/myLocation', () => ({ requestMyLocation: () => {} }))
/** Which phone the page takes itself to be on. The wait is the real one. */
const device = vi.hoisted(() => ({ kind: 'iphone-safari' as string }))
vi.mock('../../hooks/usePreciseLocation', async (real) => ({ ...(await real<typeof import('../../hooks/usePreciseLocation')>()), usePhoneKind: () => device.kind }))

/** The phone, stood in for: the test hands the walk its state, and the presses run the real rules. */
const phone = vi.hoisted(() => ({
  set: null as null | ((next: unknown) => void),
  setRefusal: null as null | ((next: unknown) => void),
  calls: [] as string[],
  kept: [] as unknown[],
}))
vi.mock('../../hooks/usePaintedWalk', async () => {
  const React = await import('react')
  const rules = await import('../../lib/paintedMap/paintedWalk')
  return {
    writeKeptWalk: (_userId: string, kept: unknown) => phone.kept.push(kept),
    readKeptWalkRaw: () => null,
    usePaintedWalk: () => {
      const [state, setState] = React.useState<WalkState | null>(null)
      const [refusal, setRefusal] = React.useState<string | null>(null)
      phone.set = setState as (next: unknown) => void
      phone.setRefusal = setRefusal as (next: unknown) => void
      return {
        state,
        refusal,
        awake: 'held',
        nowMs: 134_000,
        start: () => { phone.calls.push('start'); setState(rules.startWalk(0)) },
        pause: () => { phone.calls.push('pause'); setState((s) => (s ? rules.walkPause(s, 134_000) : s)) },
        resume: (join: boolean) => { phone.calls.push(`resume:${join}`); setState((s) => (s ? rules.walkResume(s, join, 134_000) : s)) },
        restore: (kept: WalkState) => { phone.calls.push('restore'); setState(kept) },
        clear: () => { phone.calls.push('clear'); setState(null) },
      }
    },
  }
})

const io = vi.hoisted(() => ({ whole: null as unknown, calls: [] as Array<{ fn: string; args: unknown[] }>, refuseLine: null as string | null }))
vi.mock('../../lib/paintedMap/paintedMapIo', () => ({
  loadPaintedMap: async () => ({ ok: true, value: io.whole }),
  loadPaintedMapsFor: async () => ({ ok: true, value: [] }),
  loadPainterNames: async () => new Map([['me', 'Marcus Hale']]),
  paintedPlacePhotoUrls: async () => new Map(),
  createPaintedMap: async (input: { id: string; name: string; jobId?: string | null; by: string }) => { io.calls.push({ fn: 'createPaintedMap', args: [input] }); return { ok: true, value: { id: input.id, name: input.name, words: '', jobId: input.jobId ?? null, developmentId: null, createdBy: input.by, createdAt: '2026-11-13T16:00:00Z' } } },
  addPaintedLine: async (mapId: string, draft: { how: string; points: unknown[]; poorParts?: unknown[]; fixedByHand?: boolean; marginM?: number | null }, by: string) => {
    io.calls.push({ fn: 'addPaintedLine', args: [mapId, draft, by] })
    if (io.refuseLine) return { ok: false, error: io.refuseLine }
    return { ok: true, value: { id: `line-${io.calls.length}`, mapId, label: '', how: draft.how, points: draft.points, poorParts: draft.poorParts ?? [], fixedByHand: draft.fixedByHand === true, lengthM: 80, marginM: draft.marginM ?? null, measuredFt: null, measuredHow: null, madeBy: by, madeAt: '2026-11-13T16:00:00Z' } }
  },
  addPaintedPlace: async (mapId: string, place: Record<string, unknown>, by: string) => { io.calls.push({ fn: 'addPaintedPlace', args: [mapId, place, by] }); return { ok: true, value: { id: 'place-1', mapId, name: (place.name as string) || 'A place', words: '', lat: place.lat, lng: place.lng, accuracyM: place.accuracyM ?? null, photoPath: null, setBy: by, setAt: '2026-11-13T16:01:00Z' } } },
  savePaintedLineShape: async () => ({ ok: false, error: 'unused' }),
  savePaintedLineMeasure: async () => ({ ok: false, error: 'unused' }),
  savePaintedMapWords: async () => ({ ok: false, error: 'unused' }),
  savePaintedPlace: async () => ({ ok: false, error: 'unused' }),
  deletePaintedLine: async () => ({ ok: true, value: true }),
  deletePaintedMap: async () => ({ ok: true, value: true }),
  deletePaintedPlace: async () => ({ ok: true, value: true }),
  uploadPaintedPlacePhoto: async () => ({ ok: false, error: 'unused' }),
  removePaintedPlacePhotoFile: async () => {},
}))

vi.mock('./PaintedMapCanvas', () => ({
  default: function CanvasStub(props: { lines: Array<{ id: string; poorParts: unknown[] }>; places?: Array<{ name: string; number: number }>; draft?: PaintedCanvasDraft | null; me?: { lat: number; accuracyM: number | null; area?: boolean } | null; follow?: boolean; frameMargin?: boolean; time?: unknown; dot?: { point: { lat: number; lng: number } } | null }) {
    return (
      <div data-testid="canvas">
        area:{props.me?.area ? `yes ${props.me.accuracyM}` : 'no'} margin:{props.frameMargin ? 'yes' : 'no'} time:{props.time ? 'yes' : 'no'} lines:{props.lines.map((l) => `${l.id}${l.poorParts.length ? '~' : ''}`).join(',')} corners:{props.draft ? props.draft.points.length : 'none'} me:{props.me ? 'yes' : 'no'} follow:{props.follow ? 'yes' : 'no'} dot:{props.dot ? 'yes' : 'no'} places:{(props.places ?? []).map((pl) => `${pl.number} ${pl.name}`).join(',')}
        {props.draft ? <button type="button" onClick={() => props.draft!.onMove(0, { lat: 29.5001, lng: -98.2001 })}>move the first corner</button> : null}
      </div>
    )
  },
}))

import { PaintedMapWindow } from './PaintedMapWindow'

const ORIGIN: PaintedPoint = { lat: 29.5, lng: -98.2 }
const fix = (eastM: number, northM: number, atMs: number, accuracyM: number | null = 5): PaintedFix => ({ ...fromPlane(ORIGIN, { x: eastM, y: northM }), accuracyM, atMs })
/** A walk of 80 m east, a reading every two seconds. */
const walked = (): WalkState => {
  let s = startWalk(0)
  for (let i = 0; i <= 10; i++) s = walkFix(s, fix(i * 8, 0, i * 2000), i * 2000)
  return s
}
const START = { id: 'new-map', name: 'The way in', words: '', first: 'walk' as const, home: { jobId: 'j1', label: 'Lot 14' } }
const MAP: PaintedMap = { id: 'm1', name: 'The way in for deliveries', words: '', jobId: 'j1', developmentId: null, createdBy: 'me', createdAt: '2026-11-13T15:00:00Z' }
const LINE: PaintedLine = { id: 'l1', mapId: 'm1', label: '', how: 'drawn', points: [{ lat: 29.5, lng: -98.2 }, { lat: 29.501, lng: -98.2 }], poorParts: [], fixedByHand: false, lengthM: 111, marginM: 2, measuredFt: null, measuredHow: null, madeBy: 'me', madeAt: '2026-11-13T15:05:00Z' }

const give = (state: WalkState | null) => act(() => phone.set!(state))
const names = () => io.calls.map((c) => c.fn)
const bar = () => document.querySelector('[data-painted-bar]')
const line = () => document.querySelector('[data-precise]')
const panel = () => document.querySelector('[data-painted-walk]')?.getAttribute('data-painted-walk')
const canvas = () => screen.getByTestId('canvas').textContent ?? ''
const pill = () => document.querySelector('[data-painted-rough-circle]')?.textContent ?? null
/** One rough reading, 3,000 m wide, on a walk that has just started. */
const roughWalk = () => walkFix(startWalk(0), fix(0, 0, 1000, 3000), 1000)
const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })

beforeEach(() => {
  Object.defineProperty(navigator, 'geolocation', { value: {}, configurable: true })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  device.kind = 'iphone-safari'
  delete (navigator as unknown as { geolocation?: unknown }).geolocation
  phone.calls = []
  phone.kept = []
  io.whole = null
  io.calls = []
  io.refuseLine = null
})

describe('painting', () => {
  it('starts reading once when a map starts with a walk, and the bar says Painting', async () => {
    render(<PaintedMapWindow ask={{ start: START }} onClose={() => {}} />)
    await waitFor(() => expect(phone.calls).toEqual(['start']))
    expect(bar()?.getAttribute('data-painted-bar')).toBe('painting')
    expect(bar()?.textContent).toContain('Painting · 2:14')
    // Nothing to look over yet: Done waits for a line.
    expect((screen.getByRole('button', { name: 'Done' }) as HTMLButtonElement).disabled).toBe(true)
    expect(names()).toEqual([])
  })

  it('says it is finding you before the first reading, and draws nobody on the map', async () => {
    render(<PaintedMapWindow ask={{ start: START }} onClose={() => {}} />)
    await waitFor(() => expect(phone.calls).toEqual(['start']))
    expect(line()?.getAttribute('data-precise')).toBe('finding')
    expect(line()?.textContent).toBe('Finding you… This takes a few seconds in the open.')
    expect(canvas()).toContain('me:no')
    // The map frames by how sure the phone is for as long as the phone is read. Time is for a map that is only read.
    expect(canvas()).toContain('margin:yes time:no')
  })

  it('shows the length so far over a line that says Precise Location is on, and keeps the person in view', async () => {
    render(<PaintedMapWindow ask={{ start: START }} onClose={() => {}} />)
    await waitFor(() => expect(phone.calls).toEqual(['start']))
    give(walked())
    expect(document.querySelector('[data-painted-walk-readout]')?.textContent).toContain('about 260 ft')
    // The chip at the right is gone: the line under the length says it, with the switch named.
    expect(document.querySelector('[data-painted-sure]')).toBeNull()
    expect(line()?.getAttribute('data-precise')).toBe('on')
    expect(line()?.textContent).toBe('Precise Location is on. Sure within 20 ft.')
    expect(line()?.querySelector('[data-precise-tick]')).toBeTruthy()
    expect(canvas()).toContain('area:no margin:yes time:no lines:walk-0 corners:none me:yes follow:yes')
  })

  it('clears the switch and blames the signal when the phone is not sure, and draws that part faint', async () => {
    render(<PaintedMapWindow ask={{ start: START }} onClose={() => {}} />)
    await waitFor(() => expect(phone.calls).toEqual(['start']))
    let s = walked()
    s = walkFix(s, fix(150, -22, 26_000, 40), 26_000)
    s = walkFix(s, fix(200, 18, 30_000, 40), 30_000)
    give(s)
    expect(line()?.getAttribute('data-precise')).toBe('weak')
    expect(line()?.textContent).toBe('Precise Location is on, but the signal is weak here. Your phone is only sure within 140 ft. This part is drawn faint. Fix it by hand when you look the line over.')
    expect(panel()).toBe('painting')
    expect(canvas()).toContain('walk-0~')
    expect(canvas()).toContain('area:no')
  })

  it('says only that the signal is weak past 100 m, where the margin no longer proves the switch', async () => {
    render(<PaintedMapWindow ask={{ start: START }} onClose={() => {}} />)
    await waitFor(() => expect(phone.calls).toEqual(['start']))
    give(walkFix(startWalk(0), fix(0, 0, 1000, 300), 1000))
    expect(line()?.textContent).toBe('The signal is weak here. Your phone is only sure within 990 ft. This part is drawn faint. Fix it by hand when you look the line over.')
    expect(canvas()).toContain('me:yes')
  })

  it('waits 4 seconds on a rough reading before it says the switch looks off, and the map waits with it', async () => {
    render(<PaintedMapWindow ask={{ start: START }} onClose={() => {}} />)
    await waitFor(() => expect(phone.calls).toEqual(['start']))
    vi.useFakeTimers()
    give(roughWalk())
    // A first reading off a cell tower is rough too: the line is still finding you, and the map has not moved or drawn it.
    expect(panel()).toBe('painting')
    expect(line()?.textContent).toBe('Finding you… This takes a few seconds in the open.')
    expect(canvas()).toContain('area:no')
    expect(canvas()).toContain('me:no')
    expect(pill()).toBeNull()
    wait(3999)
    expect(panel()).toBe('painting')
    expect(canvas()).toContain('me:no')
    wait(1)
    // The same moment for both: the way to the switch on the panel, and the whole circle on the map.
    expect(panel()).toBe('rough')
    const alert = screen.getByRole('alert')
    expect(alert.querySelector('b')?.textContent).toBe('Precise Location looks off.')
    expect(alert.querySelector('[data-precise-compare]')?.textContent).toBe('Your phone nowwithin 2 milesWith Precise Location onwithin 20 ft')
    expect(alert.querySelector('[data-precise-note]')?.textContent).toBe('A line cannot be painted from a reading that wide.')
    expect([...alert.querySelectorAll('ol[data-precise-steps] li')].map((li) => li.textContent)).toEqual(['Open the Settings app.', 'Tap Privacy & Security, then Location Services.', 'Tap Safari Websites.', 'Turn on Precise Location.', 'Come back to this screen.'])
    expect(alert.querySelector('[data-precise-already-on]')?.textContent).toBe('Already on? Step into the open and wait a moment. The phone may only be hearing a cell tower.')
    expect(alert.textContent).not.toMatch(/is off/)
    expect(canvas()).toContain('area:yes 3000 margin:yes')
    expect(canvas()).toContain('me:yes')
    expect(pill()).toBe('You are somewhere in this circle, 4 miles across.')
    expect(screen.getByRole('button', { name: 'Draw it by hand instead' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy()
  })

  it('never calls the switch off when a better reading comes inside the wait, and clears it at once when one comes after', async () => {
    render(<PaintedMapWindow ask={{ start: START }} onClose={() => {}} />)
    await waitFor(() => expect(phone.calls).toEqual(['start']))
    vi.useFakeTimers()
    let s = roughWalk()
    give(s)
    wait(2500)
    s = walkFix(s, fix(0, 0, 3500, 6), 3500)
    give(s)
    expect(line()?.textContent).toBe('Precise Location is on. Sure within 20 ft.')
    // The first timer is gone with the rough reading: nothing turns rough when its 4 seconds would have been up.
    wait(10_000)
    expect(panel()).toBe('painting')
    expect(line()?.getAttribute('data-precise')).toBe('on')
    expect(canvas()).toContain('area:no')
    // Rough again: a whole new wait.
    s = walkFix(s, fix(0, 0, 14_000, 3000), 14_000)
    give(s)
    wait(3999)
    expect(panel()).toBe('painting')
    wait(1)
    expect(panel()).toBe('rough')
    expect(pill()).not.toBeNull()
    // And a sure reading takes it all back in the same draw.
    give(walkFix(s, fix(0, 0, 19_000, 4), 19_000))
    expect(panel()).toBe('painting')
    expect(line()?.textContent).toBe('Precise Location is on. Sure within 15 ft.')
    expect(canvas()).toContain('area:no')
    expect(pill()).toBeNull()
  })

  it('starts the wait over after a pause, so coming back from Settings reads as finding you and not as off', async () => {
    render(<PaintedMapWindow ask={{ start: START }} onClose={() => {}} />)
    await waitFor(() => expect(phone.calls).toEqual(['start']))
    vi.useFakeTimers()
    give(roughWalk())
    wait(4000)
    expect(panel()).toBe('rough')
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    // The phone is not being read: no line about its location, no circle and no pill.
    expect(panel()).toBe('paused-press')
    expect(line()).toBeNull()
    expect(canvas()).toContain('area:no margin:no')
    expect(canvas()).toContain('me:no')
    expect(pill()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Keep painting' }))
    expect(panel()).toBe('painting')
    expect(line()?.textContent).toBe('Finding you… This takes a few seconds in the open.')
    wait(3999)
    expect(panel()).toBe('painting')
    wait(1)
    expect(panel()).toBe('rough')
  })

  it('gives an Android phone its own names and steps, and a desk one line for each kind of phone', async () => {
    device.kind = 'android'
    const view = render(<PaintedMapWindow ask={{ start: START }} onClose={() => {}} />)
    await waitFor(() => expect(phone.calls).toEqual(['start']))
    vi.useFakeTimers()
    give(roughWalk())
    wait(4000)
    let alert = screen.getByRole('alert')
    expect(alert.querySelector('b')?.textContent).toBe('Precise location looks off.')
    expect(alert.querySelector('[data-precise-compare]')?.textContent).toContain('With Use precise location on')
    expect([...alert.querySelectorAll('ol[data-precise-steps] li')].map((li) => li.textContent)).toEqual(['Press and hold the browser’s icon, then tap App info.', 'Tap Permissions, then Location.', 'Turn on Use precise location.', 'Come back to this screen.'])
    view.unmount()
    vi.useRealTimers()
    phone.calls = []

    device.kind = 'other'
    render(<PaintedMapWindow ask={{ start: START }} onClose={() => {}} />)
    await waitFor(() => expect(phone.calls).toEqual(['start']))
    vi.useFakeTimers()
    give(roughWalk())
    wait(4000)
    alert = screen.getByRole('alert')
    // No switch is named in the line, and nothing is set beside the phone's number: a desk has no switch.
    expect(alert.querySelector('b')?.textContent).toBe('This device only knows the area it is in.')
    expect(alert.querySelector('[data-precise-compare]')).toBeNull()
    expect(alert.textContent).toContain('It is only sure within 2 miles. A line cannot be painted from a reading that wide.')
    expect(alert.querySelectorAll('ul[data-precise-steps] li')).toHaveLength(2)
    expect(alert.querySelector('ol')).toBeNull()
  })

  it('never dead-ends a refusal: drawing by hand opens with nothing lost', async () => {
    render(<PaintedMapWindow ask={{ start: START }} onClose={() => {}} />)
    await waitFor(() => expect(phone.calls).toEqual(['start']))
    act(() => phone.setRefusal!('refused'))
    expect(screen.getByRole('alert').textContent).toContain('Location is off for this app')
    fireEvent.click(screen.getByRole('button', { name: 'Draw it by hand instead' }))
    expect(screen.getByRole('heading', { name: 'Draw it by hand' })).toBeTruthy()
    expect(phone.calls).toContain('clear')
  })
})

describe('pause, a locked screen, and restart', () => {
  it('turns the bar grey on Pause and says nothing is being read', async () => {
    render(<PaintedMapWindow ask={{ start: START }} onClose={() => {}} />)
    await waitFor(() => expect(phone.calls).toEqual(['start']))
    give(walked())
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    expect(bar()?.getAttribute('data-painted-bar')).toBe('paused')
    expect(bar()?.textContent).toContain('The phone is not being read')
    expect(screen.getByTestId('canvas').textContent).toContain('follow:no')
    fireEvent.click(screen.getByRole('button', { name: 'Keep painting' }))
    expect(phone.calls).toContain('resume:false')
  })

  it('says a locked screen left a gap, for how long, and offers both ways on', async () => {
    render(<PaintedMapWindow ask={{ start: START }} onClose={() => {}} />)
    await waitFor(() => expect(phone.calls).toEqual(['start']))
    give(walkShown(walkHidden(walked(), 30_000), 150_000))
    expect(screen.getByText('The screen was off for 2 minutes, so the line has a gap.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Keep painting from here' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Join the gap with a straight line' }))
    expect(phone.calls).toContain('resume:true')
  })
})

describe('look it over, then save', () => {
  const toReview = async () => {
    render(<PaintedMapWindow ask={{ start: START }} onClose={() => {}} />)
    await waitFor(() => expect(phone.calls).toEqual(['start']))
    give(walked())
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    await screen.findByRole('heading', { name: 'Look it over' })
  }

  it('stops reading on Done and shows what will be kept, with nothing sent', async () => {
    await toReview()
    expect(phone.calls).toContain('clear')
    expect(document.querySelector('[data-painted-review-total]')?.textContent).toContain('About 260 ft')
    expect(document.querySelector('[data-painted-review-line]')?.textContent).toContain('give or take 45 ft')
    expect(document.querySelector('[data-painted-review-line]')?.textContent).toContain('walked')
    expect(screen.getByText(/Nothing has left this phone yet/)).toBeTruthy()
    expect(screen.getByTestId('canvas').textContent).toContain('lines:pending-0')
    expect(names()).toEqual([])
  })

  it('saves the map and the line as shapes: no reading\'s time goes with them', async () => {
    await toReview()
    fireEvent.click(screen.getByRole('button', { name: 'Save the map' }))
    await waitFor(() => expect(names()).toEqual(['createPaintedMap', 'addPaintedLine']))
    const [mapId, draft, by] = io.calls[1]!.args as [string, { how: string; points: Array<Record<string, unknown>>; marginM: number }, string]
    expect(mapId).toBe('new-map')
    expect(by).toBe('me')
    expect(draft.how).toBe('walked')
    expect(draft.points.length).toBeGreaterThanOrEqual(2)
    expect(Object.keys(draft.points[0]!).sort()).toEqual(['lat', 'lng'])
    expect(JSON.stringify(io.calls)).not.toMatch(/atMs|accuracyM/)
    // Saved: the walk is no longer kept on the phone.
    await waitFor(() => expect(phone.kept[phone.kept.length - 1]).toBeNull())
    await screen.findByRole('button', { name: 'Draw a line' })
  })

  it('sets a line right by hand before it is saved, and says so on the line', async () => {
    await toReview()
    fireEvent.click(screen.getByRole('button', { name: 'Fix this line by hand' }))
    expect(screen.getByRole('heading', { name: 'Fix the line by hand' })).toBeTruthy()
    // The line being set right is the draft now, not also drawn under itself.
    expect(screen.getByTestId('canvas').textContent).toContain('lines: corners:2')
    fireEvent.click(screen.getByRole('button', { name: 'move the first corner' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use this line' }))
    await screen.findByRole('heading', { name: 'Look it over' })
    expect(document.querySelector('[data-painted-review-line]')?.textContent).toContain('walked, a part drawn by hand')
    expect(names()).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Save the map' }))
    await waitFor(() => expect(names()).toContain('addPaintedLine'))
    expect((io.calls.find((c) => c.fn === 'addPaintedLine')!.args[1] as { fixedByHand: boolean }).fixedByHand).toBe(true)
  })

  it('keeps the line on the phone when the save does not land, and says to press Save again', async () => {
    io.refuseLine = 'Failed to fetch'
    await toReview()
    fireEvent.click(screen.getByRole('button', { name: 'Save the map' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Failed to fetch The line is kept on this phone. Press Save again when you have signal.')
    expect(document.querySelectorAll('[data-painted-review-line]')).toHaveLength(1)
    expect(phone.kept[phone.kept.length - 1]).not.toBeNull()
  })

  it('throws a walk away only after a confirm, and then nothing is left on the phone', async () => {
    await toReview()
    fireEvent.click(screen.getByRole('button', { name: 'Throw it away' }))
    expect(screen.getByText('Throw the walk away?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Throw the walk away' }))
    await waitFor(() => expect(phone.kept[phone.kept.length - 1]).toBeNull())
    expect(names()).toEqual([])
    expect(screen.getByText(/Nothing is painted on this map yet/)).toBeTruthy()
  })

  it('has its own ＋ Place: the place panel opens, the place is saved at once, and it shows with the walk\'s lines (#393)', async () => {
    await toReview()
    fireEvent.click(screen.getByRole('button', { name: '＋ Place' }))
    expect(screen.getByRole('heading', { name: 'A place on the map' })).toBeTruthy()
    // The dot is there to drag, over the lines that are still waiting. The phone is not read for it.
    expect(screen.getByTestId('canvas').textContent).toContain('lines:pending-0 corners:none me:no follow:no dot:yes')
    expect(phone.calls).toEqual(['start', 'clear'])
    fireEvent.click(screen.getByRole('button', { name: 'Gate' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add this place' }))
    await waitFor(() => expect(names()).toEqual(['createPaintedMap', 'addPaintedPlace']))
    // Set by hand: no reading's margin goes with it.
    expect(io.calls[1]!.args[1]).toMatchObject({ name: 'Gate', accuracyM: null })
    // Back on Look it over, with the place numbered beside the press and on the map with the line.
    await screen.findByRole('heading', { name: 'Look it over' })
    expect(screen.getByTestId('canvas').textContent).toContain('lines:pending-0')
    expect(screen.getByTestId('canvas').textContent).toContain('dot:no places:1 Gate')
    expect(document.querySelector('[data-painted-review-place-set]')?.textContent).toBe('1Gate')
    expect(screen.getByText(/A place is saved when you add it/)).toBeTruthy()
    // The small print no longer says nothing has left the phone: the place has.
    expect(screen.queryByText(/Nothing has left this phone yet/)).toBeNull()
    expect(screen.getByText(/What you painted has not left this phone yet/)).toBeTruthy()
    // The map was made by the place, so the walk's line is added to it: the map is not made twice.
    fireEvent.click(screen.getByRole('button', { name: 'Save the line' }))
    await waitFor(() => expect(names()).toEqual(['createPaintedMap', 'addPaintedPlace', 'addPaintedLine']))
    await screen.findByRole('button', { name: 'Draw a line' })
    expect(document.querySelector('[data-painted-place-row]')?.textContent).toContain('Gate')
  })

  it('goes back to Look it over when the place is cancelled, with nothing sent (#393)', async () => {
    await toReview()
    fireEvent.click(screen.getByRole('button', { name: '＋ Place' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('heading', { name: 'Look it over' })).toBeTruthy()
    expect(document.querySelectorAll('[data-painted-review-line]')).toHaveLength(1)
    expect(document.querySelector('[data-painted-review-place-set]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Save the map' })).toBeTruthy()
    expect(names()).toEqual([])
  })

  it('says the map keeps what is saved when a walk is thrown away after a place (#393)', async () => {
    await toReview()
    fireEvent.click(screen.getByRole('button', { name: '＋ Place' }))
    fireEvent.click(screen.getByRole('button', { name: 'Meter' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add this place' }))
    await screen.findByRole('heading', { name: 'Look it over' })
    fireEvent.click(screen.getByRole('button', { name: 'Throw it away' }))
    const ask = screen.getByRole('alertdialog')
    expect(ask.textContent).toContain('The lines you painted go from this phone. What is already saved on the map stays.')
    expect(ask.textContent).not.toContain('nothing is left behind')
    fireEvent.click(within(ask).getByRole('button', { name: 'Throw the walk away' }))
    // The walk is gone and the place is still on the map.
    await screen.findByRole('button', { name: 'Draw a line' })
    expect(document.querySelector('[data-painted-place-row]')?.textContent).toContain('Meter')
    expect(names()).toEqual(['createPaintedMap', 'addPaintedPlace'])
  })

  it('opens the map itself after a place added from a Look it over with no line (#393)', async () => {
    render(<PaintedMapWindow ask={{ start: START }} kept={{ state: null, pending: [] }} center={{ lat: 29.5, lng: -98.2 }} onClose={() => {}} />)
    await screen.findByRole('heading', { name: 'Look it over' })
    expect(screen.getByText(/The phone did not move far enough to draw a line/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '＋ Place' }))
    fireEvent.click(screen.getByRole('button', { name: 'Park here' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add this place' }))
    await waitFor(() => expect(names()).toEqual(['createPaintedMap', 'addPaintedPlace']))
    expect(io.calls[1]!.args[1]).toMatchObject({ name: 'Park here', lat: 29.5, lng: -98.2 })
    // Nothing is left to look over, so the map shows what it has.
    await screen.findByRole('button', { name: 'Draw a line' })
    expect(screen.queryByRole('heading', { name: 'Look it over' })).toBeNull()
  })

  it('goes on painting from Look it over, and keeps what was already looked over', async () => {
    await toReview()
    phone.calls = []
    fireEvent.click(screen.getByRole('button', { name: 'Keep painting' }))
    expect(phone.calls).toEqual(['start'])
    expect(screen.getByTestId('canvas').textContent).toContain('lines:pending-0')
    expect(document.querySelector('[data-painted-walk-readout]')?.textContent).toContain('about 260 ft')
  })
})

describe('a walk and the phone it lives on', () => {
  it('keeps the walk on the phone as it goes, with the map it is for', async () => {
    render(<PaintedMapWindow ask={{ start: START }} address="1 Made Up Road" onClose={() => {}} />)
    await waitFor(() => expect(phone.calls).toEqual(['start']))
    give(walked())
    await waitFor(() => expect(phone.kept.length).toBeGreaterThan(0))
    const last = phone.kept[phone.kept.length - 1] as { map: { mapId: string; start: { name: string } | null; address: string | null }; state: WalkState }
    expect(last.map).toMatchObject({ mapId: 'new-map', start: { name: 'The way in' }, address: '1 Made Up Road' })
    expect(last.state.current).toHaveLength(11)
  })

  it('asks before closing mid-walk, then stops reading and leaves the walk on the phone, paused', async () => {
    let closed = 0
    render(<PaintedMapWindow ask={{ start: START }} onClose={() => (closed += 1)} />)
    await waitFor(() => expect(phone.calls).toEqual(['start']))
    give(walked())
    fireEvent.click(screen.getByRole('button', { name: 'Close the painted map' }))
    expect(screen.getByText('Close the map?')).toBeTruthy()
    expect(closed).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Close, and keep the walk on this phone' }))
    expect(closed).toBe(1)
    expect(phone.calls).toContain('pause')
    const last = phone.kept[phone.kept.length - 1] as { state: WalkState }
    expect(last.state.status).toBe('paused')
    expect(last.state.strokes).toHaveLength(1)
  })

  it('the same question throws the walk away: three presses, and the phone keeps nothing (v2.7690)', async () => {
    let closed = 0
    render(<PaintedMapWindow ask={{ start: START }} onClose={() => (closed += 1)} />)
    await waitFor(() => expect(phone.calls).toEqual(['start']))
    give(walked())
    await waitFor(() => expect(phone.kept.length).toBeGreaterThan(0))
    fireEvent.click(screen.getByRole('button', { name: 'Close the painted map' }))
    const ask = screen.getByRole('alertdialog')
    // Keep, throw away, stay: in that order down the window, the keep in blue over the red press.
    expect(within(ask).getAllByRole('button').map((b) => [b.textContent, b.style.order])).toEqual([
      ['Close, and keep the walk on this phone', '1'],
      ['Stay', '3'],
      ['Close, and throw the walk away', '2'],
    ])
    fireEvent.click(within(ask).getByRole('button', { name: 'Stay' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(closed).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: 'Close the painted map' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close, and throw the walk away' }))
    expect(closed).toBe(1)
    expect(phone.calls).toContain('clear')
    expect(phone.calls).not.toContain('pause')
    // The last thing written to the phone is nothing: the app has no walk to offer back.
    expect(phone.kept[phone.kept.length - 1]).toBeNull()
  })

  it('takes up a walk found on the phone: paused, with its gap, and reads nothing until asked', async () => {
    const kept = walkShown(walkHidden(walked(), 30_000), 400_000)
    render(<PaintedMapWindow ask={{ start: START }} kept={{ state: kept, pending: [] }} onClose={() => {}} />)
    await waitFor(() => expect(phone.calls).toEqual(['restore']))
    expect(bar()?.getAttribute('data-painted-bar')).toBe('paused')
    expect(screen.getByText(/The screen was off for 6 minutes, so the line has a gap\./)).toBeTruthy()
  })

  it('opens Look it over for lines that were looked over and never saved', async () => {
    const stroke = { how: 'walked' as const, points: [{ lat: 29.5, lng: -98.2 }, { lat: 29.5005, lng: -98.2 }], poorParts: [], fixedByHand: false, marginM: 12, lengthM: 55 }
    render(<PaintedMapWindow ask={{ start: START }} kept={{ state: null, pending: [stroke] }} onClose={() => {}} />)
    await screen.findByRole('heading', { name: 'Look it over' })
    expect(phone.calls).toEqual([])
    expect(document.querySelector('[data-painted-review-total]')?.textContent).toContain('About 180 ft')
  })

  it('adds a place during a walk where the phone last was, and goes back to the walk', async () => {
    render(<PaintedMapWindow ask={{ start: START }} onClose={() => {}} />)
    await waitFor(() => expect(phone.calls).toEqual(['start']))
    give(walked())
    fireEvent.click(screen.getByRole('button', { name: '＋ Place' }))
    expect(screen.getByRole('heading', { name: 'A place on the map' })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('Found you. Your phone is sure within 20 ft.')
    fireEvent.click(screen.getByRole('button', { name: 'Gate' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add this place' }))
    await waitFor(() => expect(names()).toEqual(['createPaintedMap', 'addPaintedPlace']))
    expect(io.calls[1]!.args[1]).toMatchObject({ name: 'Gate', accuracyM: 5 })
    // Back on the walk, which was never stopped.
    await waitFor(() => expect(bar()?.getAttribute('data-painted-bar')).toBe('painting'))
    expect(phone.calls).not.toContain('pause')
    expect(phone.calls).not.toContain('clear')
  })

  it('walks a new line onto a saved map, and saving adds the line without making the map again', async () => {
    io.whole = { map: MAP, lines: [LINE], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Walk or drive a line' }))
    expect(phone.calls).toEqual(['start'])
    give(walked())
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Save the line' }))
    await waitFor(() => expect(names()).toEqual(['addPaintedLine']))
    expect(io.calls[0]!.args[0]).toBe('m1')
  })
})

describe('the rules the test leans on', () => {
  it('a press-pause then a restart is two strokes', () => {
    let s = walkResume(walkPause(walked(), 30_000), false, 60_000)
    for (let i = 0; i <= 5; i++) s = walkFix(s, fix(300 + i * 8, 0, 61_000 + i * 2000), 61_000 + i * 2000)
    expect(s.strokes).toHaveLength(1)
    expect(s.current.length).toBeGreaterThan(1)
  })
})
