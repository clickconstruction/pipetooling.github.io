// @vitest-environment jsdom
/**
 * Painting a walk in a map's window (punch list #345). The bar is red while the phone is read and
 * says so. A locked screen leaves a gap and the person chooses what happens to it. Done opens Look
 * it over, where nothing has left the phone, a line is set right by hand, and Save writes shapes
 * with no time in them. A walk closed unsaved stays on the phone, paused.
 */
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  default: function CanvasStub(props: { lines: Array<{ id: string; poorParts: unknown[] }>; draft?: PaintedCanvasDraft | null; me?: { lat: number } | null; follow?: boolean; dot?: { point: { lat: number; lng: number } } | null }) {
    return (
      <div data-testid="canvas">
        lines:{props.lines.map((l) => `${l.id}${l.poorParts.length ? '~' : ''}`).join(',')} corners:{props.draft ? props.draft.points.length : 'none'} me:{props.me ? 'yes' : 'no'} follow:{props.follow ? 'yes' : 'no'} dot:{props.dot ? 'yes' : 'no'}
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

beforeEach(() => {
  Object.defineProperty(navigator, 'geolocation', { value: {}, configurable: true })
})
afterEach(() => {
  cleanup()
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

  it('shows the length so far beside how sure the phone is, and keeps the person in view', async () => {
    render(<PaintedMapWindow ask={{ start: START }} onClose={() => {}} />)
    await waitFor(() => expect(phone.calls).toEqual(['start']))
    give(walked())
    expect(document.querySelector('[data-painted-walk-readout]')?.textContent).toContain('about 260 ft')
    expect(document.querySelector('[data-painted-sure]')?.textContent).toBe('Sure within 20 ft')
    expect(screen.getByTestId('canvas').textContent).toContain('lines:walk-0 corners:none me:yes follow:yes')
  })

  it('says so when the phone is not sure, and draws that part faint', async () => {
    render(<PaintedMapWindow ask={{ start: START }} onClose={() => {}} />)
    await waitFor(() => expect(phone.calls).toEqual(['start']))
    let s = walked()
    s = walkFix(s, fix(150, -22, 26_000, 40), 26_000)
    s = walkFix(s, fix(200, 18, 30_000, 40), 30_000)
    give(s)
    expect(document.querySelector('[data-painted-sure]')?.getAttribute('data-painted-sure')).toBe('poor')
    expect(screen.getByText(/Only sure within 140 ft here\. This part is drawn faint\./)).toBeTruthy()
    expect(screen.getByTestId('canvas').textContent).toContain('walk-0~')
  })

  it('tells a rough location from a reading, and how to turn Precise Location on', async () => {
    render(<PaintedMapWindow ask={{ start: START }} onClose={() => {}} />)
    await waitFor(() => expect(phone.calls).toEqual(['start']))
    give(walkFix(startWalk(0), fix(0, 0, 1000, 3000), 1000))
    expect(document.querySelector('[data-painted-walk]')?.getAttribute('data-painted-walk')).toBe('rough')
    expect(screen.getByText(/Turn on Precise Location/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Draw it by hand instead' })).toBeTruthy()
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
