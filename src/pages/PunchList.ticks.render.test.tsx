// @vitest-environment jsdom
/**
 * Render smoke for the punch list's ticks and claims: the "I am working on this" checkbox beside
 * every card, and the line that says who is on a card (Taunya's two asks of 2026-11-21). The board
 * is a fixed set of cards and the table is a stand-in kept in memory, so a test can move a card to
 * another section between two draws of the page. Every name is made up.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders, SMOKE_AUTH_USER_ID } from '../test/renderSmokeMocks'
import type { TicksFake } from '../test/punchListTicksFake'
import type { BoardItem } from '../lib/todos/todoBoard'

const { board } = vi.hoisted(() => {
  const row = (over: Partial<BoardItem>): BoardItem => ({
    slug: 'a',
    number: 1,
    flagged: false,
    group: 'ready',
    name: 'A row',
    file: 'to-dos/a.md',
    pointer: false,
    summary: 's',
    next: 'n',
    size: 'S',
    blocker: 'none',
    ver: '',
    opinion: '',
    mockups: [],
    artifacts: [],
    mockup: 'waiting',
    mockupNote: '',
    ...over,
  })
  const items: BoardItem[] = [
    row({ slug: 'receipt', number: 299, group: 'ready', name: 'A receipt by text' }),
    row({ slug: 'ledger', number: 347, group: 'gated', name: 'Subs Ledger' }),
    row({ slug: 'bill', number: 343, group: 'close', name: 'Bill a customer', flagged: true }),
    row({ slug: 'draft', number: 0, group: 'ready', name: 'A card with no number yet' }),
  ]
  return { board: { validated: { date: '2026-11-21', version: 'v2.8200' }, openItems: 4, items } }
})
vi.mock('virtual:punch-list', () => ({ default: board }))

const db = vi.hoisted(() => ({ fake: null as unknown as TicksFake }))
vi.mock('../lib/supabase', async () => {
  const { makeTicksFake } = await import('../test/punchListTicksFake')
  db.fake = makeTicksFake()
  return { supabase: db.fake.supabase }
})
vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../hooks/usePunchListPicks', () => ({
  usePunchListPicks: () => ({ picks: {}, shared: true, save: async () => {} }),
}))

import PunchList from './PunchList'

const BEN = 'user-ben'
const HOUR = 3_600_000
const ago = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString()
const tick = (card_number: number, section: string, over: { board_version?: string; user_id?: string; ticked_at?: string } = {}) => ({
  user_id: SMOKE_AUTH_USER_ID,
  card_number,
  section,
  board_version: 'v2.8200',
  ...over,
})
/** The claim line of a card in the grouped view, as plain words; '' when the card says nothing. */
const claimOn = (n: number) => document.querySelector(`article.punch-row[data-number="${n}"] [data-testid="punch-claim"]`)?.textContent ?? ''
const box = (name: string) => screen.getByRole('checkbox', { name }) as HTMLInputElement
const RECEIPT = 'I am working on #299, A receipt by text'
const LEDGER = 'I am working on #347, Subs Ledger'
const BILL = 'I am working on #343, Bill a customer'
const count = () => screen.getByTestId('punch-ticked-count').textContent
const cardRows = () => document.querySelectorAll('article.punch-row').length

beforeEach(() => {
  db.fake.reset()
  db.fake.names = { [SMOKE_AUTH_USER_ID]: 'ZZ Ana', [BEN]: 'ZZ Ben' }
  board.items[0]!.group = 'ready'
  board.validated.version = 'v2.8200'
})

describe('PunchList ticks', () => {
  it('draws a named checkbox beside every card that has a number, ticked where the person ticked it', async () => {
    db.fake.rows = [tick(347, 'gated')]
    renderWithProviders(<PunchList />, { route: '/punch-list' })
    await waitFor(() => expect(box(LEDGER).checked).toBe(true))
    expect(box(RECEIPT).checked).toBe(false)
    expect(box(BILL).checked).toBe(false)
    // Three cards carry a number, so three boxes; the card with none takes no tick.
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
    expect(cardRows()).toBe(4)
    expect(count()).toBe('1')
    expect(screen.getByTestId('punch-tick-blurb').textContent).toContain('Everyone who opens this board sees your name on it.')
    // The person's own fresh tick says so on the card, and a card nobody ticked says nothing.
    expect(claimOn(347)).toContain('You are working on this. Last update just now.')
    expect(claimOn(299)).toBe('')
  })

  it('a tick saves the card’s section and the build’s version, and an untick deletes the row', async () => {
    renderWithProviders(<PunchList />, { route: '/punch-list' })
    await waitFor(() => expect(db.fake.reads).toBeGreaterThan(0))
    fireEvent.click(box(RECEIPT))
    await waitFor(() => expect(db.fake.log).toEqual(['upsert 299 ready v2.8200']))
    expect(box(RECEIPT).checked).toBe(true)
    expect(count()).toBe('1')
    fireEvent.click(box(RECEIPT))
    await waitFor(() => expect(db.fake.log).toEqual(['upsert 299 ready v2.8200', 'delete 299']))
    expect(box(RECEIPT).checked).toBe(false)
    expect(count()).toBe('0')
  })

  it('keeps a tick across a reload of the page', async () => {
    renderWithProviders(<PunchList />, { route: '/punch-list' })
    await waitFor(() => expect(db.fake.reads).toBeGreaterThan(0))
    fireEvent.click(box(RECEIPT))
    await waitFor(() => expect(db.fake.log).toHaveLength(1))
    cleanup()
    renderWithProviders(<PunchList />, { route: '/punch-list' })
    await waitFor(() => expect(box(RECEIPT).checked).toBe(true))
  })

  it('a card that moves to another section draws no tick the next time the page is opened', async () => {
    db.fake.rows = [tick(299, 'ready'), tick(347, 'gated')]
    renderWithProviders(<PunchList />, { route: '/punch-list' })
    await waitFor(() => expect(box(RECEIPT).checked).toBe(true))
    cleanup()
    // #299 moves from ready to build to close out, and the site is built again.
    board.items[0]!.group = 'close'
    board.validated.version = 'v2.8201'
    renderWithProviders(<PunchList />, { route: '/punch-list' })
    await waitFor(() => expect(box(LEDGER).checked).toBe(true))
    expect(box(RECEIPT).checked).toBe(false)
    expect(count()).toBe('1')
  })

  it('puts the box back and says why when a save fails', async () => {
    renderWithProviders(<PunchList />, { route: '/punch-list' })
    await waitFor(() => expect(db.fake.reads).toBeGreaterThan(0))
    db.fake.failWrite = { code: '42501', message: 'new row violates row-level security policy for table "punch_list_ticks"' }
    fireEvent.click(box(RECEIPT))
    expect(await screen.findByText(/The tick on #299 was not saved/)).toBeTruthy()
    expect(box(RECEIPT).checked).toBe(false)
    expect(count()).toBe('0')
    expect(db.fake.log).toEqual([])
  })

  it('draws every card and says the ticks could not be read when the read fails', async () => {
    db.fake.rows = [tick(347, 'gated')]
    db.fake.failRead = { code: '42P01', message: 'relation "public.punch_list_ticks" does not exist' }
    renderWithProviders(<PunchList />, { route: '/punch-list' })
    const failed = within(await screen.findByTestId('punch-ticks-failed'))
    expect(failed.getByText(/The ticks could not be read/)).toBeTruthy()
    expect(failed.getByText('The cards are all here, with no ticks and no names shown.')).toBeTruthy()
    expect(cardRows()).toBe(4)
    expect(box(LEDGER).checked).toBe(false)
  })

  it('Working on narrows the cards to the ticked ones, and the empty words clear it', async () => {
    db.fake.rows = [tick(347, 'gated')]
    renderWithProviders(<PunchList />, { route: '/punch-list' })
    await waitFor(() => expect(box(LEDGER).checked).toBe(true))
    fireEvent.click(screen.getByTestId('punch-ticked-only'))
    expect(cardRows()).toBe(1)
    expect(screen.getByTestId('punch-ticked-only').getAttribute('aria-pressed')).toBe('true')
    // The last tick taken off leaves nothing to show, and one press brings the cards back.
    fireEvent.click(box(LEDGER))
    await waitFor(() => expect(db.fake.log).toEqual(['delete 347']))
    fireEvent.click(within(screen.getByTestId('punch-group-empty')).getByRole('button'))
    expect(cardRows()).toBe(4)
    expect(screen.getByTestId('punch-ticked-only').getAttribute('aria-pressed')).toBe('false')
  })

  it('By number carries one box a row, and an opened card draws no second one', async () => {
    db.fake.rows = [tick(343, 'close')]
    renderWithProviders(<PunchList />, { route: '/punch-list?view=number' })
    await waitFor(() => expect(box(BILL).checked).toBe(true))
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
    const billRow = screen.getAllByTestId('punch-number-row').find((li) => li.getAttribute('data-number') === '343')!
    fireEvent.click(within(billRow).getByRole('button', { expanded: false }))
    expect(billRow.querySelector('article.punch-row')).toBeTruthy()
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
    fireEvent.click(box(RECEIPT))
    await waitFor(() => expect(db.fake.log).toEqual(['upsert 299 ready v2.8200']))
  })
})

describe('PunchList claims', () => {
  it('says who is working on a card, with the name and the time drawn apart from the words', async () => {
    db.fake.rows = [tick(299, 'ready', { user_id: BEN, ticked_at: ago(3) })]
    renderWithProviders(<PunchList />, { route: '/punch-list' })
    await waitFor(() => expect(claimOn(299)).toContain('ZZ Ben is working on this. Last update 3 h ago.'))
    // It is the other person's claim: this person's box is clear and Working on counts nothing.
    expect(box(RECEIPT).checked).toBe(false)
    expect(count()).toBe('0')
    const line = document.querySelector('article.punch-row[data-number="299"] [data-testid="punch-claim"] [data-tone="taken"]')!
    expect([...line.querySelectorAll('[data-value="worked-out"]')].map((b) => b.textContent)).toEqual(['ZZ Ben', '3 h ago'])
    expect(within(line as HTMLElement).queryByRole('button')).toBeNull()
  })

  it('reads a card as free once its claim has been quiet 12 hours, and a tick takes it over', async () => {
    db.fake.rows = [tick(299, 'ready', { user_id: BEN, ticked_at: ago(15) })]
    renderWithProviders(<PunchList />, { route: '/punch-list' })
    await waitFor(() => expect(claimOn(299)).toContain('Free to pick up. ZZ Ben had it and went quiet 3 h ago.'))
    fireEvent.click(box(RECEIPT))
    await waitFor(() => expect(db.fake.log).toEqual(['upsert 299 ready v2.8200']))
    expect(claimOn(299)).toContain('You are working on this.')
    expect(claimOn(299)).not.toContain('ZZ Ben')
    // The other person's row is theirs: still in the table.
    expect(db.fake.rows).toHaveLength(2)
  })

  it('keeps the claimer’s own tick after 12 quiet hours, and Still on it makes the claim fresh again', async () => {
    db.fake.rows = [tick(299, 'ready', { ticked_at: ago(15) })]
    renderWithProviders(<PunchList />, { route: '/punch-list' })
    await waitFor(() => expect(claimOn(299)).toContain('Your claim went quiet 3 h ago. Others see this card as free to pick up.'))
    expect(box(RECEIPT).checked).toBe(true)
    expect(count()).toBe('1')
    fireEvent.click(screen.getByRole('button', { name: 'Still on it, #299' }))
    await waitFor(() => expect(db.fake.log).toEqual(['upsert 299 ready v2.8200']))
    await waitFor(() => expect(claimOn(299)).toContain('You are working on this. Last update just now.'))
    expect(screen.queryByRole('button', { name: 'Still on it, #299' })).toBeNull()
    expect(box(RECEIPT).checked).toBe(true)
  })

  it('names both people when two hold one card', async () => {
    db.fake.rows = [tick(299, 'ready', { user_id: BEN, ticked_at: ago(2) })]
    renderWithProviders(<PunchList />, { route: '/punch-list' })
    await waitFor(() => expect(claimOn(299)).toContain('ZZ Ben is working on this.'))
    fireEvent.click(box(RECEIPT))
    await waitFor(() => expect(claimOn(299)).toContain('You and ZZ Ben are working on this. Last update just now.'))
    // An untick takes off this person's claim alone.
    fireEvent.click(box(RECEIPT))
    await waitFor(() => expect(db.fake.log).toEqual(['upsert 299 ready v2.8200', 'delete 299']))
    expect(claimOn(299)).toContain('ZZ Ben is working on this.')
    expect(db.fake.rows.map((r) => r.user_id)).toEqual([BEN])
  })

  it('a card that moved to another section shows nobody’s claim', async () => {
    db.fake.rows = [tick(299, 'ready', { user_id: BEN, ticked_at: ago(1) }), tick(347, 'gated', { user_id: BEN, ticked_at: ago(1) })]
    board.items[0]!.group = 'close'
    board.validated.version = 'v2.8201'
    renderWithProviders(<PunchList />, { route: '/punch-list' })
    await waitFor(() => expect(claimOn(347)).toContain('ZZ Ben is working on this.'))
    expect(claimOn(299)).toBe('')
  })

  it('By number says who is on a card on a line of its own, with Still on it', async () => {
    db.fake.rows = [tick(299, 'ready', { ticked_at: ago(15) }), tick(347, 'gated', { user_id: BEN, ticked_at: ago(1) })]
    renderWithProviders(<PunchList />, { route: '/punch-list?view=number' })
    const rowOf = (n: string) => screen.getAllByTestId('punch-number-row').find((li) => li.getAttribute('data-number') === n)!
    await waitFor(() => expect(rowOf('347').querySelector('[data-testid="punch-claim"]')?.textContent).toContain('ZZ Ben is working on this. Last update 1 h ago.'))
    expect(rowOf('299').querySelector('[data-testid="punch-claim"]')?.textContent).toContain('Your claim went quiet 3 h ago.')
    expect(rowOf('343').querySelector('[data-testid="punch-claim"]')).toBeNull()
    fireEvent.click(within(rowOf('299')).getByRole('button', { name: 'Still on it, #299' }))
    await waitFor(() => expect(db.fake.log).toEqual(['upsert 299 ready v2.8200']))
  })
})
