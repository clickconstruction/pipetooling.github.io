// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import LegalPortalLienGrid from './LegalPortalLienGrid'
import type { LienBookRaw } from '../../../lib/jobs/lienTimelineBookAssemble'

vi.mock('../../../lib/jobsDocuments/printWindow', () => ({ openHtmlPrintWindow: vi.fn(() => true) }))

const TODAY = '2026-09-23'

const month = (job_id: string, work_month: string, deadline: string, over: Partial<LienBookRaw['rows'][number]> = {}): LienBookRaw['rows'][number] => ({
  job_id, work_month, approved_hours: 12, deadline, noticed: false, open_balance: 17585, customer_id: 'cust-1', gc_customer_id: 'gc-1', property_kind: 'residential', has_owner: true, desk_item_id: null, desk_status: null, desk_months: null, month_source: 'hours', ...over,
})

const raw: LienBookRaw = {
  rows: [
    // Dudley: June's window closed Sep 15, July and August still open.
    month('job-273', '2026-06', '2026-09-15'),
    month('job-273', '2026-07', '2026-10-15'),
    month('job-273', '2026-08', '2026-11-16'),
    // A commercial job on another GC, one month open.
    month('job-300', '2026-08', '2026-11-16', { gc_customer_id: 'gc-2', property_kind: 'non_residential', open_balance: 4800, customer_id: 'cust-2' }),
    // A homeowner's job with no GC.
    month('job-310', '2026-08', '2026-10-15', { gc_customer_id: null, open_balance: 1795, customer_id: 'cust-3' }),
  ],
  affidavitRows: [],
  items: [],
  filings: [],
  jobs: [
    { id: 'job-273', hcp_number: '273', click_number: null, job_name: 'Dudley (Lennox)', job_address: '9703 Lenox Hl', gc_customer_id: 'gc-1', customer_address_id: null, revenue: 20000, payments_made: 2415, last_work_date: '2026-08-27', lien_payment_bond: 'unknown', lien_contract_ended_on: null },
    { id: 'job-300', hcp_number: '300', click_number: null, job_name: 'Reliant Health', job_address: '150 E Sonterra Blvd', gc_customer_id: 'gc-2', customer_address_id: null, revenue: 4800, payments_made: 0, last_work_date: '2026-08-20', lien_payment_bond: 'no', lien_contract_ended_on: null },
    { id: 'job-310', hcp_number: '310', click_number: null, job_name: 'Whitfield repipe', job_address: '7 Willow Ct', gc_customer_id: null, customer_address_id: null, revenue: 1795, payments_made: 0, last_work_date: '2026-08-20', lien_payment_bond: null, lien_contract_ended_on: null },
  ],
  gcs: [
    { id: 'gc-1', name: 'Lenox', lien_notice_policy: null },
    { id: 'gc-2', name: 'EPC Sparti', lien_notice_policy: null },
  ],
  addresses: [],
  owners: [{ job_id: 'job-310', owner_mode: 'homeowner', owner_name: 'Sam Whitfield', company_name: null, mailing_address: '7 Willow Ct' }],
}

describe('LegalPortalLienGrid', () => {
  it('draws the book with the address under the job, the property in words, the total first, the live months only, and prints the grid', async () => {
    const { openHtmlPrintWindow } = await import('../../../lib/jobsDocuments/printWindow')
    render(<LegalPortalLienGrid raw={raw} todayYmd={TODAY} companyName="Click" initialShow="all" />)
    expect(screen.getByText('Lien grid')).toBeTruthy()
    const dudley = screen.getByText('273 · Dudley (Lennox)').closest('td')!
    expect(dudley.textContent).toContain('9703 Lenox Hl')
    const row = dudley.closest('tr')!
    expect(row.textContent).toContain('Residential')
    expect(row.textContent).toContain('No homestead')
    expect(within(row).getByText('$17,585').tagName).toBe('B')
    expect(row.textContent).toContain('Jun, Jul, Aug')
    expect(row.textContent).toContain('Jul: Oct 15')
    expect(row.textContent).toContain('Aug: Nov 16')
    expect(row.textContent).not.toContain('Jun: Sep 15')
    expect(row.textContent).not.toContain('MISSED')
    expect(screen.getByText('Owner of record')).toBeTruthy()
    expect(screen.queryByText('Address')).toBeNull()
    expect(screen.getAllByTitle('A fact the office has not entered yet').length).toBeGreaterThan(0)
    expect(screen.getByText('300 · Reliant Health').closest('tr')!.textContent).toContain('Commercial')
    expect(screen.getByText('310 · Whitfield repipe').closest('tr')!.textContent).toContain('none needed (with the owner)')
    fireEvent.click(screen.getByRole('button', { name: /Print the grid/ }))
    expect(openHtmlPrintWindow).toHaveBeenCalledTimes(1)
    expect(String(vi.mocked(openHtmlPrintWindow).mock.calls[0]?.[0])).toContain('Lien grid — all GCs')
  })

  it('the rail lists every GC with its count and dollars, largest first, and a click narrows the grid and the print', async () => {
    const { openHtmlPrintWindow } = await import('../../../lib/jobsDocuments/printWindow')
    vi.mocked(openHtmlPrintWindow).mockClear()
    render(<LegalPortalLienGrid raw={raw} todayYmd={TODAY} companyName="Click" initialShow="all" />)
    const rail = within(screen.getByRole('navigation', { name: 'GCs' }))
    const names = rail.getAllByRole('button').map((b) => b.textContent)
    expect(names).toEqual(['All GCs3 jobs$24,180', 'Lenox1 job$17,585', 'EPC Sparti1 job$4,800', 'No GC · with the owner1 job$1,795'])
    expect(rail.getByRole('button', { name: /All GCs/ }).getAttribute('aria-pressed')).toBe('true')
    expect(rail.queryByLabelText('Find a GC')).toBeNull()
    fireEvent.click(rail.getByRole('button', { name: /EPC Sparti/ }))
    expect(rail.getByRole('button', { name: /EPC Sparti/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByText('273 · Dudley (Lennox)')).toBeNull()
    expect(screen.getByText('300 · Reliant Health')).toBeTruthy()
    expect(screen.getByText(/1 job · \$4,800 open · EPC Sparti/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Print the grid/ }))
    expect(String(vi.mocked(openHtmlPrintWindow).mock.calls[0]?.[0])).toContain('Lien grid — EPC Sparti')
    fireEvent.click(rail.getByRole('button', { name: /No GC/ }))
    expect(screen.getByText('310 · Whitfield repipe')).toBeTruthy()
    expect(screen.queryByText('300 · Reliant Health')).toBeNull()
  })

  it('the rail follows Something due / All, and a chosen GC that empties falls back to All GCs', () => {
    render(<LegalPortalLienGrid raw={raw} todayYmd={TODAY} companyName="Click" initialShow="all" />)
    const rail = within(screen.getByRole('navigation', { name: 'GCs' }))
    fireEvent.click(rail.getByRole('button', { name: /EPC Sparti/ }))
    fireEvent.click(screen.getByRole('button', { name: /Something due/ }))
    // Reliant's one month is due Nov 16, outside the desk's lead — the entry is left off and the grid shows every due job.
    expect(rail.queryByRole('button', { name: /EPC Sparti/ })).toBeNull()
    expect(rail.getByRole('button', { name: /All GCs/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('273 · Dudley (Lennox)')).toBeTruthy()
    expect(screen.queryByText(/Nothing on the grid/)).toBeNull()
  })
})
