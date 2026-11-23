// @vitest-environment jsdom
/**
 * The painted map's host when its window's code does not come (punch list #85). The map's window is a chunk of
 * its own. Here that chunk is lost: the host must close the window alone, say so in one line, and put the kept
 * walk's offer back on the page.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '../../contexts/ToastContext'
import { forgetChunkRecoveryReload } from '../../lib/chunkLoadRecovery'
import { fromPlane } from '../../lib/paintedMap/paintedLine'
import { startWalk, walkFix, walkPause, type WalkState } from '../../lib/paintedMap/paintedWalk'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me' }, role: 'helpers' }) }))

const phone = vi.hoisted(() => ({ raw: null as string | null }))
vi.mock('../../hooks/usePaintedWalk', () => ({
  readKeptWalkRaw: () => phone.raw,
  writeKeptWalk: (_userId: string, kept: unknown) => {
    phone.raw = kept ? JSON.stringify(kept) : null
  },
}))
vi.mock('../../lib/paintedMap/paintedKeptSpotIo', () => ({
  readKeptSpots: () => [],
  sendKeptSpots: async () => ({ sent: 0, waiting: 0, error: null }),
}))
// The window's chunk is lost: reading the module's export throws what a failed dynamic import throws.
vi.mock('./PaintedMapWindow', () => ({
  get PaintedMapWindow(): never {
    throw new TypeError('Failed to fetch dynamically imported module: https://x/assets/PaintedMapWindow-abc123.js')
  },
}))

import { openPaintedMap, paintPaintedMap } from '../../lib/paintedMap/paintedMapDoor'
import { PaintedMapHost } from './PaintedMapHost'

const LINE = 'The map could not open. Check your signal, then press it again.'

const walked = (): WalkState => {
  let s = startWalk(0)
  for (let i = 0; i <= 10; i++) s = walkFix(s, { ...fromPlane({ lat: 29.5, lng: -98.2 }, { x: i * 8, y: 0 }), accuracyM: 5, atMs: i * 2000 }, i * 2000)
  return walkPause(s, 30_000)
}

/** A page with something on it, and the host beside it as the Layout mounts it. */
const Page = () => (
  <MemoryRouter initialEntries={['/dashboard']}>
    <ToastProvider>
      <h1>Dashboard</h1>
      <PaintedMapHost />
    </ToastProvider>
  </MemoryRouter>
)

describe('PaintedMapHost, when the map window’s code does not come', () => {
  beforeEach(() => {
    forgetChunkRecoveryReload()
    sessionStorage.clear()
    phone.raw = null
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('closes the window alone, says so, and keeps the page', async () => {
    render(<Page />)
    act(() => void openPaintedMap('m1', '9 Other Road'))
    expect(await screen.findByText(LINE)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeTruthy()
    expect(screen.queryByText('Opening the map…')).toBeNull()
  })

  it('puts the kept walk’s offer back, with the walk still on the phone', async () => {
    phone.raw = JSON.stringify({ savedAtMs: Date.now() - 60_000, map: { mapId: 'new-map', start: { id: 'new-map', name: 'The way in', words: '', home: { jobId: 'j1' } }, address: '1 Made Up Road', pending: [] }, state: walked() })
    render(<Page />)
    fireEvent.click(screen.getByRole('button', { name: 'Look it over' }))
    expect(await screen.findByText(LINE)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Look it over' })).toBeTruthy()
    expect(phone.raw).not.toBeNull()
  })

  it('a caller that asked for a new map by the door hears that its window closed', async () => {
    const closed = vi.fn()
    render(<Page />)
    act(() => void paintPaintedMap({ id: 'task-map', name: 'Dig the trench', words: '', home: { jobId: null, developmentId: null }, first: 'line' }, closed))
    expect(await screen.findByText(LINE)).toBeTruthy()
    expect(closed).toHaveBeenCalledTimes(1)
  })
})
