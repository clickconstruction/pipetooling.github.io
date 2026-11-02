// @vitest-environment jsdom
/**
 * How fast a change ships (v2.6399): Settings → How fast a change ships over a fake io. The headline, the as-of line,
 * the chart's title and today's tiles draw from the row; no row draws the empty state that names what fills it; a
 * read that fails draws its reason with Retry; a dev sees Read GitHub now, whose answer lands on the line and reloads
 * the row; a controller does not see the press.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { shipPacePicture, type PacePr, type ShipPacePicture } from '../../../supabase/functions/_shared/shipPace'
import type { ShipPaceIo } from '../../lib/settings/shipPaceIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { SHIP_PACE_WORDS as W } from '../../lib/settings/shipPaceWords'
import SettingsShipPaceSection from './SettingsShipPaceSection'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

// The chart sizes itself with a ResizeObserver, which jsdom does not have.
beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
})
afterEach(cleanup)

const NOW = '2026-11-02T21:37:37.000Z'
const nowMs = () => Date.parse(NOW)

let n = 1
function pr(createdAt: string, mergedAt: string | null, draft = false): PacePr {
  n += 1
  return { number: n, createdAt, mergedAt, closedAt: mergedAt, draft }
}

/** Monday 3:37 PM: three merges in the last 24 hours (2, 4 and 9 hours), three opened today (the 00:00Z one is Sunday 6 PM Central), one draft open. */
const PICTURE: ShipPacePicture = shipPacePicture({
  now: NOW,
  prs: [
    pr('2026-11-02T10:00:00Z', '2026-11-02T14:00:00Z'),
    pr('2026-11-02T10:00:00Z', '2026-11-02T12:00:00Z'),
    pr('2026-11-02T00:00:00Z', '2026-11-02T09:00:00Z'),
    pr('2026-11-02T18:00:00Z', null, true),
    pr('2026-11-01T18:00:00Z', null),
  ],
  queueRuns: null,
  queueNow: 3,
})

function fakeIo(over: Partial<ShipPaceIo> = {}): ShipPaceIo {
  return { load: vi.fn(async () => PICTURE), readNow: vi.fn(async () => ({ ok: true as const, line: 'Read 5 pull requests. 3 merged in the last 24 hours.' })), ...over }
}

const text = (sel: string) => document.querySelector<HTMLElement>(sel)?.textContent ?? null

describe('SettingsShipPaceSection', () => {
  it('draws the headline, the as-of line, the chart title and today from the row', async () => {
    renderWithProviders(<SettingsShipPaceSection role="controller" io={fakeIo()} now={nowMs} />)
    await waitFor(() => expect(text('[data-ship-pace-headline]')).toBe('A change asked for today has been taking about 4 hours to reach the app. Nine in ten land inside 9 hours.'))
    expect(text('[data-ship-pace-as-of]')).toBe('As of 3:37 PM.')
    expect(screen.getByText(W.chartTitle)).toBeTruthy()
    expect(screen.getByText(W.gaps)).toBeTruthy()
    const today = text('[data-ship-pace-today]') ?? ''
    expect(today).toContain(`${W.openedToday}3`)
    expect(today).toContain(`${W.mergedToday}3`)
    expect(today).toContain(`${W.openNow}21 draft among them`)
    expect(today).toContain(`${W.inQueue}3`)
    expect(text('[data-ship-pace-meaning]')).toBe(W.meaning)
    expect(document.querySelector('[data-ship-pace-chart]')).toBeTruthy()
    expect(screen.queryByRole('button', { name: W.readNow })).toBeNull()
  })

  it('says the reader may be stuck when the row is more than an hour old, and that the queue was not read', async () => {
    const old: ShipPacePicture = { ...PICTURE, asOf: '2026-11-02T20:10:00.000Z', now: { ...PICTURE.now, queue: null } }
    renderWithProviders(<SettingsShipPaceSection role="estimator" io={fakeIo({ load: vi.fn(async () => old) })} now={nowMs} />)
    await waitFor(() => expect(text('[data-ship-pace-as-of]')).toBe('The last read was at 2:10 PM, more than an hour ago. The reader may be stuck. Ask a dev.'))
    expect(text('[data-ship-pace-today]')).toContain(`${W.inQueue}${W.queueNotRead}`)
  })

  it('with no row yet, the empty state names what fills it', async () => {
    renderWithProviders(<SettingsShipPaceSection role="assistant" io={fakeIo({ load: vi.fn(async () => null) })} now={nowMs} />)
    await waitFor(() => expect(screen.getByText(W.emptyMain)).toBeTruthy())
    expect(screen.getByText(W.emptyTail)).toBeTruthy()
    expect(document.querySelector('[data-ship-pace-headline]')).toBeNull()
  })

  it('a lost signal draws the read sentence with Retry, and Retry reads again; a refusal draws its reason alone', async () => {
    const load = vi.fn<() => Promise<ShipPacePicture | null>>().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(PICTURE)
    renderWithProviders(<SettingsShipPaceSection role="master_technician" io={fakeIo({ load })} now={nowMs} />)
    await waitFor(() => expect(screen.getByText(/could not load/)).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }))
    await waitFor(() => expect(text('[data-ship-pace-headline]')).toContain('about 4 hours'))
    expect(load).toHaveBeenCalledTimes(2)
    cleanup()
    renderWithProviders(<SettingsShipPaceSection role="master_technician" io={fakeIo({ load: vi.fn(async () => { throw new Error('The row would not read.') }) })} now={nowMs} />)
    await waitFor(() => expect(screen.getByText(/The row would not read/)).toBeTruthy())
    expect(screen.queryByRole('button', { name: /Retry/ })).toBeNull()
  })

  it('a dev’s Read GitHub now shows the function’s line and reloads the row', async () => {
    const io = fakeIo()
    renderWithProviders(<SettingsShipPaceSection role="dev" io={io} now={nowMs} />)
    const press = await screen.findByRole('button', { name: W.readNow })
    fireEvent.click(press)
    await waitFor(() => expect(text('[data-ship-pace-read-line]')).toBe('Read 5 pull requests. 3 merged in the last 24 hours.'))
    expect(io.readNow).toHaveBeenCalledTimes(1)
    expect(io.load).toHaveBeenCalledTimes(2)
  })

  it('a refused read says why and does not reload', async () => {
    const io = fakeIo({ readNow: vi.fn(async () => ({ ok: false as const, line: 'GITHUB_PACE_TOKEN is not set, so GitHub was not read.' })) })
    renderWithProviders(<SettingsShipPaceSection role="dev" io={io} now={nowMs} />)
    fireEvent.click(await screen.findByRole('button', { name: W.readNow }))
    await waitFor(() => expect(text('[data-ship-pace-read-line]')).toContain('GITHUB_PACE_TOKEN is not set'))
    expect(io.load).toHaveBeenCalledTimes(1)
  })
})
