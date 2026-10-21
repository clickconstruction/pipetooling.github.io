// @vitest-environment jsdom
/**
 * The last 7 days (punch list #140 PR 5) over a fake read: the four tiles with their numbers, each tile's door, a
 * tile with nothing behind it reading none and taking no press, the office's note under Mine, and a failed read.
 */
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { StripLine, StripWait } from '../../lib/messages/weekStrip'
import type { WeekStripRead } from '../../lib/messages/weekStripIo'
import { WeekStrip } from './WeekStrip'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(cleanup)

// Now: Wed Oct 21, 10:00 AM Chicago (CDT).
const NOW = Date.parse('2026-10-21T15:00:00Z')
const at = (iso: string) => Date.parse(iso)
let n = 0
const line = (set: Partial<StripLine> & Pick<StripLine, 'direction' | 'atMs'>): StripLine => ({ id: `l${++n}`, contactId: 'c1', kind: 'customer', channel: 'text', who: set.direction === 'in' ? 'Dana' : 'Rosa', ...set })
const READ: WeekStripRead = {
  lines: [
    line({ direction: 'in', atMs: at('2026-10-20T14:00:00Z') }),
    line({ direction: 'out', atMs: at('2026-10-20T14:30:00Z') }),
    line({ direction: 'in', atMs: at('2026-10-19T14:00:00Z'), contactId: 'c2' }),
    line({ direction: 'out', atMs: at('2026-10-19T16:00:00Z'), contactId: 'c2', delivery: 'failed' }),
    line({ direction: 'in', atMs: at('2026-10-10T14:00:00Z'), contactId: 'c3' }),
    line({ direction: 'out', atMs: at('2026-10-10T14:20:00Z'), contactId: 'c3' }),
  ],
  estimates: [
    { id: 'e1', number: 101, sentAtMs: at('2026-10-16T14:00:00Z'), opened: true, accepted: false },
    { id: 'e2', number: 102, sentAtMs: at('2026-10-18T14:00:00Z'), opened: false, accepted: false },
  ],
}
const WAITS: StripWait[] = [{ contactId: 'c-dana', name: 'Dana Whitfield', has: 'Rosa', waitingSinceMs: at('2026-10-19T11:00:00Z'), landOnId: 'm1' }]

function strip(more: { read?: WeekStripRead | 'down'; waits?: StripWait[]; mine?: boolean } = {}) {
  const doors = { onOpenThread: vi.fn(), onNeedsReply: vi.fn(), onWentOut: vi.fn(), onWaiting: vi.fn() }
  const io = vi.fn(async () => {
    if (more.read === 'down') throw new Error('down')
    return more.read ?? READ
  })
  renderWithProviders(<WeekStrip pill="all" waits={more.waits ?? WAITS} mine={more.mine} io={io} now={() => NOW} {...doors} />)
  return doors
}

describe('WeekStrip', { timeout: 15_000 }, () => {
  it('draws the four tiles with the week’s numbers, and each tile opens its rows', async () => {
    const doors = strip()
    const tiles = await screen.findAllByTestId('strip-tile')
    expect(tiles.map((t) => t.textContent)).toEqual([
      'Answered within an hour50%1 of 2 · ↓ from 100% last week',
      'Longest wait right now2 d 4 hDana Whitfield · Rosa has it',
      'Texts not delivered1',
      'Estimates2 sent · 1 opened · 0 accepted1 opened and quiet',
    ])
    expect(screen.getByRole('heading', { name: 'The last 7 days' })).toBeTruthy()
    expect(screen.queryByTestId('strip-office')).toBeNull()
    fireEvent.click(tiles[0]!)
    expect(doors.onNeedsReply).toHaveBeenCalledTimes(1)
    fireEvent.click(tiles[1]!)
    expect(doors.onOpenThread).toHaveBeenCalledWith('c-dana', 'm1')
    fireEvent.click(tiles[2]!)
    expect(doors.onWentOut).toHaveBeenCalledTimes(1)
    fireEvent.click(tiles[3]!)
    expect(doors.onWaiting).toHaveBeenCalledTimes(1)
  })

  it('a tile with nothing behind it reads none and takes no press; Mine says the numbers are the office’s', async () => {
    const doors = strip({ read: { lines: [], estimates: [] }, waits: [], mine: true })
    const tiles = await screen.findAllByTestId('strip-tile')
    expect(tiles.map((t) => (t as HTMLButtonElement).disabled)).toEqual([true, true, true, true])
    expect(screen.getAllByTestId('strip-value').map((v) => v.textContent)).toEqual(['none', 'none', 'none', 'none'])
    fireEvent.click(tiles[0]!)
    expect(doors.onNeedsReply).not.toHaveBeenCalled()
    expect(screen.getByTestId('strip-office').textContent).toBe('The office’s numbers, not only yours.')
  })

  it('a failed read says so', async () => {
    strip({ read: 'down' })
    expect(await screen.findByText('The last 7 days could not be read.')).toBeTruthy()
  })
})
