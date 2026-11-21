// @vitest-environment jsdom
/**
 * Render smoke for the punch list's ticks: the "I am working on this" checkbox beside every card
 * (Taunya's ask of 2026-11-21). The board is a fixed set of cards and the table is a stand-in kept
 * in memory, so a test can move a card to another section between two draws of the page.
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

const tick = (card_number: number, section: string, board_version = 'v2.8200') => ({ user_id: SMOKE_AUTH_USER_ID, card_number, section, board_version })
const box = (name: string) => screen.getByRole('checkbox', { name }) as HTMLInputElement
const RECEIPT = 'I am working on #299, A receipt by text'
const LEDGER = 'I am working on #347, Subs Ledger'
const BILL = 'I am working on #343, Bill a customer'
const count = () => screen.getByTestId('punch-ticked-count').textContent
const cardRows = () => document.querySelectorAll('article.punch-row').length

beforeEach(() => {
  db.fake.reset()
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
    expect(screen.getByTestId('punch-tick-blurb').textContent).toContain('Only you see your ticks.')
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
    expect(failed.getByText(/Your ticks could not be read/)).toBeTruthy()
    expect(failed.getByText('The cards are all here, with no ticks shown.')).toBeTruthy()
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
