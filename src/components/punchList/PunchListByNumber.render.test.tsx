// @vitest-environment jsdom
/** Render smoke for the punch list's By number view. */
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { PunchListByNumber } from './PunchListByNumber'
import { flipOrder, type NumberOrder } from '../../lib/todos/punchListByNumber'
import type { BoardItem } from '../../lib/todos/todoBoard'
import { renderWithProviders } from '../../test/renderSmokeMocks'

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

// The board's own order is group then name, so the numbers arrive shuffled.
const items: BoardItem[] = [
  row({ slug: 'queue', number: 46, group: 'ready', size: 'S per PR · XL for the whole queue', name: 'Decomposition queue', next: 'Cut the next file from the queue.' }),
  row({ slug: 'receipt', number: 299, group: 'ready', name: 'A receipt by text', ver: 'v2.7120 · 7133', mockups: ['to-dos/receipt/mockup.html', 'to-dos/receipt/phone.html'], mockup: 'has' }),
  row({ slug: 'checks', number: 76, group: 'close', size: 'XS (two live steps, no code)', name: 'Returned checks' }),
  row({ slug: 'bill', number: 343, group: 'gated', name: 'Bill a customer: who gets it', flagged: true }),
  row({ slug: 'pointer', number: 5, group: 'gated', pointer: true, size: 'a sitting', name: 'Owner decisions pending' }),
]

/** The page's half: it owns the order, and the card it hands in for an opened row. */
function Harness({ visible = () => true, start = 'newest' }: { visible?: (item: BoardItem) => boolean; start?: NumberOrder }) {
  const [order, setOrder] = useState<NumberOrder>(start)
  const [cleared, setCleared] = useState(false)
  return (
    <PunchListByNumber
      items={items}
      visible={(it) => cleared || visible(it)}
      order={order}
      onFlip={() => setOrder(flipOrder(order))}
      onClearFilters={() => setCleared(true)}
      renderCard={(it) => <div data-testid="full-card">The whole card for #{it.number}</div>}
    />
  )
}

const numbers = () => screen.getAllByTestId('punch-number-row').map((li) => li.getAttribute('data-number'))
/** The row at a place in the list; the test fails here, by name, when the list is shorter. */
const rowAt = (at: number): HTMLElement => {
  const li = screen.getAllByTestId('punch-number-row')[at]
  if (!li) throw new Error(`no row at ${at}`)
  return li
}

describe('PunchListByNumber', () => {
  it('lists every card the highest number first, and one press flips it', () => {
    renderWithProviders(<Harness />)
    expect(numbers()).toEqual(['343', '299', '76', '46', '5'])
    expect(screen.getByTestId('punch-number-shown').textContent).toBe('5 cards')
    const press = screen.getByTestId('punch-number-order')
    expect(press.textContent).toContain('Newest first')
    fireEvent.click(press)
    expect(numbers()).toEqual(['5', '46', '76', '299', '343'])
    expect(screen.getByTestId('punch-number-order').textContent).toContain('Oldest first')
    fireEvent.click(screen.getByTestId('punch-number-order'))
    expect(numbers()).toEqual(['343', '299', '76', '46', '5'])
  })

  it('draws the number, the name, the group chip, the size letter, the version and the mock-up on a row', () => {
    renderWithProviders(<Harness />)
    const receipt = within(rowAt(1))
    expect(receipt.getByRole('link', { name: '#299' }).getAttribute('href')).toBe('#n299')
    expect(receipt.getByRole('link', { name: 'A receipt by text' }).getAttribute('href')).toContain('to-dos/a.md')
    expect(receipt.getByTestId('punch-number-group').textContent).toBe('Ready to build')
    expect(receipt.getByTitle(/^S — a sitting/)).toBeTruthy()
    expect(receipt.getByRole('link', { name: 'v2.7120' })).toBeTruthy()
    expect(receipt.getByRole('link', { name: /mock-up · 1 of 2/ }).getAttribute('href')).toBe('/to-dos/receipt/mockup.html')
    // The newest card is flagged and still waits on a drawing; the standing list takes no size.
    const bill = within(rowAt(0))
    expect(bill.getByLabelText('Flagged')).toBeTruthy()
    expect(bill.getByText(/waiting on a mock-up/)).toBeTruthy()
    expect(within(rowAt(4)).getByText('standing list')).toBeTruthy()
  })

  it('opens the card under a row on a press of its Next line, and closes it on the next', () => {
    renderWithProviders(<Harness />)
    const queue = rowAt(3)
    const next = within(queue).getByRole('button', { name: /Cut the next file from the queue/ })
    expect(next.getAttribute('title')).toContain('Cut the next file from the queue.')
    expect(next.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByTestId('full-card')).toBeNull()
    fireEvent.click(next)
    expect(within(queue).getByTestId('full-card').textContent).toBe('The whole card for #46')
    expect(next.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(next)
    expect(screen.queryByTestId('full-card')).toBeNull()
  })

  it('follows the page filters, narrows to one group, and says how many of the cards are shown', () => {
    renderWithProviders(<Harness visible={(it) => !it.pointer} />)
    expect(numbers()).toEqual(['343', '299', '76', '46'])
    expect(screen.getByTestId('punch-number-shown').textContent).toBe('4 of 5 cards')
    fireEvent.click(screen.getByRole('button', { name: /Ready to build 2/ }))
    expect(numbers()).toEqual(['299', '46'])
    expect(screen.getByTestId('punch-number-shown').textContent).toBe('2 of 5 cards')
    fireEvent.click(screen.getByRole('button', { name: /Every group 4/ }))
    expect(numbers()).toEqual(['343', '299', '76', '46'])
  })

  it('names the way out when the filters leave no card', () => {
    renderWithProviders(<Harness visible={() => false} />)
    expect(screen.queryAllByTestId('punch-number-row')).toEqual([])
    expect(screen.getByText('No cards match the filters.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Clear the filters' }))
    expect(numbers()).toEqual(['343', '299', '76', '46', '5'])
  })
})
