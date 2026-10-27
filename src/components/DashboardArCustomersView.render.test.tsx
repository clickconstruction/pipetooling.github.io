// @vitest-environment jsdom
/**
 * Render smoke for the AR Customers view's lien chips (v2.5488): the customer header wears the
 * worst state, the unfolded bill carries the chip and the desk's sentence, the chip's press
 * hands its chip to the door, and the lens pair narrows the list.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import DashboardArCustomersView from './DashboardArCustomersView'
import { buildArCustomerRollup } from '../lib/arCustomerRollup'
import type { FinancialItem } from '../lib/dashboardFinancials'
import type { LienArChip } from '../lib/jobs/lienArChip'
import { renderWithProviders } from '../test/renderSmokeMocks'

vi.mock('./customers/CustomerPortalGlobeButton', () => ({ default: () => null }))

const TODAY = '2026-10-13'

function item(p: Partial<FinancialItem> & { key: string; jobId: string; customerId: string; customerName: string }): FinancialItem {
  return { label: p.key, sublabel: null, amount: 1000, dateYmd: '2026-08-18', address: null, pctComplete: 100, ...p }
}

const ITEMS: FinancialItem[] = [
  item({ key: '273 · Dudley (Lennox)', jobId: 'j273', customerId: 'c1', customerName: 'RMC- Dudley Mason', amount: 12520, dateYmd: '2026-03-16' }),
  item({ key: '858 · Service Visit', jobId: 'j858', customerId: 'c1', customerName: 'RMC- Dudley Mason', amount: 7902 }),
  item({ key: '800 · Service Visit', jobId: 'j800', customerId: 'c1', customerName: 'RMC- Dudley Mason', amount: 1600 }),
  item({ key: '412 · Quiet job', jobId: 'j412', customerId: 'c2', customerName: 'Quiet Builders', amount: 5000 }),
]

const RED: LienArChip = { tone: 'red', state: 'due', paper: 'notice', words: 'Waiting on Robert · by Oct 15 · 2d', sentence: 'August’s § 53.056 notice · Waiting on Robert · since Oct 7', title: 'Open it on the Lien desk', door: { to: 'desk', jobId: 'j273', kind: 'notice', pile: 'awaiting' }, dueOn: '2026-10-15', daysLeft: 2 }
const GREEN: LienArChip = { tone: 'green', state: 'out', paper: 'notice', words: 'Delivered Sep 16 · day 5', sentence: '§ 53.056 notice sent Sep 12 by certified mail', title: 'Open the job’s Lien window', door: { to: 'window', jobId: 'j858', tab: 'notice' }, dueOn: null, daysLeft: null }

const CHIPS = new Map<string, LienArChip | null>([
  ['j273', RED],
  ['j858', GREEN],
  ['j800', null],
  ['j412', null],
])

function renderView(onOpenLien = vi.fn()) {
  const rollup = buildArCustomerRollup(ITEMS, null, TODAY)
  const utils = renderWithProviders(
    <DashboardArCustomersView rollup={rollup} query="" onOpenJob={null} billExtras={() => null} collectionsSection={null} isMobile={false} lienChips={CHIPS} onOpenLien={onOpenLien} />,
  )
  return { ...utils, onOpenLien }
}

describe('AR Customers view — lien chips (v2.5488)', () => {
  it('the customer header wears the worst state and the lens pair counts customers', () => {
    renderView()
    const head = screen.getByTestId('ar-lien-customer-chip')
    expect(head.textContent).toContain('Waiting on Robert · by Oct 15 · 2d')
    expect(head.getAttribute('data-tone')).toBe('red')
    expect(head.getAttribute('title')).toContain('858 · Service Visit: Delivered Sep 16 · day 5')
    expect(screen.getByTestId('ar-lien-lens-due').textContent).toContain('Lien paper due')
    expect(screen.getByTestId('ar-lien-lens-due').textContent).toContain('· 1')
    expect(screen.getByTestId('ar-lien-lens-out').textContent).toContain('· 1')
    // A customer with no chip wears none.
    expect(screen.getAllByTestId('ar-lien-customer-chip')).toHaveLength(1)
  })

  it('unfolding the customer shows each job’s chip and sentence; the chip opens its door', () => {
    const { onOpenLien } = renderView()
    fireEvent.click(screen.getByText('RMC- Dudley Mason'))
    const lines = screen.getAllByTestId('ar-lien-line')
    expect(lines).toHaveLength(2)
    expect(lines[0]?.textContent).toContain('August’s § 53.056 notice · Waiting on Robert · since Oct 7')
    const chips = screen.getAllByTestId('ar-lien-chip')
    expect(chips.map((c) => c.getAttribute('data-tone'))).toEqual(['red', 'green'])
    fireEvent.click(chips[1] as HTMLElement)
    expect(onOpenLien).toHaveBeenCalledWith(GREEN)
    // The press stays on the chip: the row did not fold.
    expect(screen.getAllByTestId('ar-lien-line')).toHaveLength(2)
  })

  it('the lens narrows the list to the customers it names and clears on a second press', () => {
    renderView()
    expect(screen.getByText('Quiet Builders')).toBeTruthy()
    fireEvent.click(screen.getByTestId('ar-lien-lens-out'))
    expect(screen.queryByText('Quiet Builders')).toBeNull()
    expect(screen.getByText('RMC- Dudley Mason')).toBeTruthy()
    fireEvent.click(screen.getByTestId('ar-lien-lens-out'))
    expect(screen.getByText('Quiet Builders')).toBeTruthy()
  })
})

describe('AR Customers view — the empty list names the next press (punch list #184, sweep C)', () => {
  it('a search with no match quotes it, and Clear the search clears the shared box', () => {
    const onClearSearch = vi.fn()
    const rollup = buildArCustomerRollup(ITEMS, null, TODAY)
    renderWithProviders(
      <DashboardArCustomersView rollup={rollup} query="zzz" onClearSearch={onClearSearch} onOpenJob={null} billExtras={() => null} collectionsSection={null} isMobile={false} />,
    )
    expect((document.querySelector('[data-empty-state]') as HTMLElement).textContent).toBe('No customers match ‘zzz’. Clear the search')
    fireEvent.click(screen.getByRole('button', { name: 'Clear the search' }))
    expect(onClearSearch).toHaveBeenCalledTimes(1)
  })

  it('no open bill at all is the good state', () => {
    const rollup = buildArCustomerRollup([], null, TODAY)
    renderWithProviders(<DashboardArCustomersView rollup={rollup} query="" onOpenJob={null} billExtras={() => null} collectionsSection={null} isMobile={false} />)
    expect((document.querySelector('[data-empty-state]') as HTMLElement).textContent).toBe('Nothing waiting on a customer. Every bill is paid.')
  })
})
