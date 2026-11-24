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
// A list handed no read of its own asks the app's: here that one answers no lines and touches no network.
vi.mock('../../lib/materials/lines/paperIo', () => ({ supabasePaperIo: () => ({ loadForInvoices: async () => new Map() }) }))
// The viewer has its own smoke: here it is a stand-in that says what it was handed.
vi.mock('../materials/BillViewer', () => ({
  BillViewer: (p: { items: { invoiceId: string }[]; openId: string; jobId: string | null; search: { query: string; onQuery: (q: string) => void } | null; markWords?: readonly string[]; onOpen: (id: string) => void; onClose: () => void; shareUrlOf: (id: string) => string }) => (
    <div data-testid="viewer" data-open={p.openId} data-items={p.items.map((i) => i.invoiceId).join(',')} data-job={p.jobId ?? ''} data-search={p.search ? p.search.query : 'none'} data-link={p.shareUrlOf(p.openId)} data-words={(p.markWords ?? []).join(',')}>
      <button type="button" onClick={() => p.search?.onQuery('cf117')}>viewer types</button>
      <button type="button" onClick={() => p.onOpen('inv-8')}>viewer flips</button>
      <button type="button" onClick={p.onClose}>viewer closes</button>
    </div>
  ),
}))

import { JobSummarySupplyInvoiceList } from './JobSummarySupplyInvoiceList'
import type { PaperRow } from '../../lib/materials/lines/paperRows'

/** A paper with the lines the search reads: made-up parts and codes. */
function paper(invoiceId: string, lines: [string, string][]): PaperRow {
  return {
    id: `p-${invoiceId}`,
    invoiceId,
    kind: 'invoice',
    number: '',
    datedOn: null,
    orderNumber: '',
    poText: '',
    filePath: null,
    driveFileId: null,
    subtotalCents: null,
    taxCents: null,
    freightCents: null,
    totalCents: null,
    readBy: 'sweep:test',
    readAt: null,
    checkState: 'adds_up',
    checkNote: '',
    acceptedBy: null,
    acceptedAt: null,
    lines: lines.map(([description, houseCode], i) => ({ lineNo: i + 1, lineKind: 'part', houseCode, mfrNumber: '', description, unit: '', qtyOrdered: 1, qtyShipped: 1, qtyBackordered: null, unitPrice: 1, pricingUnit: 'each', extendedCents: 100 })),
  }
}
const asked = { ids: [] as string[][] }
const paperIo = {
  loadForInvoices: async (ids: readonly string[]) => {
    asked.ids.push([...ids])
    return new Map<string, PaperRow>([
      ['inv-2', paper('inv-2', [['3/4 in. ball valve, full port', 'BV-FP-075']])],
      ['inv-6', paper('inv-6', [['Purple primer, pint', 'PRIMER-PT'], ['2 in. ball valve, full port', 'BV-FP-200']])],
    ])
  },
}

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

  it('for the office a part finds the bills whose paper lists it, and each row says which line', async () => {
    asked.ids = []
    renderWithProviders(<JobSummarySupplyInvoiceList rows={MANY} paperIo={paperIo} />)
    await settle()
    // One read, of every bill on the list.
    expect(asked.ids).toEqual([MANY.map((r) => r.invoice_id)])
    expect((screen.getByRole('searchbox') as HTMLInputElement).placeholder).toBe('Search house, invoice, date, amount or a part')
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ball valve' } })
    expect(screen.getAllByTestId('supply-invoice-row')).toHaveLength(2)
    const found = screen.getAllByTestId('supply-invoice-on-paper')
    expect(found.map((el) => el.textContent)).toEqual(['On the paper: 3/4 in. ball valve, full port', 'On the paper: 2 in. ball valve, full port'])
    expect(within(found[0]!).getByText('valve').tagName).toBe('MARK')
    // A code finds its bill too, and a word the row's own facts hold names no line.
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'primer-pt' } })
    expect(screen.getAllByTestId('supply-invoice-row')).toHaveLength(1)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'harlow' } })
    expect(screen.queryAllByTestId('supply-invoice-on-paper')).toHaveLength(0)
    // The viewer is handed the plain words to mark.
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ball valve nov' } })
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ball valve' } })
    fireEvent.click(screen.getByRole('button', { name: 'BW 7702-01' }))
    expect(screen.getByTestId('viewer').getAttribute('data-words')).toBe('ball,valve')
  })

  it('nobody outside the office reads the lines, and a short list asks for none', async () => {
    asked.ids = []
    auth.role = 'helper'
    renderWithProviders(<JobSummarySupplyInvoiceList rows={MANY} paperIo={paperIo} />)
    await settle()
    expect(asked.ids).toEqual([])
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ball valve' } })
    expect(screen.queryAllByTestId('supply-invoice-row')).toHaveLength(0)
    cleanup()
    auth.role = 'dev'
    renderWithProviders(<JobSummarySupplyInvoiceList rows={MANY.slice(0, 3)} paperIo={paperIo} />)
    await settle()
    expect(asked.ids).toEqual([])
  })

  it('a read of the lines that fails leaves the search on the four facts', async () => {
    renderWithProviders(<JobSummarySupplyInvoiceList rows={MANY} paperIo={{ loadForInvoices: async () => Promise.reject(new Error('offline')) }} />)
    await settle()
    expect((screen.getByRole('searchbox') as HTMLInputElement).placeholder).toBe('Search house, invoice, date or amount')
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'cf117' } })
    expect(screen.getAllByTestId('supply-invoice-row')).toHaveLength(1)
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
