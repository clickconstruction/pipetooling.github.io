// @vitest-environment jsdom
/**
 * Render smokes for the Lien instruments modal's demand-letter tab (v2.3425):
 * the debtor block reads the bill's party, the statement of account lists the
 * bill as sent, and the preview's Re line carries the bill's number. Wiring
 * only — the statement math lives in src/lib/jobsDocuments/demandLetter.test.ts.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { makeInvoice, makeJob, renderWithProviders } from '../../test/renderSmokeMocks'
import LienInstrumentsModal from './LienInstrumentsModal'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/fetchJobWithDetailsById', () => ({ fetchJobWithDetailsById: async () => null }))
vi.mock('../../lib/supabaseAccessTokenForEdge', () => ({ getAccessTokenForEdgeFunctions: async () => null }))

const INV = makeInvoice({
  id: 'inv-867',
  job_id: 'job-867',
  amount: 1710,
  sequence_order: 1,
  status: 'billed',
  billed_at: '2026-08-18T14:28:00Z',
  sent_to_customer_at: '2026-08-18T14:28:10Z',
  estimated_bill_date: '2026-09-05',
  stripe_invoice_memo: 'Service Visit (HCP #867) Additional gas install and sidewalk bore under patio.',
  bill_to_party: null,
  bill_to_email: null,
})

function job(over: Record<string, unknown> = {}) {
  return makeJob({
    id: 'job-867',
    hcp_number: '867',
    job_name: 'Service Visit — 628 Terrell Rd (HCP 867)',
    job_address: '628 Terrell Rd, San Antonio, TX 78209',
    status: 'billed',
    customer_id: 'cust-rizvi',
    customer_name: 'Rizvi Syed Zulfiqar & Kizilbash Quratulain Fatima',
    customer_email: 'rizvi@example.test',
    gc_customer_id: 'cust-rmc',
    gcCustomer: { id: 'cust-rmc', name: 'RMC- Dudley Mason' },
    bill_to_party: 'gc',
    invoices: [INV],
    payments: [],
    ...over,
  })
}

const baseProps = {
  open: true,
  onClose: () => {},
  invoice: INV,
  signerNameFallback: 'Malachi Whites, Master Plumber',
  authEmail: 'office@clickplumbing.test',
  onOpenExternalPrefill: () => {},
}

describe('LienInstrumentsModal · demand letter reads the bill', () => {
  it('demands of the GC the bill went to, points the owner to the notice, and lists the bill as sent', async () => {
    renderWithProviders(<LienInstrumentsModal {...baseProps} job={job()} />)
    expect(screen.getByRole('dialog', { name: 'Lien instruments' })).toBeTruthy()
    await waitFor(() => expect(screen.getByText(/the GC on the job/)).toBeTruthy())
    const debtor = document.querySelector('[data-demand-debtor]') as HTMLElement
    expect(debtor.textContent).toContain('RMC- Dudley Mason')
    expect(debtor.textContent).toContain('needs a mailing address')
    expect(debtor.textContent).toContain('The bill was addressed to the GC, so the demand goes there too.')
    expect(screen.getAllByRole('button', { name: '§ 53.056 notice' }).length).toBe(2) // the tab and the door in the debtor block
    // The homeowner is not the debtor anywhere on the letter.
    expect(screen.queryByText(/Rizvi Syed/)).toBeNull()

    const stmt = document.querySelector('[data-demand-statement]') as HTMLElement
    expect(stmt.textContent).toContain('#1 — sent August 18, 2026 · due September 5, 2026')
    expect(stmt.textContent).toContain('Service Visit (HCP #867) Additional gas install and sidewalk bore under patio.')
    expect(stmt.textContent).toContain('Balance due$1,710.00')
    expect(stmt.textContent).toContain('Fix it on the bill')

    // The preview: the Re line names the bill's number and the balance; no id fragment.
    expect(screen.getByText('Re: Final Demand for Payment — Invoice #1 · $1,710.00')).toBeTruthy()
    expect(screen.getByText('Statement of account')).toBeTruthy()
    expect(screen.queryByText(/Details of Debt/)).toBeNull()
  })

  it('a bill addressed to the customer is demanded of the customer, with no notice pointer', async () => {
    renderWithProviders(<LienInstrumentsModal {...baseProps} job={job({ gc_customer_id: null, gcCustomer: null, bill_to_party: 'customer' })} />)
    await waitFor(() => expect(screen.getByText(/the customer on the job/)).toBeTruthy())
    const debtor = document.querySelector('[data-demand-debtor]') as HTMLElement
    expect(debtor.textContent).toContain('Rizvi Syed Zulfiqar & Kizilbash Quratulain Fatima')
    expect(debtor.textContent).not.toContain('§ 53.056')
  })
})
