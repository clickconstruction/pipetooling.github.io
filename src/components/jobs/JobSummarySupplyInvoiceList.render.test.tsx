// @vitest-environment jsdom
/**
 * Render smoke for the Job Summary's supply house invoice list (punch list #431, PR 1): the share press and its
 * toast, the search box with its count and total, the house chips, small cents, the short date, and a bill with no
 * PDF. Every house, number, date and amount is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { SupplyInvoiceRow } from '../../lib/jobs/supplyInvoiceList'

const auth = vi.hoisted(() => ({ role: 'dev' }))
vi.mock('../../hooks/useAuth', async () => {
  const mocks = await import('../../test/renderSmokeMocks')
  const base = mocks.useAuthModuleMock()
  return { ...base, useAuth: () => ({ ...base.useAuth(), role: auth.role }) }
})
vi.mock('../../utils/dateUtils', async (orig) => ({ ...(await orig<typeof import('../../utils/dateUtils')>()), todayYmdInAppTz: () => '2026-11-23' }))
const opened = vi.hoisted(() => ({ urls: [] as string[] }))
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (url: string) => opened.urls.push(url) }))
// The viewer has its own smoke: here it is a stand-in that says what it was handed.
vi.mock('../materials/BillViewer', () => ({
  BillViewer: (p: { items: { invoiceId: string }[]; openId: string; jobId: string | null; search: { query: string; onQuery: (q: string) => void } | null; onOpen: (id: string) => void; onClose: () => void; shareUrlOf: (id: string) => string }) => (
    <div data-testid="viewer" data-open={p.openId} data-items={p.items.map((i) => i.invoiceId).join(',')} data-job={p.jobId ?? ''} data-search={p.search ? p.search.query : 'none'} data-link={p.shareUrlOf(p.openId)}>
      <button type="button" onClick={() => p.search?.onQuery('cf117')}>viewer types</button>
      <button type="button" onClick={() => p.onOpen('inv-8')}>viewer flips</button>
      <button type="button" onClick={p.onClose}>viewer closes</button>
    </div>
  ),
}))

import { JobSummarySupplyInvoiceList } from './JobSummarySupplyInvoiceList'

function row(n: number, over: Partial<SupplyInvoiceRow> = {}): SupplyInvoiceRow {
  return {
    job_id: 'job-1',
    invoice_id: `inv-${n}`,
    allocated_amount: 100 + n,
    invoice_number: `BW 77${String(n).padStart(2, '0')}-01`,
    invoice_date: `2026-10-${String(n + 10).padStart(2, '0')}`,
    invoice_total_amount: 100 + n,
    supply_house_name: 'Brightwater Pipe & Valve',
    website_url: 'brightwater.example',
    invoice_link: `https://drive.example/file/d/f${n}/view`,
    pct: 100,
    ...over,
  }
}

const MANY: SupplyInvoiceRow[] = [
  row(1, { supply_house_name: 'Harlow Supply', invoice_number: 'HS-204418', allocated_amount: 560, invoice_total_amount: 560, invoice_date: '2026-11-16' }),
  row(2),
  row(3),
  row(4, { invoice_link: null }),
  row(5),
  row(6),
  row(7),
  row(8, { supply_house_name: 'Cedar Fork Wholesale', invoice_number: 'CF117406', invoice_date: '2025-12-18', allocated_amount: 1085.58, invoice_total_amount: 1085.58 }),
]

let written: string[] = []
beforeEach(() => {
  auth.role = 'dev'
  opened.urls = []
  written = []
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => void written.push(text) } })
})
afterEach(() => cleanup())

describe('JobSummarySupplyInvoiceList', () => {
  it('a short list is the table alone: no box, small cents, a date with no year this year', () => {
    renderWithProviders(<JobSummarySupplyInvoiceList rows={MANY.slice(0, 3)} />)
    expect(screen.queryByRole('searchbox')).toBeNull()
    const first = screen.getAllByTestId('supply-invoice-row')[0]!
    expect(first.textContent).toContain('Harlow Supply')
    expect(first.textContent).toContain('Nov 16')
    expect(first.textContent).not.toContain('2026')
    expect(first.textContent).toContain('$560.00')
    // The cents are their own smaller span.
    expect(within(first).getByText('.00').tagName).toBe('SPAN')
  })

  it('a date from another year keeps its year', () => {
    renderWithProviders(<JobSummarySupplyInvoiceList rows={MANY} />)
    expect(screen.getByText('Dec 18, 2025')).toBeTruthy()
  })

  it('the share press copies the bill’s own link with its job and says so', async () => {
    renderWithProviders(<JobSummarySupplyInvoiceList rows={MANY} />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy a link to invoice HS-204418' }))
    await settle()
    expect(written).toHaveLength(1)
    expect(written[0]).toMatch(/\/files\/bills\/inv-1\?job=job-1$/)
    expect(screen.getByText('Link copied to clipboard')).toBeTruthy()
    // The press copies and does not open the bill.
    expect(opened.urls).toEqual([])
  })

  it('a browser that refuses the clipboard hands the link over to copy by hand', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => Promise.reject(new Error('refused')) } })
    renderWithProviders(<JobSummarySupplyInvoiceList rows={MANY} />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy a link to invoice HS-204418' }))
    await settle()
    expect(screen.getByText(/^Copy this link: .*\/files\/bills\/inv-1\?job=job-1$/)).toBeTruthy()
  })

  it('for the office the invoice number opens the bill in the viewer, with this list and its job', () => {
    renderWithProviders(<JobSummarySupplyInvoiceList rows={MANY} />)
    expect(screen.queryByTestId('viewer')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'HS-204418' }))
    const viewer = screen.getByTestId('viewer')
    expect(viewer.getAttribute('data-open')).toBe('inv-1')
    expect(viewer.getAttribute('data-items')).toBe('inv-1,inv-2,inv-3,inv-4,inv-5,inv-6,inv-7,inv-8')
    expect(viewer.getAttribute('data-job')).toBe('job-1')
    expect(viewer.getAttribute('data-link')).toMatch(/\/files\/bills\/inv-1\?job=job-1$/)
    // No new tab.
    expect(opened.urls).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'viewer flips' }))
    expect(screen.getByTestId('viewer').getAttribute('data-open')).toBe('inv-8')
    fireEvent.click(screen.getByRole('button', { name: 'viewer closes' }))
    expect(screen.queryByTestId('viewer')).toBeNull()
  })

  it('the viewer flips through the list as it is searched, and types into the same search', () => {
    renderWithProviders(<JobSummarySupplyInvoiceList rows={MANY} />)
    fireEvent.click(screen.getByRole('button', { name: /^Brightwater Pipe & Valve 6$/ }))
    fireEvent.click(screen.getByRole('button', { name: 'BW 7702-01' }))
    expect(screen.getByTestId('viewer').getAttribute('data-items')).toBe('inv-2,inv-3,inv-4,inv-5,inv-6,inv-7')
    expect(screen.getByTestId('viewer').getAttribute('data-search')).toBe('')
    fireEvent.click(screen.getByRole('button', { name: /^All 8$/ }))
    fireEvent.click(screen.getByRole('button', { name: 'viewer types' }))
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('cf117')
    expect(screen.getByTestId('viewer').getAttribute('data-items')).toBe('inv-8')
  })

  it('a short list hands the viewer no search', () => {
    renderWithProviders(<JobSummarySupplyInvoiceList rows={MANY.slice(0, 3)} />)
    fireEvent.click(screen.getByRole('button', { name: 'HS-204418' }))
    expect(screen.getByTestId('viewer').getAttribute('data-search')).toBe('none')
  })

  it('for the office a bill with no PDF says so, still opens in the viewer and still has its share press', () => {
    renderWithProviders(<JobSummarySupplyInvoiceList rows={MANY} />)
    expect(screen.getByText('no PDF')).toBeTruthy()
    expect(screen.getAllByTestId('supply-invoice-share')).toHaveLength(8)
    expect(screen.queryByRole('button', { name: /supplier’s site/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'BW 7704-01' }))
    expect(screen.getByTestId('viewer').getAttribute('data-open')).toBe('inv-4')
  })

  it('anyone else keeps the Drive link in a tab of its own, and a bill with no PDF offers the house’s site apart from the number', () => {
    auth.role = 'helper'
    renderWithProviders(<JobSummarySupplyInvoiceList rows={MANY} />)
    fireEvent.click(screen.getByRole('button', { name: 'HS-204418' }))
    expect(opened.urls).toEqual(['https://drive.example/file/d/f1/view'])
    expect(screen.queryByTestId('viewer')).toBeNull()
    expect(screen.queryByRole('button', { name: 'BW 7704-01' })).toBeNull()
    expect(screen.getByText('no PDF')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /supplier’s site/ }))
    expect(opened.urls).toEqual(['https://drive.example/file/d/f1/view', 'https://brightwater.example'])
  })

  it('nobody outside the office gets a share press', () => {
    auth.role = 'helper'
    renderWithProviders(<JobSummarySupplyInvoiceList rows={MANY} />)
    expect(screen.queryAllByTestId('supply-invoice-share')).toHaveLength(0)
    expect(screen.getAllByTestId('supply-invoice-row')).toHaveLength(8)
  })

  it('the box narrows the list and says what is left and what it adds up to', () => {
    renderWithProviders(<JobSummarySupplyInvoiceList rows={MANY} />)
    const count = screen.getByTestId('supply-invoice-count')
    expect(count.textContent).toBe('8 invoices')
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'cf117' } })
    expect(screen.getAllByTestId('supply-invoice-row')).toHaveLength(1)
    expect(count.textContent).toBe('1 of 8 invoices · $1,085.58')
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'nov 16' } })
    expect(screen.getAllByTestId('supply-invoice-row')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'HS-204418' })).toBeTruthy()
  })

  it('a house chip narrows it, and All puts every row back', () => {
    renderWithProviders(<JobSummarySupplyInvoiceList rows={MANY} />)
    const chip = screen.getByRole('button', { name: /^Brightwater Pipe & Valve 6$/ })
    expect(chip.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(chip)
    expect(chip.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getAllByTestId('supply-invoice-row')).toHaveLength(6)
    fireEvent.click(screen.getByRole('button', { name: /^All 8$/ }))
    expect(screen.getAllByTestId('supply-invoice-row')).toHaveLength(8)
  })

  it('a search that finds nothing names the press that clears it', () => {
    renderWithProviders(<JobSummarySupplyInvoiceList rows={MANY} />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzzz' } })
    expect(screen.queryAllByTestId('supply-invoice-row')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Clear the search' }))
    expect(screen.getAllByTestId('supply-invoice-row')).toHaveLength(8)
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('')
  })

  it('a press or a key inside the list does not reach the row around it', () => {
    const heard = { clicks: 0, keys: 0 }
    renderWithProviders(
      <div onClick={() => heard.clicks++} onKeyDown={() => heard.keys++}>
        <JobSummarySupplyInvoiceList rows={MANY} />
      </div>,
    )
    fireEvent.click(screen.getByRole('searchbox'))
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: ' ' })
    expect(heard).toEqual({ clicks: 0, keys: 0 })
  })
})
