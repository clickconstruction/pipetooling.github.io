// @vitest-environment jsdom
/**
 * The host for painted maps (punch list #345). It answers any screen that asks for a map, and it
 * offers back a walk that was kept on the phone and never saved. A kept walk is never left there
 * unseen: it is offered, or it is thrown away.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render as renderBare, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { fromPlane } from '../../lib/paintedMap/paintedLine'
import { startWalk, walkFix, walkPause, type WalkState } from '../../lib/paintedMap/paintedWalk'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me' }, role: 'helpers' }) }))

const phone = vi.hoisted(() => ({ raw: null as string | null, writes: [] as unknown[] }))
vi.mock('../../hooks/usePaintedWalk', () => ({
  readKeptWalkRaw: () => phone.raw,
  writeKeptWalk: (_userId: string, kept: unknown) => {
    phone.writes.push(kept)
    phone.raw = kept ? JSON.stringify(kept) : null
  },
}))
/** The places that wait on this phone for a signal, stood in for (punch list #413, step 2b). */
const spots = vi.hoisted(() => ({ waiting: 0, sends: 0, sendLeaves: 0, sendError: null as string | null }))
vi.mock('../../lib/paintedMap/paintedKeptSpotIo', () => ({
  readKeptSpots: () => Array.from({ length: spots.waiting }, (_, i) => ({ id: `s${i}` })),
  sendKeptSpots: async () => {
    spots.sends += 1
    const sent = spots.waiting - spots.sendLeaves
    spots.waiting = spots.sendLeaves
    return { sent, waiting: spots.waiting, error: spots.sendError }
  },
}))
vi.mock('./PaintAMapStartSheet', () => ({
  PaintAMapStartSheet: (props: { home: { jobId?: string }; onStart: (s: unknown) => void; onClose: () => void }) => (
    <div data-testid="sheet">
      sheet for {props.home.jobId ?? 'nothing'}
      <button type="button" onClick={() => props.onStart({ id: 'new', name: 'N', words: '', home: props.home })}>start</button>
    </div>
  ),
}))
vi.mock('./PaintedMapWindow', () => ({
  PaintedMapWindow: (props: { ask: { mapId?: string; start?: { id: string } }; kept?: { state: WalkState | null; pending: unknown[] } | null; address?: string | null; openOn?: 'place' | null; onClose: () => void }) => (
    <div data-testid="window" data-open-on={props.openOn ?? 'nothing'}>
      {props.ask.mapId ? `map ${props.ask.mapId}` : `new ${props.ask.start?.id}`} kept:{props.kept ? `${props.kept.state?.status ?? 'none'}/${props.kept.pending.length}` : 'no'} at:{props.address ?? 'nowhere'}
      <button type="button" onClick={props.onClose}>close</button>
    </div>
  ),
}))

import { openPaintedMap, paintPaintedMap, startPaintedMap } from '../../lib/paintedMap/paintedMapDoor'
import { PAINTED_MAP_WINDOWS, PaintedMapHost } from './PaintedMapHost'

// The host loads its two windows on demand (`lazyWindow`). Loaded here, each is drawn the moment it is asked for,
// as it is in the app once its code is on the device.
beforeAll(async () => {
  await Promise.all(PAINTED_MAP_WINDOWS.map((w) => w.preload()))
})

const walked = (): WalkState => {
  let s = startWalk(0)
  for (let i = 0; i <= 10; i++) s = walkFix(s, { ...fromPlane({ lat: 29.5, lng: -98.2 }, { x: i * 8, y: 0 }), accuracyM: 5, atMs: i * 2000 }, i * 2000)
  return walkPause(s, 30_000)
}
const keep = (state: WalkState | null, pending: unknown[] = [], start: unknown = { id: 'new-map', name: 'The way in', words: '', home: { jobId: 'j1' } }) =>
  JSON.stringify({ savedAtMs: Date.now() - 60_000, map: { mapId: 'new-map', start, address: '1 Made Up Road', pending }, state })

afterEach(() => {
  cleanup()
  phone.raw = null
  phone.writes = []
})

/** The host reads the address, so it stands inside a router; `at` is the address it is opened on. */
const Where = () => <span data-testid="where">{useLocation().search}</span>
const render = (ui: ReactElement, at = '/dashboard') =>
  renderBare(
    <MemoryRouter initialEntries={[at]}>
      {ui}
      <Where />
    </MemoryRouter>,
  )

describe('the header search\'s doors', () => {
  it('opens the start sheet with no job, and takes the key off the address', () => {
    render(<PaintedMapHost />, '/dashboard?paintMap=1')
    expect(screen.getByTestId('sheet').textContent).toContain('sheet for nothing')
    expect(screen.getByTestId('where').textContent).toBe('')
  })

  it('opens the map a door names, and leaves the rest of the address', () => {
    render(<PaintedMapHost />, '/jobs?tab=stages&paintedMap=11111111-1111-4111-8111-111111111111')
    expect(screen.getByTestId('window').textContent).toContain('map 11111111-1111-4111-8111-111111111111')
    expect(screen.getByTestId('where').textContent).toBe('?tab=stages')
  })

  it('opens nothing for an id that is not an id', () => {
    render(<PaintedMapHost />, '/dashboard?paintedMap=nope')
    expect(screen.queryByTestId('window')).toBeNull()
    expect(screen.queryByTestId('sheet')).toBeNull()
  })
})

describe('PaintedMapHost', () => {
  it('draws nothing until asked', () => {
    const r = render(<PaintedMapHost />)
    expect(r.container.textContent).toBe('')
  })

  it('answers a start with the sheet, then the new map\'s window, with the address it was given', () => {
    render(<PaintedMapHost />)
    act(() => void startPaintedMap({ jobId: 'j1', address: '1 Made Up Road' }))
    expect(screen.getByTestId('sheet').textContent).toContain('sheet for j1')
    fireEvent.click(screen.getByRole('button', { name: 'start' }))
    expect(screen.getByTestId('window').textContent).toContain('new new kept:no at:1 Made Up Road')
  })

  it('answers an open with that map\'s window, and goes quiet when it closes', () => {
    render(<PaintedMapHost />)
    act(() => void openPaintedMap('m1', '9 Other Road'))
    expect(screen.getByTestId('window').textContent).toContain('map m1 kept:no at:9 Other Road')
    fireEvent.click(screen.getByRole('button', { name: 'close' }))
    expect(screen.queryByTestId('window')).toBeNull()
  })

  it('opens a map already adding a place when the door asks for that (#393)', () => {
    render(<PaintedMapHost />)
    act(() => void openPaintedMap('list', '9 Other Road', 'place'))
    expect(screen.getByTestId('window').textContent).toContain('map list kept:no at:9 Other Road')
    expect(screen.getByTestId('window').getAttribute('data-open-on')).toBe('place')
    // A plain open adds nothing.
    act(() => void openPaintedMap('m1', null))
    expect(screen.getByTestId('window').getAttribute('data-open-on')).toBe('nothing')
  })

  it('answers a paint with the new map\'s window and no sheet, and tells the caller when it closes', () => {
    render(<PaintedMapHost />)
    const closed = vi.fn()
    act(() => void paintPaintedMap({ id: 'task-map', name: 'Dig the trench', words: '', home: { jobId: null, developmentId: null }, first: 'line' }, closed))
    expect(screen.queryByTestId('sheet')).toBeNull()
    expect(screen.getByTestId('window').textContent).toContain('new task-map')
    expect(closed).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'close' }))
    expect(screen.queryByTestId('window')).toBeNull()
    expect(closed).toHaveBeenCalledTimes(1)
  })

  it('a paint with nobody listening says so to the caller', () => {
    expect(paintPaintedMap({ id: 'x', name: 'N', words: '', home: {} })).toBe(false)
  })

  it('says a walk is still on the phone, and opens it paused with the map it was for', () => {
    phone.raw = keep(walked())
    render(<PaintedMapHost />)
    expect(screen.getByRole('status').textContent).toMatch(/^A walk from \d{1,2}:\d{2} [AP]M is still on this phone\. It was not saved\./)
    fireEvent.click(screen.getByRole('button', { name: 'Look it over' }))
    expect(screen.getByTestId('window').textContent).toContain('new new-map kept:paused/0 at:1 Made Up Road')
  })

  it('opens a walk for a map that was already saved by the map\'s id', () => {
    phone.raw = keep(walked(), [], null)
    render(<PaintedMapHost />)
    fireEvent.click(screen.getByRole('button', { name: 'Look it over' }))
    expect(screen.getByTestId('window').textContent).toContain('map new-map kept:paused/0')
  })

  it('offers lines that were looked over and never saved', () => {
    phone.raw = keep(null, [{ how: 'walked', points: [], lengthM: 50 }])
    render(<PaintedMapHost />)
    fireEvent.click(screen.getByRole('button', { name: 'Look it over' }))
    expect(screen.getByTestId('window').textContent).toContain('kept:none/1')
  })

  it('throws a kept walk away only after a confirm, and then it is off the phone', () => {
    phone.raw = keep(walked())
    render(<PaintedMapHost />)
    fireEvent.click(screen.getByRole('button', { name: 'Throw it away' }))
    expect(phone.writes).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Throw the walk away' }))
    expect(phone.writes).toEqual([null])
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('takes a kept walk with no line in it off the phone without a word', () => {
    phone.raw = keep(startWalk(0))
    const r = render(<PaintedMapHost />)
    expect(r.container.textContent).toBe('')
    expect(phone.writes).toEqual([null])
  })

  it('takes a walk more than a day old off the phone without a word', () => {
    phone.raw = JSON.stringify({ savedAtMs: Date.now() - 25 * 60 * 60_000, map: { mapId: 'm', start: null, address: null, pending: [] }, state: walked() })
    const r = render(<PaintedMapHost />)
    expect(r.container.textContent).toBe('')
    expect(phone.writes).toEqual([null])
  })
})

/** A place set with no signal (punch list #413, step 2b): the host sends what waits, and says what still does. */
describe('places that wait on the phone for a signal (#413)', () => {
  const band = () => document.querySelector('[data-painted-spots-waiting]') as HTMLElement | null
  const online = (value: boolean) => Object.defineProperty(navigator, 'onLine', { value, configurable: true })
  afterEach(() => {
    spots.waiting = 0
    spots.sends = 0
    spots.sendLeaves = 0
    spots.sendError = null
    online(true)
  })

  it('says nothing and sends nothing with nothing waiting', async () => {
    renderBare(<MemoryRouter><PaintedMapHost /></MemoryRouter>)
    await act(async () => {})
    expect(band()).toBeNull()
    expect(spots.sends).toBe(0)
  })

  it('sends what waits when the app opens, and says nothing once it has gone', async () => {
    spots.waiting = 2
    renderBare(<MemoryRouter><PaintedMapHost /></MemoryRouter>)
    await act(async () => {})
    expect(spots.sends).toBe(1)
    expect(band()).toBeNull()
  })

  it('with no signal, asks the server nothing and says how many wait, with a press to try', async () => {
    online(false)
    spots.waiting = 2
    renderBare(<MemoryRouter><PaintedMapHost /></MemoryRouter>)
    await act(async () => {})
    expect(spots.sends).toBe(0)
    expect(band()?.textContent).toContain('2 places wait on this phone. They go to the job when the signal is back.')
    const send = document.querySelector('[data-painted-spots-send]') as HTMLButtonElement
    expect(send.textContent).toBe('Send now')
    expect(send.style.minHeight).toBe('44px')
  })

  it('sends when the phone says the signal is back', async () => {
    online(false)
    spots.waiting = 1
    renderBare(<MemoryRouter><PaintedMapHost /></MemoryRouter>)
    await act(async () => {})
    expect(band()?.textContent).toContain('1 place waits on this phone. It goes to the job when the signal is back.')
    online(true)
    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })
    expect(spots.sends).toBe(1)
    expect(band()).toBeNull()
  })

  it('keeps saying what still waits when a send did not get through', async () => {
    spots.waiting = 3
    spots.sendLeaves = 2
    spots.sendError = 'Failed to fetch'
    renderBare(<MemoryRouter><PaintedMapHost /></MemoryRouter>)
    await act(async () => {})
    expect(band()?.textContent).toContain('2 places wait on this phone.')
    spots.sendLeaves = 0
    await act(async () => {
      fireEvent.click(document.querySelector('[data-painted-spots-send]') as HTMLButtonElement)
    })
    expect(spots.sends).toBe(2)
    expect(band()).toBeNull()
  })

  it('tries again when a map’s window closes, since a place may just have been kept there', async () => {
    renderBare(<MemoryRouter><PaintedMapHost /></MemoryRouter>)
    await act(async () => {})
    act(() => {
      openPaintedMap('m1')
    })
    spots.waiting = 1
    online(false)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'close' }))
    })
    expect(band()?.textContent).toContain('1 place waits on this phone.')
  })
})
