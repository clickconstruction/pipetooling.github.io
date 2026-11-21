// @vitest-environment jsdom
/**
 * The punch list's ticks, the hook alone: what it reads, what it clears with no press and when it may, and
 * that a press a read overlapped is not undone. The table is a stand-in kept in memory.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { TicksFake } from '../test/punchListTicksFake'
import type { TickCard } from '../lib/todos/punchListTicks'

const db = vi.hoisted(() => ({ fake: null as unknown as TicksFake }))
vi.mock('../lib/supabase', async () => {
  const { makeTicksFake } = await import('../test/punchListTicksFake')
  db.fake = makeTicksFake()
  return { supabase: db.fake.supabase }
})

import { usePunchListTicks } from './usePunchListTicks'

const ME = 'user-me'
const row = (card_number: number, section: string, board_version = 'v2.8196', user_id = ME) => ({ user_id, card_number, section, board_version })
const cards = (...pairs: Array<[number, TickCard['group']]>): TickCard[] => pairs.map(([number, group]) => ({ number, group }))
const shown = (set: ReadonlySet<number>) => [...set].sort((a, b) => a - b)

beforeEach(() => db.fake.reset())

describe('usePunchListTicks', () => {
  it('reads the person’s own rows and shows the ones whose card is still in its section', async () => {
    db.fake.rows = [row(1, 'ready'), row(2, 'ready'), row(7, 'ready', 'v2.8196', 'someone-else')]
    const board = cards([1, 'ready'], [2, 'close'], [7, 'ready'])
    const { result } = renderHook(() => usePunchListTicks({ enabled: true, userId: ME, cards: board, boardVersion: 'v2.8200', mayClear: false }))
    await waitFor(() => expect(shown(result.current.ticked)).toEqual([1]))
    // Card 2 moved to close out: not shown. Card 7 is another person's tick: never read.
    expect(result.current.failure).toBeNull()
    // Nothing is deleted where the page may not clear (a dev server, View as).
    expect(db.fake.log).toEqual([])
    expect(db.fake.rows).toHaveLength(3)
  })

  it('deletes the rows of a card that moved and a card that left the list, with no press', async () => {
    db.fake.rows = [row(1, 'ready'), row(2, 'ready'), row(9, 'waiting')]
    const board = cards([1, 'ready'], [2, 'close'])
    const { result } = renderHook(() => usePunchListTicks({ enabled: true, userId: ME, cards: board, boardVersion: 'v2.8200', mayClear: true }))
    await waitFor(() => expect(db.fake.log).toEqual(['delete 2,9']))
    expect(shown(result.current.ticked)).toEqual([1])
    expect(db.fake.rows.map((r) => r.card_number)).toEqual([1])
  })

  it('a made-up card whose section changes between two reads loses its tick, and the row goes', async () => {
    db.fake.rows = [row(77, 'ready', 'v2.8196')]
    let board = cards([77, 'ready'])
    let version = 'v2.8196'
    const { result, rerender } = renderHook(() => usePunchListTicks({ enabled: true, userId: ME, cards: board, boardVersion: version, mayClear: true }))
    await waitFor(() => expect(shown(result.current.ticked)).toEqual([77]))
    expect(db.fake.log).toEqual([])
    // The card moves from ready to close out and the site is built again.
    board = cards([77, 'close'])
    version = 'v2.8197'
    rerender()
    await waitFor(() => expect(db.fake.log).toEqual(['delete 77']))
    expect(shown(result.current.ticked)).toEqual([])
    expect(db.fake.rows).toEqual([])
  })

  it('an old copy of the page hides a tick it cannot judge and deletes nothing', async () => {
    // The tick was made on a newer board, on a card this copy has never heard of, and one it thinks is elsewhere.
    db.fake.rows = [row(500, 'ready', 'v2.8300'), row(2, 'close', 'v2.8300')]
    const board = cards([2, 'ready'])
    const { result } = renderHook(() => usePunchListTicks({ enabled: true, userId: ME, cards: board, boardVersion: 'v2.8200', mayClear: true }))
    await waitFor(() => expect(db.fake.reads).toBe(1))
    await act(async () => {})
    expect(shown(result.current.ticked)).toEqual([])
    expect(db.fake.log).toEqual([])
    expect(db.fake.rows).toHaveLength(2)
  })

  it('a tick writes the card’s section and the build’s version, and an untick deletes the row', async () => {
    const board = cards([5, 'gated'])
    const { result } = renderHook(() => usePunchListTicks({ enabled: true, userId: ME, cards: board, boardVersion: 'v2.8200', mayClear: true }))
    await waitFor(() => expect(db.fake.reads).toBe(1))
    await act(async () => {
      await result.current.toggle({ number: 5, group: 'gated' }, true)
    })
    expect(db.fake.log).toEqual(['upsert 5 gated v2.8200'])
    expect(db.fake.rows[0]?.user_id).toBe(ME)
    expect(shown(result.current.ticked)).toEqual([5])
    await act(async () => {
      await result.current.toggle({ number: 5, group: 'gated' }, false)
    })
    expect(db.fake.log).toEqual(['upsert 5 gated v2.8200', 'delete 5'])
    expect(shown(result.current.ticked)).toEqual([])
    expect(db.fake.rows).toEqual([])
  })

  it('puts the box back when a save fails, a tick and an untick alike', async () => {
    db.fake.rows = [row(1, 'ready')]
    const board = cards([1, 'ready'], [2, 'ready'])
    const { result } = renderHook(() => usePunchListTicks({ enabled: true, userId: ME, cards: board, boardVersion: 'v2.8200', mayClear: true }))
    await waitFor(() => expect(shown(result.current.ticked)).toEqual([1]))
    db.fake.failWrite = { code: '42501', message: 'new row violates row-level security policy' }
    await act(async () => {
      await result.current.toggle({ number: 2, group: 'ready' }, true)
    })
    expect(shown(result.current.ticked)).toEqual([1])
    await act(async () => {
      await result.current.toggle({ number: 1, group: 'ready' }, false)
    })
    expect(shown(result.current.ticked)).toEqual([1])
    expect(db.fake.log).toEqual([])
  })

  it('hands back a failure when the read fails, and reads again on retry', async () => {
    db.fake.rows = [row(1, 'ready')]
    db.fake.failRead = { code: '42P01', message: 'relation "public.punch_list_ticks" does not exist' }
    const board = cards([1, 'ready'])
    const { result } = renderHook(() => usePunchListTicks({ enabled: true, userId: ME, cards: board, boardVersion: 'v2.8200', mayClear: true }))
    await waitFor(() => expect(result.current.failure).not.toBeNull())
    expect(result.current.failure?.message).toContain('Your ticks could not be read')
    expect(shown(result.current.ticked)).toEqual([])
    db.fake.failRead = null
    await act(async () => {
      await result.current.reload()
    })
    expect(result.current.failure).toBeNull()
    expect(shown(result.current.ticked)).toEqual([1])
  })

  it('reads nothing for a person who cannot open the page', async () => {
    db.fake.rows = [row(1, 'ready')]
    const board = cards([1, 'ready'])
    const { result } = renderHook(() => usePunchListTicks({ enabled: false, userId: ME, cards: board, boardVersion: 'v2.8200', mayClear: true }))
    await act(async () => {})
    expect(db.fake.reads).toBe(0)
    expect(shown(result.current.ticked)).toEqual([])
  })

  it('reads again when the tab comes back to the front, so a tick made on another device shows', async () => {
    const board = cards([1, 'ready'])
    const { result } = renderHook(() => usePunchListTicks({ enabled: true, userId: ME, cards: board, boardVersion: 'v2.8200', mayClear: true }))
    await waitFor(() => expect(db.fake.reads).toBe(1))
    db.fake.rows = [row(1, 'ready')]
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    await waitFor(() => expect(shown(result.current.ticked)).toEqual([1]))
  })
})
