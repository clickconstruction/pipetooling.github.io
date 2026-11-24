// @vitest-environment jsdom
/**
 * Render smoke for the all-bills search (punch list #431, PR 5): what the box asks, the bills it lists, a bill found
 * by a part, the viewer it opens, the share press, a search that finds nothing, one that fails, and an older answer
 * that never draws under newer words. Every house, number, part and amount is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { BillSearchArgs, BillSearchHit } from '../../lib/materials/bills/billSearch'
import type { BillSearchIo } from '../../lib/materials/bills/billSearchIo'

vi.mock('../../lib/supabase', () => ({ supabase: {} }))
vi.mock('../../utils/dateUtils', async (orig) => ({ ...(await orig<typeof import('../../utils/dateUtils')>()), todayYmdInAppTz: () => '2026-11-23' }))
// The viewer has its own smoke: here it is a stand-in that says what it was handed.
vi.mock('./BillViewer', () => ({
  BillViewer: (p: { items: { invoiceId: string }[]; openId: string; markWords?: readonly string[]; shareUrlOf: (id: string) => string; onClose: () => void }) => (
    <div data-testid="viewer" data-open={p.openId} data-items={p.items.map((i) => i.invoiceId).join(',')} data-words={(p.markWords ?? []).join(',')} data-link={p.shareUrlOf(p.openId)}>
      <button type="button" onClick={p.onClose}>viewer closes</button>
    </div>
  ),
}))

import { BillSearch } from './BillSearch'

function hit(id: string, over: Partial<BillSearchHit> = {}): BillSearchHit {
  return {
    invoice_id: id,
    invoice_number: `BW 77${id}-01`,
    invoice_date: '2026-10-15',
    amount: 1085.58,
    supply_house_id: 'h1',
    supply_house_name: 'Brightwater Pipe & Valve',
    purchase_order_number: 'LC-C 102',
    is_paid: false,
    has_pdf: true,
    jobs: [{ id: 'j1', hcp_number: '', click_number: 'JP9431', job_name: 'ZZ Test Larkspur Commons', pct: 100 }],
    on_paper: null,
    on_paper_code: null,
    ...over,
  }
}

function fakeIo(answer: (args: BillSearchArgs) => BillSearchHit[] | Promise<BillSearchHit[]>) {
  const asked: BillSearchArgs[] = []
  const io: BillSearchIo = { search: async (args) => (asked.push(args), answer(args)) }
  return { io, asked }
}
const type = (text: string) => fireEvent.change(screen.getByRole('searchbox'), { target: { value: text } })
/** The box waits a moment after a key: let that moment and the answer pass. */
const answered = async () => {
  await new Promise((r) => setTimeout(r, 5))
  await settle()
}

let written: string[] = []
beforeEach(() => {
  written = []
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => void written.push(text) } })
})
afterEach(() => cleanup())

describe('BillSearch', () => {
  it('asks nothing until there is something worth asking', async () => {
    const { io, asked } = fakeIo(() => [])
    renderWithProviders(<BillSearch io={io} waitMs={0} />)
    expect(screen.queryByTestId('bill-search-count')).toBeNull()
    type('b')
    await answered()
    expect(asked).toEqual([])
    expect(screen.queryByTestId('bill-search-hit')).toBeNull()
  })

  it('lists the bills a search finds, with the house, the day, the amount and the job', async () => {
    const { io, asked } = fakeIo(() => [hit('31'), hit('02', { invoice_date: '2025-12-18', amount: 40.48, is_paid: true, has_pdf: false, jobs: [], purchase_order_number: null })])
    renderWithProviders(<BillSearch io={io} waitMs={0} />)
    type('brightwater oct')
    expect(screen.getByTestId('bill-search-count').textContent).toBe('Searching…')
    await answered()
    expect(asked).toEqual([{ words: ['brightwater'], year: null, month: 10, day: null }])
    expect(screen.getByTestId('bill-search-count').textContent).toBe('2 bills')
    const [first, second] = screen.getAllByTestId('bill-search-hit') as [HTMLElement, HTMLElement]
    expect(first.textContent).toContain('BW 7731-01')
    expect(first.textContent).toContain('Brightwater Pipe & Valve')
    expect(first.textContent).toContain('Oct 15')
    expect(first.textContent).toContain('$1,085.58')
    expect(first.textContent).toContain('JP9431 · ZZ Test Larkspur Commons · PO LC-C 102')
    expect(within(first).getByText('.58').tagName).toBe('SPAN')
    // Another year keeps its year, and a bill with no job, no PDF and a payment says each.
    expect(second.textContent).toContain('Dec 18, 2025')
    expect(second.textContent).toContain('No job on this bill')
    expect(second.textContent).toContain('no PDF')
    expect(second.textContent).toContain('paid')
  })

  it('a bill found by a part says which line found it, with the words marked', async () => {
    const { io } = fakeIo(() => [hit('31', { on_paper: '2 in. ball valve, full port', on_paper_code: 'BV-FP-200' })])
    renderWithProviders(<BillSearch io={io} waitMs={0} />)
    type('ball valve')
    await answered()
    const line = screen.getByTestId('bill-search-on-paper')
    expect(line.textContent).toBe('On the paper: 2 in. ball valve, full portBV-FP-200')
    expect(within(line).getByText('valve').tagName).toBe('MARK')
  })

  it('a bill opens in the viewer with the bills found beside it and the words to mark', async () => {
    const { io } = fakeIo(() => [hit('31'), hit('02')])
    renderWithProviders(<BillSearch io={io} waitMs={0} />)
    type('ball valve')
    await answered()
    fireEvent.click(screen.getByRole('button', { name: 'BW 7702-01' }))
    const viewer = screen.getByTestId('viewer')
    expect(viewer.getAttribute('data-open')).toBe('02')
    expect(viewer.getAttribute('data-items')).toBe('31,02')
    expect(viewer.getAttribute('data-words')).toBe('ball,valve')
    expect(viewer.getAttribute('data-link')).toMatch(/\/files\/bills\/02$/)
    fireEvent.click(screen.getByRole('button', { name: 'viewer closes' }))
    expect(screen.queryByTestId('viewer')).toBeNull()
  })

  it('the link icon copies the bill’s own link and says so', async () => {
    const { io } = fakeIo(() => [hit('31')])
    renderWithProviders(<BillSearch io={io} waitMs={0} />)
    type('7731')
    await answered()
    fireEvent.click(screen.getByRole('button', { name: 'Copy a link to invoice BW 7731-01' }))
    await settle()
    expect(written).toHaveLength(1)
    expect(written[0]).toMatch(/\/files\/bills\/31$/)
    expect(screen.getByText('Link copied to clipboard')).toBeTruthy()
  })

  it('a search that finds nothing names the press that clears it', async () => {
    const { io } = fakeIo(() => [])
    renderWithProviders(<BillSearch io={io} waitMs={0} />)
    type('zzzz')
    await answered()
    expect(screen.queryByTestId('bill-search-hit')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Clear the search' }))
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('')
    expect(screen.queryByTestId('bill-search-count')).toBeNull()
  })

  it('a search that fails says why, and Try again asks again', async () => {
    let fail = true
    const { io, asked } = fakeIo(() => {
      if (fail) throw new Error('permission denied for function search_supply_bills')
      return [hit('31')]
    })
    renderWithProviders(<BillSearch io={io} waitMs={0} />)
    type('harlow')
    await answered()
    expect(screen.getByTestId('bill-search-failed').textContent).toContain('The search did not run.')
    expect(screen.getByTestId('bill-search-failed').textContent).toContain('permission denied')
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await answered()
    expect(screen.getAllByTestId('bill-search-hit')).toHaveLength(1)
    expect(asked).toHaveLength(2)
  })

  it('an older answer never draws under newer words', async () => {
    const slow: { release: (hits: BillSearchHit[]) => void }[] = []
    const { io } = fakeIo((args) => (args.words[0] === 'harlow' ? new Promise<BillSearchHit[]>((resolve) => slow.push({ release: resolve })) : [hit('02')]))
    renderWithProviders(<BillSearch io={io} waitMs={0} />)
    type('harlow')
    await answered()
    type('7702')
    await answered()
    expect(screen.getAllByTestId('bill-search-hit')).toHaveLength(1)
    // The first search answers late, with other bills: the list keeps the answer to what is typed.
    slow[0]!.release([hit('31'), hit('44')])
    await answered()
    expect(screen.getAllByTestId('bill-search-hit')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'BW 7702-01' })).toBeTruthy()
  })

  it('a full page of bills says it is the first of them', async () => {
    const { io } = fakeIo(() => Array.from({ length: 60 }, (_, i) => hit(String(i).padStart(2, '0'))))
    renderWithProviders(<BillSearch io={io} waitMs={0} />)
    type('brightwater')
    await answered()
    expect(screen.getByTestId('bill-search-count').textContent).toBe('the first 60 bills')
  })
})
