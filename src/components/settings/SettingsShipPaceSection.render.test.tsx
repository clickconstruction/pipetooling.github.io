// @vitest-environment jsdom
/**
 * How fast a change ships (v2.6399): Settings → How fast a change ships over a fake io. The headline, the as-of line,
 * the chart's title and today's tiles draw from the row; no row draws the empty state that names what fills it; a
 * read that fails draws its reason with Retry; a dev sees Read GitHub now, whose answer lands on the line and reloads
 * the row; a controller does not see the press. In line now (v2.6401): the queue's top ten in order with their words
 * and *and N more*, the buckets line under them, an empty queue's words, and the one line when the queue was not read.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { shipPacePicture, type PaceOpenPr, type PacePr, type PaceQueueEntryInput, type ShipPacePicture } from '../../../supabase/functions/_shared/shipPace'
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

/** Twelve in line: the third entered 25 minutes ago with 12 minutes to go; the first has no estimate. */
const QUEUE_ENTRIES: PaceQueueEntryInput[] = Array.from({ length: 12 }, (_, i) => ({
  number: 7001 + i,
  title: `v2.64${String(i + 1).padStart(2, '0')} Change number ${i + 1} in its plain sentence`,
  position: i + 1,
  enqueuedAt: new Date(Date.parse(NOW) - (i === 2 ? 25 : 40 - i) * 60_000).toISOString(),
  estimatedSeconds: i === 0 ? null : i === 2 ? 720 : (i + 1) * 600,
}))

/** The open pull requests around the line: the twelve in it, two armed (one on a red check), three open and unarmed, one draft. */
const QUEUE_OPEN: PaceOpenPr[] = [
  ...QUEUE_ENTRIES.map((e) => ({ number: e.number, title: e.title, draft: false, armed: false, inQueue: true, checks: 'SUCCESS', mergeable: 'UNKNOWN' })),
  { number: 7101, title: 'v2.6420 Armed and green', draft: false, armed: true, inQueue: false, checks: 'PENDING', mergeable: 'MERGEABLE' },
  { number: 7102, title: 'v2.6421 Armed and red', draft: false, armed: true, inQueue: false, checks: 'FAILURE', mergeable: 'MERGEABLE' },
  { number: 7103, title: 'v2.6422 Open, unarmed', draft: false, armed: false, inQueue: false, checks: 'SUCCESS', mergeable: 'MERGEABLE' },
  { number: 7104, title: 'v2.6423 Open, unarmed', draft: false, armed: false, inQueue: false, checks: 'PENDING', mergeable: 'MERGEABLE' },
  { number: 7105, title: 'docs: open, unarmed', draft: false, armed: false, inQueue: false, checks: null, mergeable: 'MERGEABLE' },
  { number: 7106, title: 'v2.6424 A draft', draft: true, armed: false, inQueue: false, checks: 'SUCCESS', mergeable: 'MERGEABLE' },
]

/**
 * Monday 3:37 PM: five merges in the last 24 hours (2, 4, 9, 4 and 2.5 hours; the last two inside the last six hours),
 * five opened today (the 00:00Z one is Sunday 6 PM Central), one draft open; twelve in the merge queue.
 */
const PICTURE: ShipPacePicture = shipPacePicture({
  now: NOW,
  prs: [
    pr('2026-11-02T10:00:00Z', '2026-11-02T14:00:00Z'),
    pr('2026-11-02T10:00:00Z', '2026-11-02T12:00:00Z'),
    pr('2026-11-02T00:00:00Z', '2026-11-02T09:00:00Z'),
    pr('2026-11-02T16:00:00Z', '2026-11-02T20:00:00Z'),
    pr('2026-11-02T18:30:00Z', '2026-11-02T21:00:00Z'),
    pr('2026-11-02T18:00:00Z', null, true),
    pr('2026-11-01T18:00:00Z', null),
  ],
  queueRuns: null,
  queue: { total: 12, entries: QUEUE_ENTRIES, open: QUEUE_OPEN },
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
    expect(today).toContain(`${W.openedToday}5`)
    expect(today).toContain(`${W.mergedToday}5`)
    expect(today).toContain(`${W.openNow}21 draft among them`)
    expect(today).toContain(`${W.inQueue}12`)
    expect(text('[data-ship-pace-meaning]')).toBe(W.meaning)
    expect(document.querySelector('[data-ship-pace-chart]')).toBeTruthy()
    // The solid number: the median of the two merges in the last six hours, 4 and 2.5 hours.
    expect(text('[data-ship-pace-now-figure]')).toBe('3.3')
    expect(text('[data-ship-pace-now]')).toContain(`${W.nowLabel}3.3hours`)
    expect(text('[data-ship-pace-now-words]')).toBe('right now, the middle of the 2 merges in the last 6 hours, since 2:00 PM')
    expect(text('[data-ship-pace-now]')).toContain('mean 3.3 h · nine in ten inside 4 h')
    expect(screen.queryByRole('button', { name: W.readNow })).toBeNull()
  })

  it('In line now lists the top ten in order with their words, says and 2 more, and the buckets line', async () => {
    renderWithProviders(<SettingsShipPaceSection role="controller" io={fakeIo()} now={nowMs} />)
    await waitFor(() => expect(document.querySelectorAll('[data-ship-pace-queue-entry]')).toHaveLength(10))
    expect(screen.getByText(W.queueTitle)).toBeTruthy()
    expect(screen.getByText(W.queueOrder)).toBeTruthy()
    const titles = Array.from(document.querySelectorAll('[data-ship-pace-queue-entry-title]')).map((el) => el.textContent)
    expect(titles[0]).toBe('Change number 1 in its plain sentence')
    expect(titles[9]).toBe('Change number 10 in its plain sentence')
    const words = Array.from(document.querySelectorAll('[data-ship-pace-queue-entry-words]')).map((el) => el.textContent)
    expect(words[0]).toBe('1st in line, in the queue 40 minutes')
    expect(words[2]).toBe('3rd in line, in the queue 25 minutes, about 12 minutes to go')
    expect(text('[data-ship-pace-queue-more]')).toBe('and 2 more')
    expect(text('[data-ship-pace-queue-buckets]')).toBe(
      '2 more are armed and waiting on their checks. 1 of them is held by a red check or a conflict. 3 are open and not yet asked to merge.',
    )
    expect(document.querySelector('[data-ship-pace-queue-unread]')).toBeNull()
    expect(document.querySelector('[data-ship-pace-queue] [data-empty-state]')).toBeNull()
  })

  it('an empty queue says nothing is waiting on it, with the buckets line still under it', async () => {
    const empty: ShipPacePicture = {
      ...PICTURE,
      now: { ...PICTURE.now, queue: 0 },
      queue: { entries: [], armedWaiting: 0, armedHeld: 0, openUnarmed: 2, drafts: 1 },
    }
    renderWithProviders(<SettingsShipPaceSection role="assistant" io={fakeIo({ load: vi.fn(async () => empty) })} now={nowMs} />)
    await waitFor(() => expect(text('[data-ship-pace-queue] [data-empty-state]')).toBe('Nothing waiting on the queue.'))
    expect(document.querySelectorAll('[data-ship-pace-queue-entry]')).toHaveLength(0)
    expect(document.querySelector('[data-ship-pace-queue-more]')).toBeNull()
    expect(text('[data-ship-pace-queue-buckets]')).toBe('Nothing is armed and waiting on its checks. 2 are open and not yet asked to merge.')
    expect(text('[data-ship-pace-today]')).toContain(`${W.inQueue}0`)
  })

  it('says the reader may be stuck when the row is more than an hour old, that the queue was not read, and that nothing merged in six hours', async () => {
    const old: ShipPacePicture = {
      ...PICTURE,
      asOf: '2026-11-02T20:10:00.000Z',
      now: { ...PICTURE.now, queue: null },
      queue: null,
      recent: { hours: 6, merged: 0, medianH: null, meanH: null, p90H: null, since: null },
    }
    renderWithProviders(<SettingsShipPaceSection role="estimator" io={fakeIo({ load: vi.fn(async () => old) })} now={nowMs} />)
    await waitFor(() => expect(text('[data-ship-pace-as-of]')).toBe('The last read was at 2:10 PM, more than an hour ago. The reader may be stuck. Ask a dev.'))
    expect(text('[data-ship-pace-today]')).toContain(`${W.inQueue}${W.queueNotRead}`)
    expect(text('[data-ship-pace-now-figure]')).toBe('—')
    expect(text('[data-ship-pace-now-words]')).toBe('Nothing merged in the last 6 hours, so there is no number right now.')
    // The queue card: one line, no list, no buckets.
    expect(text('[data-ship-pace-queue-unread]')).toBe(W.queueUnread)
    expect(document.querySelectorAll('[data-ship-pace-queue-entry]')).toHaveLength(0)
    expect(document.querySelector('[data-ship-pace-queue-buckets]')).toBeNull()
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
