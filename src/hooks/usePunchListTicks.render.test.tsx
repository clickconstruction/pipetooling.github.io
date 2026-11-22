// @vitest-environment jsdom
/**
 * The punch list's ticks and claims, the hook alone: what it reads, whose rows it may clear with no press and
 * when, what Still on it does, and that a press a read overlapped is not undone. The table is a stand-in kept in
 * memory, and every name is made up.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { TicksFake } from '../test/punchListTicksFake'
import type { ClaimCard } from '../lib/todos/punchListClaims'

const db = vi.hoisted(() => ({ fake: null as unknown as TicksFake }))
vi.mock('../lib/supabase', async () => {
  const { makeTicksFake } = await import('../test/punchListTicksFake')
  db.fake = makeTicksFake()
  return { supabase: db.fake.supabase }
})

import { usePunchListTicks } from './usePunchListTicks'

const ME = 'user-me'
const BEN = 'user-ben'
const HOUR = 3_600_000
const NOW = Date.parse('2026-11-22T18:00:00.000Z')
const ago = (hours: number) => new Date(NOW - hours * HOUR).toISOString()
const row = (card_number: number, section: string, over: { board_version?: string; user_id?: string; ticked_at?: string; claimer_name?: string } = {}) => ({
  user_id: ME,
  card_number,
  section,
  board_version: 'v2.8196',
  ...over,
})
const cards = (...pairs: Array<[number, ClaimCard['group']]>): ClaimCard[] => pairs.map(([number, group]) => ({ number, group, slug: `card-${number}` }))
const shown = (set: ReadonlySet<number>) => [...set].sort((a, b) => a - b)

/** The hook as the page calls it; a test changes `at` and rerenders to move the board, the clock or the card times. */
function mount(at: { cards: ClaimCard[]; boardVersion?: string; mayClear?: boolean; enabled?: boolean; nowMs?: number; touched?: Record<string, number> }) {
  return renderHook(() =>
    usePunchListTicks({
      enabled: at.enabled ?? true,
      userId: ME,
      userName: 'ZZ Ana',
      cards: at.cards,
      boardVersion: at.boardVersion ?? 'v2.8200',
      mayClear: at.mayClear ?? true,
      touched: at.touched,
      nowMs: at.nowMs ?? NOW,
    }),
  )
}

beforeEach(() => {
  db.fake.reset()
  db.fake.names = { [ME]: 'ZZ Ana', [BEN]: 'ZZ Ben' }
  db.fake.now = () => new Date(NOW).toISOString()
})

describe('usePunchListTicks', () => {
  it('reads every person’s rows: the person’s own ticks, and other people’s claims by name', async () => {
    db.fake.rows = [row(1, 'ready'), row(2, 'ready'), row(7, 'ready', { user_id: BEN })]
    const { result } = mount({ cards: cards([1, 'ready'], [2, 'close'], [7, 'ready']), mayClear: false })
    await waitFor(() => expect(shown(result.current.ticked)).toEqual([1]))
    // Card 2 moved to close out: not shown. Card 7 is another person's: a claim on the card, and not this person's tick.
    expect(result.current.claims.byCard.get(7)?.held.map((c) => c.name)).toEqual(['ZZ Ben'])
    expect(result.current.claims.byCard.get(7)?.mine).toBeNull()
    expect(result.current.claims.byCard.has(2)).toBe(false)
    expect(result.current.failure).toBeNull()
    // Nothing is deleted where the page may not clear (a dev server, View as).
    expect(db.fake.log).toEqual([])
    expect(db.fake.rows).toHaveLength(3)
  })

  it('deletes the person’s own rows of a card that moved and a card that left the list, and nobody else’s', async () => {
    db.fake.rows = [row(1, 'ready'), row(2, 'ready'), row(9, 'waiting'), row(2, 'ready', { user_id: BEN }), row(9, 'waiting', { user_id: BEN })]
    const { result } = mount({ cards: cards([1, 'ready'], [2, 'close']) })
    await waitFor(() => expect(db.fake.log).toEqual(['delete 2,9']))
    expect(shown(result.current.ticked)).toEqual([1])
    expect(db.fake.rows.filter((r) => r.user_id === ME).map((r) => r.card_number)).toEqual([1])
    // The other person's two stale rows are theirs to clear: still in the table, and on no card.
    expect(db.fake.rows.filter((r) => r.user_id === BEN)).toHaveLength(2)
    expect(result.current.claims.byCard.has(2)).toBe(false)
  })

  it('a made-up card whose section changes between two reads loses its tick, and the row goes', async () => {
    db.fake.rows = [row(77, 'ready')]
    const at = { cards: cards([77, 'ready']), boardVersion: 'v2.8196' }
    const { result, rerender } = mount(at)
    await waitFor(() => expect(shown(result.current.ticked)).toEqual([77]))
    expect(db.fake.log).toEqual([])
    // The card moves from ready to close out and the site is built again.
    at.cards = cards([77, 'close'])
    at.boardVersion = 'v2.8197'
    rerender()
    await waitFor(() => expect(db.fake.log).toEqual(['delete 77']))
    expect(shown(result.current.ticked)).toEqual([])
    expect(db.fake.rows).toEqual([])
  })

  it('an old copy of the page hides a tick it cannot judge and deletes nothing', async () => {
    // The tick was made on a newer board, on a card this copy has never heard of, and one it thinks is elsewhere.
    db.fake.rows = [row(500, 'ready', { board_version: 'v2.8300' }), row(2, 'close', { board_version: 'v2.8300' })]
    const { result } = mount({ cards: cards([2, 'ready']) })
    await waitFor(() => expect(db.fake.reads).toBe(1))
    await act(async () => {})
    expect(shown(result.current.ticked)).toEqual([])
    expect(db.fake.log).toEqual([])
    expect(db.fake.rows).toHaveLength(2)
  })

  it('a tick writes the card’s section and the build’s version, and an untick deletes the row', async () => {
    const { result } = mount({ cards: cards([5, 'gated']) })
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

  it('an untick takes off the person’s own claim and leaves another person’s on the same card', async () => {
    db.fake.rows = [row(5, 'gated'), row(5, 'gated', { user_id: BEN })]
    const { result } = mount({ cards: cards([5, 'gated']) })
    await waitFor(() => expect(shown(result.current.ticked)).toEqual([5]))
    await act(async () => {
      await result.current.toggle({ number: 5, group: 'gated' }, false)
    })
    expect(shown(result.current.ticked)).toEqual([])
    expect(result.current.claims.byCard.get(5)?.held.map((c) => c.name)).toEqual(['ZZ Ben'])
    expect(db.fake.rows.map((r) => r.user_id)).toEqual([BEN])
  })

  it('a claim goes quiet 12 hours after the tick, and Still on it makes it fresh again', async () => {
    db.fake.rows = [row(5, 'gated', { ticked_at: ago(15) })]
    const { result } = mount({ cards: cards([5, 'gated']) })
    await waitFor(() => expect(shown(result.current.ticked)).toEqual([5]))
    // The person's own tick stays, marked as gone quiet.
    expect(result.current.claims.byCard.get(5)?.mine?.quiet).toBe(true)
    expect(db.fake.log).toEqual([])
    await act(async () => {
      await result.current.stillOn({ number: 5, group: 'gated' })
    })
    expect(db.fake.log).toEqual(['upsert 5 gated v2.8200'])
    expect(db.fake.rows).toHaveLength(1)
    await act(async () => {
      await result.current.reload()
    })
    expect(result.current.claims.byCard.get(5)?.mine?.quiet).toBe(false)
  })

  it('the clock moving past the twelfth hour turns a fresh claim quiet with no read', async () => {
    db.fake.rows = [row(5, 'gated', { user_id: BEN, ticked_at: ago(11) })]
    const at = { cards: cards([5, 'gated']), nowMs: NOW }
    const { result, rerender } = mount(at)
    await waitFor(() => expect(result.current.claims.byCard.get(5)?.held).toHaveLength(1))
    at.nowMs = NOW + 2 * HOUR
    rerender()
    expect(result.current.claims.byCard.get(5)?.held).toHaveLength(0)
    expect(result.current.claims.byCard.get(5)?.wentQuiet.map((c) => c.name)).toEqual(['ZZ Ben'])
    expect(db.fake.reads).toBe(1)
  })

  it('a change of the card file on main keeps an old claim fresh', async () => {
    db.fake.rows = [row(5, 'gated', { user_id: BEN, ticked_at: ago(30) })]
    const at: Parameters<typeof mount>[0] = { cards: cards([5, 'gated']) }
    const { result, rerender } = mount(at)
    await waitFor(() => expect(result.current.claims.byCard.get(5)?.wentQuiet).toHaveLength(1))
    at.touched = { 'card-5': Math.floor((NOW - 2 * HOUR) / 1000) }
    rerender()
    expect(result.current.claims.byCard.get(5)?.held.map((c) => c.name)).toEqual(['ZZ Ben'])
  })

  it('puts the box back when a save fails: a tick, an untick and a Still on it alike', async () => {
    db.fake.rows = [row(1, 'ready', { ticked_at: ago(15) })]
    const { result } = mount({ cards: cards([1, 'ready'], [2, 'ready']) })
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
    await act(async () => {
      await result.current.stillOn({ number: 1, group: 'ready' })
    })
    // Still quiet: the claim was not renewed.
    expect(result.current.claims.byCard.get(1)?.mine?.quiet).toBe(true)
    expect(db.fake.log).toEqual([])
  })

  it('hands back a failure when the read fails, and reads again on retry', async () => {
    db.fake.rows = [row(1, 'ready')]
    db.fake.failRead = { code: '42P01', message: 'relation "public.punch_list_ticks" does not exist' }
    const { result } = mount({ cards: cards([1, 'ready']) })
    await waitFor(() => expect(result.current.failure).not.toBeNull())
    expect(result.current.failure?.message).toContain('The ticks could not be read')
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
    const { result } = mount({ cards: cards([1, 'ready']), enabled: false })
    await act(async () => {})
    expect(db.fake.reads).toBe(0)
    expect(shown(result.current.ticked)).toEqual([])
  })

  it('reads again when the tab comes back to the front, so another person’s new claim shows', async () => {
    const { result } = mount({ cards: cards([1, 'ready']) })
    await waitFor(() => expect(db.fake.reads).toBe(1))
    db.fake.rows = [row(1, 'ready', { user_id: BEN })]
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    await waitFor(() => expect(result.current.claims.byCard.get(1)?.held.map((c) => c.name)).toEqual(['ZZ Ben']))
    expect(shown(result.current.ticked)).toEqual([])
  })
})
