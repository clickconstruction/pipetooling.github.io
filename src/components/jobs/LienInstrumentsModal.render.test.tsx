// @vitest-environment jsdom
/**
 * Render smokes for the Lien instruments modal's demand-letter tab (v2.3425):
 * the debtor block reads the bill's party, the statement of account lists the
 * bill as sent, and the preview's Re line carries the bill's number. Wiring
 * only — the statement math lives in src/lib/jobsDocuments/demandLetter.test.ts.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
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
  it('the header carries the job’s timeline (v2.3781) instead of two dates', async () => {
    renderWithProviders(<LienInstrumentsModal {...baseProps} job={job()} />)
    await waitFor(() => expect(document.querySelector('[data-lien-window-timeline]')).toBeTruthy())
    const strip = document.querySelector('[data-lien-window-timeline]') as HTMLElement
    expect(strip.textContent).toContain('§ 53.052')
    expect(strip.textContent).toContain('Next on the path')
    expect(screen.queryByText(/File by /)).toBeNull()
  })

  it('demands of the GC the bill went to, points the owner to the notice, and lists the bill as sent', async () => {
    renderWithProviders(<LienInstrumentsModal {...baseProps} job={job()} />)
    expect(screen.getByRole('dialog', { name: 'Lien instruments' })).toBeTruthy()
    await waitFor(() => expect(screen.getByText(/the GC on the job/)).toBeTruthy())
    const debtor = document.querySelector('[data-demand-debtor]') as HTMLElement
    expect(debtor.textContent).toContain('RMC- Dudley Mason')
    expect(debtor.textContent).toContain('needs a mailing address')
    expect(debtor.textContent).toContain('The bill was addressed to the GC, so the demand goes there too.')
    expect(screen.getAllByRole('button', { name: '§ 53.056 notice' }).length).toBe(2) // the tab and the door in the debtor block
    // The homeowner is not the debtor.
    expect(debtor.textContent).not.toContain('Rizvi')

    const stmt = document.querySelector('[data-demand-statement]') as HTMLElement
    expect(stmt.textContent).toContain('#1 — sent August 18, 2026 · due September 5, 2026')
    expect(stmt.textContent).toContain('Service Visit (HCP #867) Additional gas install and sidewalk bore under patio.')
    expect(stmt.textContent).toContain('Balance due$1,710.00')
    expect(stmt.textContent).toContain('Fix it on the bill')

    // The preview: the Re line names the bill's number and the balance; no id fragment.
    expect(screen.getByText('Re: Final Demand for Payment — Invoice #1 · $1,710.00')).toBeTruthy()
    expect(screen.getByText('Statement of account')).toBeTruthy()
    expect(screen.queryByText(/Details of Debt/)).toBeNull()

    // Exhibits (v2.3429): the invoice always, no agreement on this job, the delivery record by switch — named on the letter and drawn under it.
    const enclosed = document.querySelector('[data-demand-enclosed]') as HTMLElement
    expect(enclosed.textContent).toContain('Exhibit A · Invoice #1, as sent August 18, 2026')
    expect(enclosed.textContent).toContain('always')
    expect(enclosed.textContent).toContain('Signed agreement — none on this job')
    expect(enclosed.textContent).toContain('Exhibit C · Delivery record')
    expect(screen.getByText('The invoice is enclosed as Exhibit A and the delivery record as Exhibit C. All payments and credits have been allowed.')).toBeTruthy()
    expect(document.querySelector('[data-demand-exhibit="A"]')).toBeTruthy()
    expect(document.querySelector('[data-demand-exhibit="C"]')).toBeTruthy()
    expect(document.querySelector('[data-demand-exhibit="B"]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Print packet' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Download PDF · 3 documents' })).toBeTruthy()
  })

  it('names its basis on every line (v2.3433): the fee clock, the court, the interest, and a greyed lien line with the reason', async () => {
    renderWithProviders(<LienInstrumentsModal {...baseProps} job={job()} />)
    await waitFor(() => expect(document.querySelector('[data-demand-fee-clock]')).toBeTruthy())
    expect((document.querySelector('[data-demand-fee-clock]') as HTMLElement).textContent).toContain('30 days after this letter')
    // No approved work month on this job → the Chapter 53 line is not offered, and says why.
    const blocked = document.querySelector('[data-demand-lien-blocked]') as HTMLElement
    expect(blocked.textContent).toContain('not offered — no approved work month')
    expect(screen.getByText(/is within the \$20,000 limit/)).toBeTruthy()
    expect(screen.getByText(/Prop\. Code § 28\.004 — the bill was a written payment request; from September 23, 2026/)).toBeTruthy()
    // The letter itself.
    expect(screen.getByText(/we will also seek our attorney's fees under Texas Civil Practice and Remedies Code § 38\.001/)).toBeTruthy()
    expect(screen.getByText(/bears interest at 1\.5 percent per month from September 23, 2026 under § 28\.004/)).toBeTruthy()
    expect(screen.queryByText(/mechanic's lien under Chapter 53 of the Texas Property Code/)).toBeNull()
    expect(screen.queryByText(/late fees and interest may continue/)).toBeNull()
  })

  // v2.3515: the § 31.04 gate reads every payment on the job, not the letter's claim sum.
  it('a payment on the job — even on another bill — makes the theft-of-services report not applicable', async () => {
    const paidElsewhere = job({ payments: [{ id: 'p1', job_id: 'job-867', invoice_id: 'inv-other', amount: 8000, paid_on: '2026-06-04', sequence_order: 0 }] })
    renderWithProviders(<LienInstrumentsModal {...baseProps} job={paidElsewhere} />)
    await waitFor(() => expect(screen.getByText(/not applicable — payments have been made on this job/)).toBeTruthy())
    // The letter's own claim still reads the covered bill in full: the $8,000 is another bill's.
    expect(screen.getByText(/Nothing has been paid\./)).toBeTruthy()
  })

  it('a single-bill job with an unlinked payment claims the difference, and the gate closes', async () => {
    const paidUnlinked = job({ payments: [{ id: 'p1', job_id: 'job-867', invoice_id: null, amount: 1000, paid_on: '2026-08-20', sequence_order: 0 }] })
    renderWithProviders(<LienInstrumentsModal {...baseProps} job={paidUnlinked} />)
    await waitFor(() => expect(screen.getByText(/\$1,000\.00 has been paid and \$710\.00 remains\./)).toBeTruthy())
    expect(screen.getByText(/not applicable — payments have been made on this job/)).toBeTruthy()
  })

  it('no payments at all leaves the theft-of-services report available (and off)', async () => {
    renderWithProviders(<LienInstrumentsModal {...baseProps} job={job()} />)
    await waitFor(() => expect(screen.getByText(/available — no payments made on this job/)).toBeTruthy())
  })

  it('offers Email with the PDF as a second channel, prefilled with the payer email (v2.3436)', async () => {
    renderWithProviders(<LienInstrumentsModal {...baseProps} job={job({ gc_customer_id: null, gcCustomer: null, bill_to_party: 'customer' })} />)
    await waitFor(() => expect(screen.getByText(/the customer on the job/)).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Email with the PDF…' }))
    const sheet = document.querySelector('[data-demand-email]') as HTMLElement
    expect(sheet.textContent).toContain('A second channel, not the only one')
    expect((sheet.querySelector('input[type="email"]') as HTMLInputElement).value).toBe('rizvi@example.test')
    expect(screen.getByRole('button', { name: 'Send · 3 documents' })).toBeTruthy()
  })

  it('unticking the delivery record drops Exhibit C from the letter and the preview', async () => {
    renderWithProviders(<LienInstrumentsModal {...baseProps} job={job()} />)
    await waitFor(() => expect(document.querySelector('[data-demand-exhibit="C"]')).toBeTruthy())
    const boxes = (document.querySelector('[data-demand-enclosed]') as HTMLElement).querySelectorAll('input[type="checkbox"]')
    expect(boxes.length).toBe(1)
    fireEvent.click(boxes[0]!)
    await waitFor(() => expect(document.querySelector('[data-demand-exhibit="C"]')).toBeNull())
    expect(screen.getByText('The invoice is enclosed as Exhibit A. All payments and credits have been allowed.')).toBeTruthy()
  })

  it('a bill addressed to the customer is demanded of the customer, with no notice pointer', async () => {
    renderWithProviders(<LienInstrumentsModal {...baseProps} job={job({ gc_customer_id: null, gcCustomer: null, bill_to_party: 'customer' })} />)
    await waitFor(() => expect(screen.getByText(/the customer on the job/)).toBeTruthy())
    const debtor = document.querySelector('[data-demand-debtor]') as HTMLElement
    expect(debtor.textContent).toContain('Rizvi Syed Zulfiqar & Kizilbash Quratulain Fatima')
    expect(debtor.textContent).not.toContain('§ 53.056')
  })
})
