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
    { id: 'job-273', hcp_number: '273', click_number: null, job_name: 'Dudley (Lennox)', job_address: '9703 Lenox Hl, Kyle, TX 78640', gc_customer_id: 'gc-1', customer_address_id: null, revenue: 20000, payments_made: 2415, last_work_date: '2026-08-27', lien_payment_bond: 'unknown', lien_contract_ended_on: null },
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
    expect(within(dudley).getByText('9703 Lenox Hl').nextElementSibling?.textContent).toBe('Kyle, TX 78640')
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
    expect(screen.getByText('Amount due').textContent).toBe('Amount dueFor work in')
    // The Court column (v2.4764): the county, the precinct not yet, the cap chip.
    const court = within(row).getByText(/JP Pct/).closest('td')!
    expect(court.textContent).toContain('JP Pct')
    expect(court.textContent).toContain('within $20,000')
    expect(within(court).getByTitle(/drawing its justice precincts/)).toBeTruthy()
    expect(screen.getByText('Court')).toBeTruthy()
    expect(screen.queryByText(/Unpaid/)).toBeNull()
    expect(screen.getByRole('button', { name: /^Upcoming · 3$/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: /^Due in 30 days · \d+$/ })).toBeTruthy()
    const marks = screen.getAllByTitle('A fact the office has not entered yet')
    expect(marks.length).toBeGreaterThan(0)
    for (const m of marks) expect(m.closest('td')!.style.textAlign).toBe('center')
    expect(screen.getByText('300 · Reliant Health').closest('tr')!.textContent).toContain('Commercial')
    const owner = screen.getByText('none needed')
    expect(owner.nextElementSibling?.textContent).toBe('(with the owner)')
    expect(owner.closest('tr')!.textContent).toContain('310 · Whitfield repipe')
    fireEvent.click(screen.getByRole('button', { name: /Print the grid/ }))
    expect(openHtmlPrintWindow).toHaveBeenCalledTimes(1)
    expect(String(vi.mocked(openHtmlPrintWindow).mock.calls[0]?.[0])).toContain('Lien grid — all GCs')
  })

  it('folds each job into a card on a narrow box: the job leads, each cell names its column, the facts not entered read as one line (v2.4808)', () => {
    render(<LegalPortalLienGrid raw={raw} todayYmd={TODAY} companyName="Click" initialShow="all" />)
    const table = document.querySelector('table.legalCardTable') as HTMLTableElement
    expect(table.closest('.legalCardWrap')).toBeTruthy()
    const row = screen.getByText('273 · Dudley (Lennox)').closest('tr')!
    const cells = [...row.children] as HTMLElement[]
    expect(cells.map((c) => c.getAttribute('data-label'))).toEqual(['', 'Owner of record', 'Property', 'Court', 'Last on site', 'Amount due · for work in', '§ 53.056 per month', 'Affidavit by', 'Bond', 'Paid out to GC', '10 % reserved', 'Contract completed', ''])
    // The facts the office has not entered drop out of the card; the last cell names them, a card's only.
    const missing = row.querySelector('[data-legal-card-missing]') as HTMLElement
    expect(missing.className).toBe('legalCardOnly')
    expect(missing.textContent).toMatch(/^Not entered yet: .*payment bond.*\.$/)
    for (const c of cells.slice(1, 12)) {
      const unknown = Boolean(c.querySelector('[title="A fact the office has not entered yet"]')) && c.textContent === '?'
      if (['Owner of record', 'Last on site', 'Affidavit by', 'Bond', 'Paid out to GC', '10 % reserved', 'Contract completed'].includes(c.getAttribute('data-label')!)) expect(c.hasAttribute('data-card-drop')).toBe(unknown)
    }
    // The court cell keeps its own mark for the tests and the print.
    expect(row.querySelector('[data-legal-grid-court]')?.getAttribute('data-label')).toBe('Court')
  })

  it('the rail lists every GC with its count and dollars, largest first, and a click narrows the grid and the print', async () => {
    const { openHtmlPrintWindow } = await import('../../../lib/jobsDocuments/printWindow')
    vi.mocked(openHtmlPrintWindow).mockClear()
    render(<LegalPortalLienGrid raw={raw} todayYmd={TODAY} companyName="Click" initialShow="all" />)
    const rail = within(screen.getByRole('navigation', { name: 'GCs' }))
    const names = rail.getAllByRole('button').filter((b) => b.hasAttribute('data-legal-lien-gc')).map((b) => b.textContent)
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

  it('the rail follows Due in 30 days / Upcoming, and a chosen GC that empties falls back to All GCs', () => {
    render(<LegalPortalLienGrid raw={raw} todayYmd={TODAY} companyName="Click" initialShow="all" />)
    const rail = within(screen.getByRole('navigation', { name: 'GCs' }))
    fireEvent.click(rail.getByRole('button', { name: /EPC Sparti/ }))
    fireEvent.click(screen.getByRole('button', { name: /Due in 30 days/ }))
    // Reliant's one month is due Nov 16, outside the desk's lead — the entry is left off and the grid shows every due job.
    expect(rail.queryByRole('button', { name: /EPC Sparti/ })).toBeNull()
    expect(rail.getByRole('button', { name: /All GCs/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('273 · Dudley (Lennox)')).toBeTruthy()
    expect(screen.queryByText(/Nothing on the grid/)).toBeNull()
  })
  it('the rail reads by court: counties by their dollars, the justice precincts under them, over the limit apart, bands when more than one court shows, and the print follows (v2.4825)', async () => {
    const { openHtmlPrintWindow } = await import('../../../lib/jobsDocuments/printWindow')
    vi.mocked(openHtmlPrintWindow).mockClear()
    const address = (id: string, county: string, jp_precinct: string) => ({ id, customer_id: 'cust-1', address: '', county, jp_precinct, jp_precinct_note: '' }) as unknown as LienBookRaw['addresses'][number]
    const courts: LienBookRaw = {
      ...raw,
      jobs: raw.jobs.map((j) => (j.id === 'job-273' ? { ...j, customer_address_id: 'addr-273' } : j.id === 'job-300' ? { ...j, customer_address_id: 'addr-300', revenue: 24_800 } : j)),
      addresses: [address('addr-273', 'Hays', '2'), address('addr-300', 'Bexar County', '')],
    }
    const { container } = render(<LegalPortalLienGrid raw={courts} todayYmd={TODAY} companyName="Click" initialShow="all" />)
    fireEvent.click(screen.getByRole('button', { name: 'Courts' }))
    const rail = within(screen.getByRole('navigation', { name: 'Courts' }))
    const entries = () => [...container.querySelectorAll('[data-legal-lien-court]')] as HTMLButtonElement[]
    expect(entries().map((b) => [b.getAttribute('data-legal-lien-court'), b.querySelector('.legalLienCourtFull')?.textContent, b.querySelector('.legalLienGcOpen')?.textContent])).toEqual([
      ['all', 'All courts', '$44,180'],
      ['county', 'Bexar County', '$24,800'],
      ['court', 'Over $20,000 · county court', '$24,800'],
      ['county', 'Hays County', '$17,585'],
      ['court', 'Precinct 2', '$17,585'],
      ['none', 'County not on the record', '$1,795'],
    ])
    expect(entries()[1]!.querySelector('.legalLienCourtShort')?.textContent).toBe('Bexar')
    // Every court: a band opens each court's run, in the rail's order.
    const bands = () => [...container.querySelectorAll('tr[data-legal-lien-band]')].map((tr) => tr.querySelector('b')?.textContent)
    expect(bands()).toEqual(['Bexar County · over $20,000, county or district court', 'Hays County · Justice Court, Precinct 2', 'County not on the record'])
    expect(container.querySelector('[data-legal-lien-summary]')?.textContent).toMatch(/3 jobs · \$44,180 open · every court$/)
    expect(container.querySelector('tr[data-legal-lien-band="precinct"]')?.textContent).toBe('Hays County · Justice Court, Precinct 2 · 1 job · $17,585')
    fireEvent.click(screen.getByRole('button', { name: /Print the grid/ }))
    const all = String(vi.mocked(openHtmlPrintWindow).mock.calls[0]?.[0])
    expect(all).toContain('Lien grid — every court')
    expect(all.match(/<tr class="sect">/g)).toHaveLength(3)
    expect(all).toContain('Hays County · Justice Court, Precinct 2 · 1 job · $17,585')
    // One court: its rows only, no band, and the print says which court.
    fireEvent.click(entries().find((b) => b.querySelector('.legalLienCourtFull')?.textContent === 'Precinct 2')!)
    expect(screen.getByText('273 · Dudley (Lennox)')).toBeTruthy()
    expect(screen.queryByText('300 · Reliant Health')).toBeNull()
    expect(bands()).toEqual([])
    expect(container.querySelector('[data-legal-lien-summary]')?.textContent).toMatch(/1 job · \$17,585 open · Hays County · Justice Court, Precinct 2$/)
    fireEvent.click(screen.getByRole('button', { name: /Print the grid/ }))
    const one = String(vi.mocked(openHtmlPrintWindow).mock.calls[1]?.[0])
    expect(one).toContain('Lien grid — Hays County · Justice Court, Precinct 2')
    expect(one).not.toContain('class="sect"')
    // Back to the GCs: the pick clears and the whole view returns.
    fireEvent.click(rail.getByRole('button', { name: 'GCs' }))
    const gcs = within(screen.getByRole('navigation', { name: 'GCs' }))
    expect(gcs.getByRole('button', { name: /All GCs/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('300 · Reliant Health')).toBeTruthy()
    expect(bands()).toEqual([])
  })
})
