// @vitest-environment jsdom
/**
 * Bill-tab job-account note (v2.3257): three states — no packet (renders
 * nothing), packet on file (headline + meaning), packet + flagged dollars
 * (adds the money line) — plus the Costs link wiring.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { JobAccountShareRow } from '../../lib/supplyHouseJobAccountsLedger'
import type { JobSupplyInvoiceLine } from '../../lib/fetchJobMaterialsCostSnapshot'

let sharesResult: JobAccountShareRow[] | null = null
vi.mock('../../hooks/useJobAccountShares', () => ({
  useJobAccountShares: () => ({ shares: sharesResult }),
}))

import { JobFormBillJobAccountNote } from './JobFormBillJobAccountNote'

const share: JobAccountShareRow = {
  job_id: 'j1',
  contact_label: 'Reece — Georgetown desk',
  contact_email: 'georgetown@reece.com',
  sent_by_name: 'Taunya',
  sent_at: '2026-08-19T15:00:00Z',
}
const line = (over: Partial<JobSupplyInvoiceLine>): JobSupplyInvoiceLine => ({
  pct: 100,
  invoiceNumber: 'x',
  invoiceDate: '',
  invoiceAmount: 0,
  allocatedAmount: 0,
  supplyHouseName: null,
  isPaid: false,
  onJobAccount: false,
  ...over,
})

afterEach(() => {
  cleanup()
  sharesResult = null
})

describe('JobFormBillJobAccountNote', () => {
  it('renders nothing when no packet is on record', () => {
    sharesResult = []
    renderWithProviders(<JobFormBillJobAccountNote jobId="j1" enabled supplyInvoiceLines={[]} />)
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('names the house and what it means, without a money line when nothing is flagged', () => {
    sharesResult = [share]
    renderWithProviders(<JobFormBillJobAccountNote jobId="j1" enabled supplyInvoiceLines={[line({ allocatedAmount: 500 })]} />)
    const note = screen.getByRole('note', { name: 'Job account on file' })
    expect(note.textContent).toContain('Job account on file with Reece')
    expect(note.textContent).toContain('Reece bills the property owner — not you.')
    expect(note.textContent).not.toContain('on the account')
    expect(screen.queryByRole('button', { name: 'Costs →' })).toBeNull()
  })

  it('adds the flagged dollars and wires the Costs link', () => {
    sharesResult = [share]
    const onOpenCosts = vi.fn()
    renderWithProviders(
      <JobFormBillJobAccountNote
        jobId="j1"
        enabled
        supplyInvoiceLines={[line({ allocatedAmount: 3240.5, onJobAccount: true }), line({ allocatedAmount: 900, onJobAccount: true, isPaid: true })]}
        onOpenCosts={onOpenCosts}
      />,
    )
    expect(screen.getByRole('note').textContent).toContain("$3,240.50 of this job's unpaid supplier invoices are on the account.")
    fireEvent.click(screen.getByRole('button', { name: 'Costs →' }))
    expect(onOpenCosts).toHaveBeenCalledTimes(1)
  })
})
