// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import LegalPortalLienGrid from './LegalPortalLienGrid'
import type { LienBookRaw } from '../../../lib/jobs/lienTimelineBookAssemble'

vi.mock('../../../lib/jobsDocuments/printWindow', () => ({ openHtmlPrintWindow: vi.fn(() => true) }))

const TODAY = '2026-09-23'

const raw: LienBookRaw = {
  rows: [{ job_id: 'job-273', work_month: '2026-08', approved_hours: 12, deadline: '2026-10-15', noticed: false, open_balance: 17585, customer_id: 'cust-1', gc_customer_id: 'gc-1', property_kind: 'residential', has_owner: true, desk_item_id: null, desk_status: null, desk_months: null, month_source: 'hours' }],
  affidavitRows: [],
  items: [],
  filings: [],
  jobs: [{ id: 'job-273', hcp_number: '273', click_number: null, job_name: 'Dudley (Lennox)', job_address: '9703 Lenox Hl', gc_customer_id: 'gc-1', customer_address_id: null, revenue: 20000, payments_made: 2415, last_work_date: '2026-08-27', lien_payment_bond: 'unknown', lien_contract_ended_on: null }],
  gcs: [{ id: 'gc-1', name: 'Lenox', lien_notice_policy: null }],
  addresses: [],
  owners: [],
}

describe('LegalPortalLienGrid', () => {
  it('draws the book as counsel’s twelve columns, a ? where the app holds no fact, per GC, and prints the grid', async () => {
    const { openHtmlPrintWindow } = await import('../../../lib/jobsDocuments/printWindow')
    render(<LegalPortalLienGrid raw={raw} todayYmd={TODAY} companyName="Click" />)
    expect(screen.getByText('Lien grid')).toBeTruthy()
    expect(screen.getByText('273 · Dudley (Lennox)')).toBeTruthy()
    expect(screen.getByText('Owner of record')).toBeTruthy()
    expect(screen.getAllByTitle('A fact the office has not entered yet').length).toBeGreaterThan(0)
    expect(screen.getByRole('option', { name: /Lenox · 1/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Print the grid/ }))
    expect(openHtmlPrintWindow).toHaveBeenCalledTimes(1)
    expect(String(vi.mocked(openHtmlPrintWindow).mock.calls[0]?.[0])).toContain('Lien grid — all GCs')
  })
})
