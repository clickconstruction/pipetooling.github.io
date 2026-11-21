// @vitest-environment jsdom
/**
 * Render smoke for the punch list page's search (v2.7263): one field beside the View choice that
 * narrows the cards in both views, carried in the address as `?q=`, cleared by one press or Escape,
 * with an empty state that names the search and offers to clear it. The board is a fixed set of
 * cards here, not the folder, so the counts are known.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '../test/renderSmokeMocks'
import type { BoardItem } from '../lib/todos/todoBoard'

const { items } = vi.hoisted(() => {
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
    row({ slug: 'receipt', number: 299, group: 'ready', name: 'A receipt by text', summary: 'A PDF on a phone.', next: 'Send the first one.', ver: 'v2.7120' }),
    row({ slug: 'ledger', number: 347, group: 'gated', name: 'Subs Ledger', summary: 'Match a payment to the bank line.', next: 'The owner picks.', ver: 'v2.7239' }),
    row({ slug: 'bill', number: 343, group: 'close', name: 'Bill a customer', summary: 'Who gets the bill.', next: 'Delete the folder.', flagged: true }),
    row({ slug: 'pointer', number: 5, group: 'gated', pointer: true, size: 'a sitting', name: 'Owner decisions pending', summary: 'A standing list.', next: 'Read it.' }),
  ]
  return { items }
})

vi.mock('virtual:punch-list', () => ({
  default: { validated: { date: '2026-11-14', version: 'v2.7260' }, openItems: 3, items },
}))
vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../hooks/usePunchListPicks', () => ({
  usePunchListPicks: () => ({ picks: {}, shared: true, save: async () => {} }),
}))
// The ticks have a smoke of their own (PunchList.ticks.render.test.tsx); here nobody has ticked a card.
vi.mock('../hooks/usePunchListTicks', () => ({
  usePunchListTicks: () => ({ ticked: new Set<number>(), failure: null, loading: false, reload: async () => {}, toggle: async () => {} }),
}))

import PunchList from './PunchList'

const field = () => screen.getByTestId('punch-search') as HTMLInputElement
const groupRows = () => screen.queryAllByTestId('punch-flagged').length + document.querySelectorAll('article.punch-row').length
/** The grouped row that carries a name; the Shortlist and the Burndown say the name too, so the rows are read apart. */
const rowNamed = (name: string): Element | null => [...document.querySelectorAll('article.punch-row')].find((a) => a.textContent?.includes(name)) ?? null
const numberRows = () => screen.getAllByTestId('punch-number-row').map((li) => li.getAttribute('data-number'))

describe('PunchList search', () => {
  it('opens on the search the address carries and narrows the groups to the matching cards', () => {
    renderWithProviders(<PunchList />, { route: '/punch-list?q=ledger' })
    expect(field().value).toBe('ledger')
    expect(document.querySelectorAll('article.punch-row').length).toBe(1)
    expect(rowNamed('Subs Ledger')).toBeTruthy()
    expect(rowNamed('A receipt by text')).toBeNull()
    // The Shortlist keeps only the matching row, and a group with none is left out.
    expect(screen.getByTestId('punch-shortlist-gated')).toBeTruthy()
    expect(screen.queryByTestId('punch-shortlist-ready')).toBeNull()
    expect(screen.queryByTestId('punch-flagged')).toBeNull()
  })

  it('narrows as the person types, by number, version or group, and clears with one press', () => {
    renderWithProviders(<PunchList />, { route: '/punch-list' })
    expect(document.querySelectorAll('article.punch-row').length).toBe(4)
    fireEvent.change(field(), { target: { value: '#343' } })
    expect(document.querySelectorAll('article.punch-row').length).toBe(1)
    expect(screen.getByTestId('punch-flagged')).toBeTruthy()
    fireEvent.change(field(), { target: { value: 'v2.7120' } })
    expect(rowNamed('A receipt by text')).toBeTruthy()
    expect(document.querySelectorAll('article.punch-row').length).toBe(1)
    fireEvent.change(field(), { target: { value: 'owner decision' } })
    expect(document.querySelectorAll('article.punch-row').length).toBe(2)
    fireEvent.click(screen.getByRole('button', { name: 'Clear the search' }))
    expect(field().value).toBe('')
    expect(document.querySelectorAll('article.punch-row').length).toBe(4)
    expect(groupRows()).toBeGreaterThan(0)
  })

  it('says so when nothing matches in the groups, offers to clear the search, and Escape empties the field', () => {
    renderWithProviders(<PunchList />, { route: '/punch-list?q=zzqq' })
    const empty = within(screen.getByTestId('punch-group-empty'))
    expect(empty.getByText('No cards match ‘zzqq’.')).toBeTruthy()
    expect(screen.queryByTestId('punch-shortlist')).toBeNull()
    fireEvent.keyDown(field(), { key: 'Escape' })
    expect(field().value).toBe('')
    expect(screen.queryByTestId('punch-group-empty')).toBeNull()
    fireEvent.change(field(), { target: { value: 'zzqq' } })
    fireEvent.click(within(screen.getByTestId('punch-group-empty')).getByRole('button', { name: 'Clear the search' }))
    expect(field().value).toBe('')
    expect(document.querySelectorAll('article.punch-row').length).toBe(4)
  })

  it('composes with the Show filters: a search on top of Unsorted leaves the standing list out', () => {
    renderWithProviders(<PunchList />, { route: '/punch-list?q=owner' })
    expect(document.querySelectorAll('article.punch-row').length).toBe(2)
    fireEvent.click(screen.getByRole('button', { name: /^Unsorted/ }))
    expect(document.querySelectorAll('article.punch-row').length).toBe(1)
    expect(rowNamed('Subs Ledger')).toBeTruthy()
  })

  it('narrows By number the same way, counts the shown cards, and keeps the search across a view press', () => {
    renderWithProviders(<PunchList />, { route: '/punch-list?view=number&q=ledger' })
    expect(numberRows()).toEqual(['347'])
    expect(screen.getByTestId('punch-number-shown').textContent).toBe('1 of 4 cards')
    fireEvent.change(field(), { target: { value: 'zzqq' } })
    const byNumber = within(screen.getByTestId('punch-by-number'))
    expect(byNumber.getByText('No cards match ‘zzqq’.')).toBeTruthy()
    fireEvent.click(byNumber.getByRole('button', { name: 'Clear the search' }))
    expect(field().value).toBe('')
    expect(screen.getByTestId('punch-number-shown').textContent).toBe('4 cards')
    fireEvent.change(field(), { target: { value: '299' } })
    fireEvent.click(screen.getByRole('button', { name: 'By group' }))
    expect(field().value).toBe('299')
    expect(document.querySelectorAll('article.punch-row').length).toBe(1)
    expect(rowNamed('A receipt by text')).toBeTruthy()
  })
})
