// @vitest-environment jsdom
/**
 * In the merge queue on /punch-list (punch list #444) over a fake io: the line with each value apart, the day's merges
 * and the merges an hour, the buckets line and the door to Settings; an empty queue's words; the one line when the
 * queue was not read; no row; a read that fails with Retry; a dev's one read of GitHub on an old row, and none for a
 * fresh row or a master; the press; Hide, which the device remembers and which still says the count; and on a phone
 * the fold, the dev's press and the door each a fingertip tall (the walk of 2026-11-25 measured 24, 29 and 36 px).
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shipPacePicture, type PacePr, type PaceQueueEntryInput, type ShipPacePicture } from '../../../supabase/functions/_shared/shipPace'
import type { ShipPaceIo } from '../../lib/settings/shipPaceIo'
import { SHIP_PACE_WORDS } from '../../lib/settings/shipPaceWords'
import { PHONE_PRESS_MIN_HEIGHT } from '../../lib/phonePress'
import { PUNCH_QUEUE_WORDS as W } from '../../lib/todos/punchListQueue'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { PunchListQueue } from './PunchListQueue'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

/** The width the block is drawn at: a desk unless a case says a phone. */
const screenIs = vi.hoisted(() => ({ phone: false }))
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => screenIs.phone }))

afterEach(() => {
  cleanup()
  screenIs.phone = false
})
beforeEach(() => window.localStorage.clear())

/** Monday 2:41 PM on the app calendar. */
const NOW = '2026-11-02T20:41:00.000Z'
const nowMs = () => Date.parse(NOW)
const minutesAgo = (m: number): string => new Date(Date.parse(NOW) - m * 60_000).toISOString()

let n = 100
const merged = (at: string): PacePr => {
  n += 1
  return { number: n, createdAt: new Date(Date.parse(at) - 3_600_000).toISOString(), mergedAt: at, closedAt: at, draft: false }
}
const PRS = [merged('2026-11-02T12:10:00Z'), merged('2026-11-02T15:05:00Z'), merged('2026-11-02T15:20:00Z'), merged('2026-11-02T19:10:00Z'), merged('2026-11-02T20:30:00Z')]

const ENTRIES: PaceQueueEntryInput[] = [
  { number: 9001, title: 'v2.9001 Jobs: the stage bar keeps its place on a phone', position: 1, enqueuedAt: minutesAgo(9), estimatedSeconds: 180, state: 'AWAITING_CHECKS' },
  { number: 9002, title: 'v2.9002 Bills sent: the list of ways takes a thumb', position: 2, enqueuedAt: minutesAgo(8), estimatedSeconds: 480, state: 'MERGEABLE' },
  { number: 9003, title: 'docs: a walk’s two findings, written on their card', position: 3, enqueuedAt: minutesAgo(2), estimatedSeconds: null, state: 'QUEUED' },
]

function picture(over: { now?: string; entries?: PaceQueueEntryInput[]; queue?: null } = {}): ShipPacePicture {
  const entries = over.entries ?? ENTRIES
  return shipPacePicture({
    now: over.now ?? NOW,
    prs: PRS,
    queueRuns: null,
    queue:
      over.queue === null
        ? null
        : {
            total: entries.length,
            entries,
            open: [
              { number: 9101, title: 'v2.9101 Armed', draft: false, armed: true, inQueue: false, checks: 'PENDING', mergeable: 'MERGEABLE' },
              { number: 9102, title: 'v2.9102 Open', draft: false, armed: false, inQueue: false, checks: 'SUCCESS', mergeable: 'MERGEABLE' },
            ],
          },
  })
}

function fakeIo(over: Partial<ShipPaceIo> = {}): ShipPaceIo {
  return { load: vi.fn(async () => picture()), readNow: vi.fn(async () => ({ ok: true as const, line: 'Read 5 pull requests. 5 merged in the last 24 hours.' })), ...over }
}

const rowText = () => screen.getAllByTestId('queue-row').map((li) => [...li.children].map((c) => c.textContent))

describe('PunchListQueue', () => {
  it('draws each change in line with its place, its wait and what is left, then the day and the door', async () => {
    renderWithProviders(<PunchListQueue role="master_technician" io={fakeIo()} now={nowMs} />)
    await waitFor(() => expect(screen.getAllByTestId('queue-row')).toHaveLength(3))
    expect(screen.getByRole('heading', { name: W.title })).toBeTruthy()
    expect(screen.getByTestId('queue-count').textContent).toBe('3 in line')
    expect(screen.getByTestId('queue-as-of').textContent).toBe(`As of 2:41 PM. ${W.order}`)
    expect(rowText()).toEqual([
      ['1st', 'Jobs: the stage bar keeps its place on a phone', 'Checks running', '9 minutes', 'about 3 minutes'],
      ['2nd', 'Bills sent: the list of ways takes a thumb', 'Ready', '8 minutes', 'about 8 minutes'],
      ['3rd', 'docs: a walk’s two findings, written on their card', 'Waiting its turn', '2 minutes', W.noEstimate],
    ])
    // Each state is a chip with its tone: work under way, good to go, plain waiting.
    expect(screen.getAllByTestId('queue-state').map((c) => c.getAttribute('data-tone'))).toEqual(['running', 'ready', 'waiting'])
    // The place and the two times are worked-out values; the title is words.
    expect([...screen.getAllByTestId('queue-row')[0]!.querySelectorAll('[data-value="worked-out"]')].map((v) => v.textContent)).toEqual(['1st', '9 minutes', 'about 3 minutes'])
    const today = screen.getByTestId('queue-today')
    expect(today.textContent).toContain(`${W.mergedToday}5${W.sinceMidnight}`)
    // Four of the five merged in the last six hours.
    expect(today.textContent).toContain(`${W.anHour}0.7over the last 6 hours`)
    const day = within(today).getByTestId('queue-day')
    expect(day.getAttribute('aria-label')).toBe('5 merged today. The busiest hour was 9a, with 2.')
    expect([...day.querySelectorAll('[data-merged]')].map((c) => c.getAttribute('data-merged')).slice(5, 16)).toEqual(['0', '1', '0', '0', '2', '0', '0', '0', '1', '1', ''])
    expect(screen.getByTestId('queue-buckets').textContent).toContain('1 more is armed and waiting on its checks. 1 is open and not yet asked to merge.')
    expect(screen.getByRole('link', { name: W.door }).getAttribute('href')).toBe('/settings?tab=settings-ship-pace')
    // A master reads the row as the cron left it: no press, no read of GitHub.
    expect(screen.queryByRole('button', { name: SHIP_PACE_WORDS.readNow })).toBeNull()
  })

  it('draws a row written before the state was read with no State column', async () => {
    const before = ENTRIES.map(({ state: _state, ...rest }) => rest)
    renderWithProviders(<PunchListQueue role="master_technician" io={fakeIo({ load: vi.fn(async () => picture({ entries: before })) })} now={nowMs} />)
    await waitFor(() => expect(screen.getAllByTestId('queue-row')).toHaveLength(3))
    expect(rowText()[0]).toEqual(['1st', 'Jobs: the stage bar keeps its place on a phone', '9 minutes', 'about 3 minutes'])
    expect(screen.queryByTestId('queue-state')).toBeNull()
    expect(screen.queryByText(W.state)).toBeNull()
  })

  it('says nothing is waiting on an empty queue, and keeps the day', async () => {
    renderWithProviders(<PunchListQueue role="master_technician" io={fakeIo({ load: vi.fn(async () => picture({ entries: [] })) })} now={nowMs} />)
    await waitFor(() => expect(screen.getByTestId('queue-empty').textContent).toBe('Nothing waiting on the queue.'))
    expect(screen.getByTestId('queue-count').textContent).toBe('0 in line')
    expect(screen.getByTestId('queue-as-of').textContent).toBe('As of 2:41 PM.')
    expect(screen.queryByTestId('queue-list')).toBeNull()
    expect(screen.getByTestId('queue-today').textContent).toContain(`${W.mergedToday}5`)
    expect(screen.getByTestId('queue-buckets').textContent).toContain('1 is armed and waiting on its checks.')
  })

  it('says so in one line when the queue was not read', async () => {
    renderWithProviders(<PunchListQueue role="master_technician" io={fakeIo({ load: vi.fn(async () => picture({ queue: null })) })} now={nowMs} />)
    await waitFor(() => expect(screen.getByTestId('queue-unread').textContent).toBe(SHIP_PACE_WORDS.queueUnread))
    expect(screen.getByTestId('queue-count').textContent).toBe('not read')
    expect(screen.queryByTestId('queue-list')).toBeNull()
    expect(screen.getByTestId('queue-today')).toBeTruthy()
  })

  it('names what fills it when there is no row yet', async () => {
    renderWithProviders(<PunchListQueue role="master_technician" io={fakeIo({ load: vi.fn(async () => null) })} now={nowMs} />)
    await waitFor(() => expect(screen.getByText(SHIP_PACE_WORDS.emptyMain)).toBeTruthy())
    expect(screen.queryByTestId('queue-today')).toBeNull()
  })

  it('draws a lost signal with Retry and reads again on the press; a refusal draws its reason alone', async () => {
    const load = vi.fn<ShipPaceIo['load']>().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(picture())
    const io = fakeIo({ load })
    const first = renderWithProviders(<PunchListQueue role="dev" io={io} now={nowMs} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /Retry/ })).toBeTruthy())
    // A failed read never asks GitHub by itself.
    expect(io.readNow).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }))
    await waitFor(() => expect(screen.getAllByTestId('queue-row')).toHaveLength(3))
    first.unmount()
    const refused = fakeIo({ load: vi.fn(async () => { throw new Error('The row would not read.') }) })
    renderWithProviders(<PunchListQueue role="master_technician" io={refused} now={nowMs} />)
    await waitFor(() => expect(screen.getByText(/The row would not read/)).toBeTruthy())
    expect(screen.queryByRole('button', { name: /Retry/ })).toBeNull()
    expect(screen.queryByTestId('queue-today')).toBeNull()
  })

  it('asks GitHub once when a dev opens on an old row, and draws the row again', async () => {
    const old = picture({ now: minutesAgo(12) })
    const load = vi.fn<ShipPaceIo['load']>().mockResolvedValueOnce(old).mockResolvedValue(picture())
    // The read of GitHub is held open, so the old line and the press's words can be seen while it runs.
    let landed: (answer: { ok: true; line: string }) => void = () => {}
    const readNow = vi.fn<ShipPaceIo['readNow']>(() => new Promise((resolve) => (landed = resolve)))
    const io = fakeIo({ load, readNow })
    const { rerender } = renderWithProviders(<PunchListQueue role="dev" io={io} now={nowMs} />)
    await waitFor(() => expect(screen.getByRole('button', { name: SHIP_PACE_WORDS.reading })).toBeTruthy())
    expect(screen.getByTestId('queue-as-of').textContent).toContain('As of 2:29 PM.')
    expect(screen.getAllByTestId('queue-row')).toHaveLength(3)
    landed({ ok: true, line: 'Read 5 pull requests.' })
    await waitFor(() => expect(screen.getByTestId('queue-as-of').textContent).toContain('As of 2:41 PM.'))
    expect(screen.getByRole('button', { name: SHIP_PACE_WORDS.readNow })).toBeTruthy()
    // The page asked by itself, so no answer line is drawn: that line is the press's.
    expect(screen.queryByTestId('queue-read-line')).toBeNull()
    expect(io.readNow).toHaveBeenCalledTimes(1)
    expect(load).toHaveBeenCalledTimes(2)
    // Drawing again asks nothing more.
    rerender(<PunchListQueue role="dev" io={io} now={nowMs} />)
    await waitFor(() => expect(screen.getAllByTestId('queue-row')).toHaveLength(3))
    expect(io.readNow).toHaveBeenCalledTimes(1)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('asks nothing of GitHub on a fresh row, or for a master on an old one', async () => {
    const fresh = fakeIo()
    const first = renderWithProviders(<PunchListQueue role="dev" io={fresh} now={nowMs} />)
    await waitFor(() => expect(screen.getAllByTestId('queue-row')).toHaveLength(3))
    expect(fresh.readNow).not.toHaveBeenCalled()
    expect(fresh.load).toHaveBeenCalledTimes(1)
    first.unmount()
    const old = fakeIo({ load: vi.fn(async () => picture({ now: minutesAgo(40) })) })
    renderWithProviders(<PunchListQueue role="master_technician" io={old} now={nowMs} />)
    await waitFor(() => expect(screen.getByTestId('queue-as-of').textContent).toBe(`As of 2:01 PM. ${W.order}`))
    expect(old.readNow).not.toHaveBeenCalled()
    expect(old.load).toHaveBeenCalledTimes(1)
  })

  it('turns the as-of words amber on a read over an hour old, and keeps the line', async () => {
    const io = fakeIo({ load: vi.fn(async () => picture({ now: minutesAgo(99) })) })
    renderWithProviders(<PunchListQueue role="master_technician" io={io} now={nowMs} />)
    await waitFor(() => expect(screen.getByTestId('queue-as-of').textContent).toContain('The last read was at 1:02 PM, more than an hour ago. The reader may be stuck. Ask a dev.'))
    expect((screen.getByTestId('queue-as-of') as HTMLElement).style.color).toBe('var(--text-amber-700)')
    expect(screen.getAllByTestId('queue-row')).toHaveLength(3)
  })

  it('reads GitHub on a dev’s press and says what came back', async () => {
    const io = fakeIo()
    renderWithProviders(<PunchListQueue role="dev" io={io} now={nowMs} />)
    await waitFor(() => expect(screen.getAllByTestId('queue-row')).toHaveLength(3))
    fireEvent.click(screen.getByRole('button', { name: SHIP_PACE_WORDS.readNow }))
    await waitFor(() => expect(screen.getByTestId('queue-read-line').textContent).toBe('Read 5 pull requests. 5 merged in the last 24 hours.'))
    expect(io.readNow).toHaveBeenCalledTimes(1)
    expect(io.load).toHaveBeenCalledTimes(2)
  })

  it('hides on a press the device remembers, and the folded line still answers', async () => {
    const { unmount } = renderWithProviders(<PunchListQueue role="master_technician" io={fakeIo()} now={nowMs} />)
    await waitFor(() => expect(screen.getAllByTestId('queue-row')).toHaveLength(3))
    expect(screen.queryByTestId('queue-folded')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: W.hide }))
    expect(screen.queryByTestId('queue-list')).toBeNull()
    expect(screen.getByTestId('queue-count').textContent).toBe('3 in line · the next one in about 3 minutes · 0.7 merges an hour')
    expect(screen.getByRole('button', { name: W.show }).getAttribute('aria-expanded')).toBe('false')
    unmount()
    renderWithProviders(<PunchListQueue role="master_technician" io={fakeIo()} now={nowMs} />)
    await waitFor(() => expect(screen.getByTestId('queue-count').textContent).toContain('3 in line'))
    expect(screen.getByRole('button', { name: W.show })).toBeTruthy()
  })

  it('on a phone the fold, the dev’s press and the door each stand a fingertip tall, folded and open', async () => {
    screenIs.phone = true
    renderWithProviders(<PunchListQueue role="dev" io={fakeIo()} now={nowMs} />)
    await waitFor(() => expect(screen.getAllByTestId('queue-row')).toHaveLength(3))
    expect(screen.getByRole('button', { name: W.hide }).style.minHeight).toBe(`${PHONE_PRESS_MIN_HEIGHT}px`)
    expect(screen.getByRole('button', { name: SHIP_PACE_WORDS.readNow }).style.minHeight).toBe(`${PHONE_PRESS_MIN_HEIGHT}px`)
    // The door sits in a line of words: it takes the height and gives the line back what it grew by.
    const door = screen.getByRole('link', { name: W.door })
    expect(door.style.minHeight).toBe(`${PHONE_PRESS_MIN_HEIGHT}px`)
    expect(door.style.display).toBe('inline-flex')
    expect(door.style.alignItems).toBe('center')
    expect(parseFloat(door.style.marginTop)).toBeLessThan(0)
    expect(door.style.marginTop).toBe(door.style.marginBottom)
    fireEvent.click(screen.getByRole('button', { name: W.hide }))
    expect(screen.getByRole('button', { name: W.show }).style.minHeight).toBe(`${PHONE_PRESS_MIN_HEIGHT}px`)
  })

  it('at a desk the same three keep their drawn size', async () => {
    renderWithProviders(<PunchListQueue role="dev" io={fakeIo()} now={nowMs} />)
    await waitFor(() => expect(screen.getAllByTestId('queue-row')).toHaveLength(3))
    expect(screen.getByRole('button', { name: W.hide }).style.minHeight).toBe('')
    expect(screen.getByRole('button', { name: SHIP_PACE_WORDS.readNow }).style.minHeight).toBe('')
    const door = screen.getByRole('link', { name: W.door })
    expect(door.style.minHeight).toBe('')
    expect(door.style.display).toBe('')
  })
})
