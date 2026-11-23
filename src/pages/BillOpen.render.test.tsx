// @vitest-environment jsdom
/**
 * Render smoke for a bill's lasting link as a page (punch list #431, PR 2): the viewer for the office, the same
 * words as any other file for a reader who may not open the bill, the job's list beside the paper when the link
 * names the job, and an address that follows the bill on show. Every house, number, date and amount is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { renderWithProviders, settle } from '../test/renderSmokeMocks'
import type { SupplyInvoiceRow } from '../lib/jobs/supplyInvoiceList'
import type { BillFacts } from '../lib/materials/bills/billViewer'
import type { BillLoad, BillViewerIo } from '../lib/materials/bills/billViewerIo'

vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../components/materials/BillViewer', () => ({
  BillViewer: (p: { items: { invoiceId: string }[]; openId: string; jobId: string | null; standalone?: boolean; search: { query: string; onQuery: (q: string) => void } | null; onOpen: (id: string) => void; onClose: () => void; shareUrlOf: (id: string) => string }) => (
    <div data-testid="viewer" data-open={p.openId} data-items={p.items.map((i) => i.invoiceId).join(',')} data-job={p.jobId ?? ''} data-standalone={String(p.standalone === true)} data-search={p.search ? p.search.query : 'none'} data-link={p.shareUrlOf(p.openId)}>
      <button type="button" onClick={() => p.onOpen('inv-2')}>viewer flips</button>
      <button type="button" onClick={() => p.search?.onQuery('7702')}>viewer types</button>
      <button type="button" onClick={p.onClose}>viewer closes</button>
    </div>
  ),
}))

import BillOpen from './BillOpen'

const facts = (id: string): BillFacts => ({
  invoiceId: id,
  number: 'HS-204418',
  house: 'Harlow Supply',
  houseSite: null,
  dateYmd: '2026-11-16',
  poText: '',
  total: 560,
  kind: 'invoice',
  onJob: null,
  paid: false,
  paidOnYmd: null,
  link: 'https://drive.example/file/d/a/view',
  ownCopyPath: null,
  pageFrom: null,
  pageTo: null,
  linesWords: '4 lines · adds up',
  linesTone: 'ok',
  lines: [],
})

const row = (n: number): SupplyInvoiceRow => ({
  job_id: 'job-9',
  invoice_id: `inv-${n}`,
  allocated_amount: 100 + n,
  invoice_number: `BW 77${String(n).padStart(2, '0')}-01`,
  invoice_date: '2026-10-15',
  invoice_total_amount: 100 + n,
  supply_house_name: 'Brightwater Pipe & Valve',
  website_url: null,
  invoice_link: 'https://drive.example/file/d/x/view',
  pct: 100,
})
const JOB_ROWS = Array.from({ length: 9 }, (_, i) => row(i + 1))

function io(load: BillLoad): BillViewerIo & { asked: string[] } {
  const asked: string[] = []
  return { asked, loadBill: async (id, jobId) => (asked.push(`${id}|${jobId ?? ''}`), load), loadBillBytes: async () => ({ bytes: new ArrayBuffer(4) }) }
}

/** The page under the route the app gives it, with the address on show. */
function Page({ viewerIo, rows = [] }: { viewerIo: BillViewerIo; rows?: SupplyInvoiceRow[] }) {
  const loc = useLocation()
  const id = /^\/files\/bills\/([^/]+)$/.exec(loc.pathname)?.[1]
  return (
    <>
      <div data-testid="address">{`${loc.pathname}${loc.search}`}</div>
      {id ? <BillOpen invoiceId={id} io={viewerIo} loadRows={async () => rows} /> : null}
    </>
  )
}
const open = (path: string, viewerIo: BillViewerIo, rows?: SupplyInvoiceRow[]) =>
  renderWithProviders(
    <Routes>
      <Route path="*" element={<Page viewerIo={viewerIo} rows={rows} />} />
    </Routes>,
    { route: path },
  )

afterEach(() => cleanup())

describe('BillOpen', () => {
  it('a bill alone: the viewer as a page, with no list and no job', async () => {
    const viewerIo = io({ facts: facts('inv-1') })
    open('/files/bills/inv-1', viewerIo)
    expect(screen.getByText('Opening the file…')).toBeTruthy()
    await settle()
    const viewer = screen.getByTestId('viewer')
    expect(viewer.getAttribute('data-open')).toBe('inv-1')
    expect(viewer.getAttribute('data-items')).toBe('inv-1')
    expect(viewer.getAttribute('data-job')).toBe('')
    expect(viewer.getAttribute('data-standalone')).toBe('true')
    expect(viewer.getAttribute('data-search')).toBe('none')
    expect(viewer.getAttribute('data-link')).toMatch(/\/files\/bills\/inv-1$/)
    fireEvent.click(screen.getByRole('button', { name: 'viewer closes' }))
    expect(screen.getByTestId('address').textContent).toBe('/materials?tab=supply-houses')
  })

  it('with its job on the link: that job’s list, a search, and an address that follows the bill', async () => {
    const viewerIo = io({ facts: facts('inv-1') })
    open('/files/bills/inv-1?job=job-9', viewerIo, JOB_ROWS)
    await settle()
    const viewer = () => screen.getByTestId('viewer')
    expect(viewer().getAttribute('data-items')).toBe('inv-1,inv-2,inv-3,inv-4,inv-5,inv-6,inv-7,inv-8,inv-9')
    expect(viewer().getAttribute('data-job')).toBe('job-9')
    expect(viewer().getAttribute('data-search')).toBe('')
    expect(viewer().getAttribute('data-link')).toMatch(/\/files\/bills\/inv-1\?job=job-9$/)
    expect(viewerIo.asked).toEqual(['inv-1|job-9'])
    fireEvent.click(screen.getByRole('button', { name: 'viewer flips' }))
    await settle()
    expect(screen.getByTestId('address').textContent).toBe('/files/bills/inv-2?job=job-9')
    expect(viewer().getAttribute('data-open')).toBe('inv-2')
    // The gate was asked once, for the bill the link named.
    expect(viewerIo.asked).toEqual(['inv-1|job-9'])
    fireEvent.click(screen.getByRole('button', { name: 'viewer types' }))
    expect(viewer().getAttribute('data-items')).toBe('inv-2')
    fireEvent.click(screen.getByRole('button', { name: 'viewer closes' }))
    expect(screen.getByTestId('address').textContent).toBe('/jobs?tab=job-summary')
  })

  it('a job the bill is not on is no list: the bill alone', async () => {
    const viewerIo = io({ facts: facts('inv-99') })
    open('/files/bills/inv-99?job=job-9', viewerIo, JOB_ROWS)
    await settle()
    const viewer = screen.getByTestId('viewer')
    expect(viewer.getAttribute('data-items')).toBe('inv-99')
    expect(viewer.getAttribute('data-job')).toBe('')
    expect(viewer.getAttribute('data-link')).toMatch(/\/files\/bills\/inv-99$/)
  })

  it('a reader who may not open the bill sees the words every file says, and no viewer', async () => {
    open('/files/bills/inv-1?job=job-9', io({ problem: 'notYours' }), JOB_ROWS)
    await settle()
    expect(screen.getByText('This file is not one you can open.')).toBeTruthy()
    expect(screen.queryByTestId('viewer')).toBeNull()
    cleanup()
    open('/files/bills/inv-1', io({ problem: 'notHere' }))
    await settle()
    expect(screen.getByText('This file is not here.')).toBeTruthy()
  })
})
