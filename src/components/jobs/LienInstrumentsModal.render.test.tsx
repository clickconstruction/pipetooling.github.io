// @vitest-environment jsdom
/**
 * Render smokes for the Lien instruments modal's demand-letter tab (v2.3425):
 * the debtor block reads the bill's party, the statement of account lists the
 * bill as sent, and the preview's Re line carries the bill's number. Wiring
 * only — the statement math lives in src/lib/jobsDocuments/demandLetter.test.ts.
 */
import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { makeInvoice, makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import LienInstrumentsModal from './LienInstrumentsModal'
// The § Rules window is a lazy chunk that carries every help guide (v2.4695). Its first import takes about a
// second alone and outlasts a case's 5 s under a loaded full run (the flake on 2026-10-08), so the file loads it
// here, outside every case's clock; the door's React.lazy then resolves from the module cache (v2.4955).
import './LienRulesModal'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/fetchJobWithDetailsById', () => ({ fetchJobWithDetailsById: async () => null }))
// The pay codes (v2.4849) are drawn by a canvas the test runner has not got; the rows stand without them.
vi.mock('../../lib/jobs/lienNoticePayPageAssets', () => ({ buildPayPageAssets: async () => ({}) }))
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

  it('a computer keeps the steps as a row and its doors, has a × that closes (v2.4398), and has no lientooling.com door (v2.4403)', async () => {
    const onClose = vi.fn()
    renderWithProviders(<LienInstrumentsModal {...baseProps} onClose={onClose} job={job()} />)
    await waitFor(() => expect(document.querySelector('[data-lien-window-timeline]')).toBeTruthy())
    expect(document.querySelector('[data-lien-window-fold]')).toBeNull()
    expect(document.querySelector('[data-lien-window-papers]')).toBeNull()
    expect(screen.getByTestId('lien-rules-door')).toBeTruthy()
    expect(screen.queryByText(/lientooling/)).toBeNull()
    // a computer's foot keeps Cancel and its one wrapping row, and the email panel opens above it (v2.4409 changes a phone only)
    const foot = document.querySelector('[data-demand-foot]') as HTMLElement
    expect(foot.style.display).toBe('flex')
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Email with the PDF…' }))
    expect(document.querySelector('[data-demand-email]')).toBeTruthy()
    expect(document.querySelector('[data-demand-foot]')).toBeTruthy()
    // and Save & record send… stays a panel at the foot, never the phone's sheet (v2.4414)
    fireEvent.click(screen.getByRole('button', { name: 'Save & record send…' }))
    expect(document.querySelector('[data-demand-record-panel]')).toBeTruthy()
    expect(document.querySelector('[data-lien-record-sheet="demand"]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('§ Rules names this job with its notice and lien dates from its last work day (v2.4829)', async () => {
    renderWithProviders(<LienInstrumentsModal {...baseProps} job={job({ last_work_date: '2026-07-20' })} />)
    // Settle on the timeline the window's load paints, as the cases above do, before pressing the door.
    await waitFor(() => expect(document.querySelector('[data-lien-window-timeline]')).toBeTruthy())
    fireEvent.click(screen.getByTestId('lien-rules-door'))
    // The window arrives on the lazy chunk's Suspense retry.
    await screen.findByTestId('lien-rules-modal')
    const strip = await screen.findByTestId('lien-rules-job')
    expect(strip.textContent).toContain('Sub job')
    // The job's property kind is not set: the residential dates, a month earlier than commercial (v2.5031).
    expect(screen.getByTestId('lien-rules-job-notice').textContent).toBe('Sep 15')
    expect(screen.getByTestId('lien-rules-job-lien').textContent).toBe('Oct 15')
    const lit = screen.getByTestId('lien-rules-body').querySelector('table[data-live-dates] tr[data-lit="yes"]')
    expect(lit?.firstElementChild?.textContent).toBe('July')
  })
  it('a phone folds the steps to one strip and puts the papers in one bar (v2.4398); the dropped steps carry no lientooling.com door (v2.4403)', async () => {
    const before = window.matchMedia
    window.matchMedia = ((query: string) => ({ matches: query.includes('max-width: 640px'), media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
    try {
      const onClose = vi.fn()
      renderWithProviders(<LienInstrumentsModal {...baseProps} onClose={onClose} job={job()} />)
      await waitFor(() => expect(document.querySelector('[data-lien-window-fold-strip]')).toBeTruthy())
      expect(document.querySelector('[data-lien-window-timeline]')).toBeNull()
      expect(document.querySelector('[data-lien-window-fold-strip]')!.textContent).toMatch(/^Next /)
      const bar = document.querySelector('[data-lien-window-papers]')!
      expect([...bar.querySelectorAll('[role="tab"]')].map((t) => t.textContent)).toEqual(['Demand letter', '§ 53.056 notice', "Mechanic's lien"])
      expect(bar.querySelector('[aria-selected="true"]')?.textContent).toBe('Demand letter')
      fireEvent.click(screen.getByRole('tab', { name: '§ 53.056 notice' }))
      expect(bar.querySelector('[aria-selected="true"]')?.textContent).toBe('§ 53.056 notice')
      expect(screen.getByTestId('lien-rules-door')).toBeTruthy()
      fireEvent.click(document.querySelector('[data-lien-window-fold-strip]')!)
      expect(document.querySelector('[data-lien-window-fold-panel]')).toBeTruthy()
      expect(screen.queryByText(/lientooling/)).toBeNull()
      // the grey behind the steps closes the steps, never the window
      fireEvent.click(document.querySelector('[data-lien-window-fold-scrim]')!)
      expect(document.querySelector('[data-lien-window-fold-panel]')).toBeNull()
      expect(onClose).not.toHaveBeenCalled()
      // the Demand letter's foot (v2.4409): four doors in two rows, no Cancel beside ×, and the email panel stands in for the row while it is open
      fireEvent.click(screen.getByRole('tab', { name: 'Demand letter' }))
      const foot = () => document.querySelector('[data-demand-foot]') as HTMLElement | null
      expect(foot()!.style.display).toBe('grid')
      expect([...foot()!.querySelectorAll('button')].map((b) => b.textContent!.replace(/ · \d+ documents$/, ''))).toEqual(['Print packet', 'Download PDF', 'Email with the PDF…', 'Save & record send…'])
      expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Email with the PDF…' }))
      expect(document.querySelector('[data-demand-email]')).toBeTruthy()
      expect(foot()).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Back' }))
      expect(document.querySelector('[data-demand-email]')).toBeNull()
      expect(foot()).toBeTruthy()
      // Save & record send… is a sheet over the whole card (v2.4414): no panel at the foot, the job named on it, Back to the letter
      fireEvent.click(screen.getByRole('button', { name: 'Save & record send…' }))
      const sheet = document.querySelector('[data-lien-record-sheet="demand"]') as HTMLElement
      expect(sheet).toBeTruthy()
      expect(document.querySelector('[data-demand-record-panel]')).toBeNull()
      expect(foot()).toBeNull()
      expect(sheet.querySelector('[data-lien-record-summary]')!.textContent).toMatch(/^Demand letter · \$/)
      expect(sheet.querySelector('[data-lien-record-summary]')!.textContent).toContain('Service Visit — 628 Terrell Rd (HCP 867)')
      expect(sheet.querySelectorAll('[aria-pressed]').length).toBe(4)
      fireEvent.click(screen.getByRole('button', { name: 'Back' }))
      expect(document.querySelector('[data-lien-record-sheet="demand"]')).toBeNull()
      expect(foot()).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Close' }))
      expect(onClose).toHaveBeenCalledTimes(1)
    } finally {
      window.matchMedia = before
    }
  })

  it('the LAST WORK stop’s change › opens the last day’s line editing under the timeline; Save the day opens the window that shows what moves; Cancel folds it away (v2.4735)', async () => {
    renderWithProviders(<LienInstrumentsModal {...baseProps} job={job()} />)
    const door = await waitFor(() => {
      const el = document.querySelector('[data-lien-timeline-last-work-door]') as HTMLButtonElement | null
      expect(el).toBeTruthy()
      return el!
    })
    expect(door.textContent).toBe('change ›')
    expect(document.querySelector('[data-lien-window-last-work]')).toBeNull()
    fireEvent.click(door)
    expect(screen.getByTestId('lien-last-work-editor')).toBeTruthy()
    expect(document.querySelector('[data-lien-timeline-last-work-door]')).toBeNull()
    fireEvent.click(screen.getByTestId('lien-last-work-save'))
    expect(screen.getByTestId('lien-last-work-confirm')).toBeTruthy()
    fireEvent.click(within(screen.getByTestId('lien-last-work-confirm')).getByRole('button', { name: 'Close' }))
    expect(screen.queryByTestId('lien-last-work-confirm')).toBeNull()
    fireEvent.click(within(screen.getByTestId('lien-last-work-editor')).getByRole('button', { name: 'Cancel' }))
    expect(document.querySelector('[data-lien-window-last-work]')).toBeNull()
    expect(document.querySelector('[data-lien-timeline-last-work-door]')).toBeTruthy()
  })

  it('reads a day set by hand on its timeline, and the Deadlines door opens it already editing (v2.4735)', async () => {
    renderWithProviders(<LienInstrumentsModal {...baseProps} job={job({ created_at: '2026-02-03T15:00:00Z', last_work_date: null, lien_last_work_on: '2026-08-11', lien_last_work_note: 'The crew’s last trip' })} openLastWork />)
    await waitFor(() => expect(document.querySelector('[data-lien-timeline-step="last_work"]')).toBeTruthy())
    const stop = document.querySelector('[data-lien-timeline-step="last_work"]') as HTMLElement
    expect(stop.textContent).toContain('Aug 2026')
    expect(stop.textContent).not.toMatch(/creation/)
    expect(screen.getByTestId('lien-last-work-editor')).toBeTruthy()
  })

  it('names the next step above the papers, with its door, and links to Release of Lien (punch list #82)', async () => {
    const onOpenLienDesk = vi.fn()
    const onOpenRelease = vi.fn()
    renderWithProviders(<LienInstrumentsModal {...baseProps} job={job()} onOpenLienDesk={onOpenLienDesk} onOpenRelease={onOpenRelease} />)
    await settle()
    expect(screen.getByRole('dialog', { name: /^Liens on job / })).toBeTruthy()
    // v2.4693: the step is said once, in the timeline's verdict band, with its door at the right; the box under the strip is a phone's.
    const card = await waitFor(() => {
      const el = document.querySelector('[data-lien-timeline-verdict]') as HTMLElement | null
      expect(el).toBeTruthy()
      return el!
    })
    expect(card.textContent).toContain('Next on the path')
    expect(document.querySelector('[data-lien-window-next-step]')).toBeNull()
    const door = card.querySelector('[data-lien-window-next-step-button]') as HTMLButtonElement | null
    if (door) {
      fireEvent.click(door)
      // A notice step goes to the desk on this job; any other step switches this window's tab.
      if (/Lien desk/.test(door.textContent ?? '')) expect(onOpenLienDesk).toHaveBeenCalledWith(job().id, expect.stringMatching(/notice|retainage/))
    }
    fireEvent.click(within(document.querySelector('[data-lien-window-waivers]') as HTMLElement).getByRole('button', { name: 'Waivers are their own paper ›' }))
    expect(onOpenRelease).toHaveBeenCalledTimes(1)
  })

  it('demands of the GC the bill went to, points the owner to the notice, and lists the bill as sent', async () => {
    renderWithProviders(<LienInstrumentsModal {...baseProps} job={job()} />)
    await settle()
    expect(screen.getByRole('dialog', { name: /^Liens on job / })).toBeTruthy()
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

    // The preview: the subject names the bill's number, the box the balance; no id fragment.
    expect(screen.getByText('Final demand for payment')).toBeTruthy()
    expect(screen.getByText('Invoice #1')).toBeTruthy()
    expect((document.querySelector('[data-demand-amount-box]') as HTMLElement).textContent).toContain('Balance due$1,710.00')
    expect(screen.getByText('Statement of account')).toBeTruthy()
    expect(screen.queryByText(/Details of Debt/)).toBeNull()

    // Exhibits (v2.3429): the invoice always, no agreement on this job, the delivery record by switch — named on the letter and drawn under it.
    const enclosed = document.querySelector('[data-demand-enclosed]') as HTMLElement
    expect(enclosed.textContent).toContain('Exhibit A · Invoice #1, as sent August 18, 2026')
    expect(enclosed.textContent).toContain('always')
    expect(enclosed.textContent).toContain('Signed agreement — none on this job')
    // The labels run in order: with no agreement the delivery record is B, never C over a missing B.
    expect(enclosed.textContent).toContain('Exhibit B · Delivery record')
    expect(screen.getByText('The invoice is enclosed as Exhibit A and the delivery record as Exhibit B. All payments and credits have been allowed.')).toBeTruthy()
    expect(document.querySelector('[data-demand-exhibit="A"]')).toBeTruthy()
    expect(document.querySelector('[data-demand-exhibit="B"]')).toBeTruthy()
    expect(document.querySelector('[data-demand-exhibit="C"]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Print packet' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Download PDF · 3 documents' })).toBeTruthy()
  })

  it('carries a pay code per covered Stripe bill under the amount box, by a tick that starts on; a paper bill offers none (v2.4849)', async () => {
    renderWithProviders(<LienInstrumentsModal {...baseProps} job={job({ invoices: [{ ...INV, stripe_invoice_id: 'in_878a' }] })} />)
    await settle()
    await waitFor(() => expect(document.querySelector('[data-demand-amount-box]')).toBeTruthy())
    const tick = screen.getByRole('checkbox', { name: /^Pay codes/ }) as HTMLInputElement
    expect(tick.checked).toBe(true)
    expect(tick.closest('label')!.textContent).toContain('one code under the amount box')
    const codes = document.querySelector('[data-demand-pay-codes]') as HTMLElement
    expect(codes).toBeTruthy()
    expect(codes.previousElementSibling!.hasAttribute('data-demand-amount-box')).toBe(true)
    expect(codes.textContent).toContain('Pay online')
    expect(codes.textContent).toContain('Invoice #1')
    expect(codes.textContent).toContain('$1,710.00')
    expect(codes.textContent).toContain('clicktooling.com/pay/inv-867')
    fireEvent.click(tick)
    expect(document.querySelector('[data-demand-pay-codes]')).toBeNull()
    cleanup()
    // A paper bill has no payment page: the tick is greyed and the letter carries no codes.
    renderWithProviders(<LienInstrumentsModal {...baseProps} job={job()} />)
    await settle()
    await waitFor(() => expect(document.querySelector('[data-demand-amount-box]')).toBeTruthy())
    expect(document.querySelector('[data-demand-pay-codes-none]')!.textContent).toContain('not offered')
    expect(document.querySelector('[data-demand-pay-codes]')).toBeNull()
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

  it('Download PDF says it is downloading at its resting width, then goes back (v2.4584)', async () => {
    renderWithProviders(<LienInstrumentsModal {...baseProps} job={job()} />)
    const btn = await screen.findByRole('button', { name: /^Download PDF · \d+ documents$/ })
    expect(btn.getAttribute('data-action-phase')).toBe('idle')
    fireEvent.click(btn)
    expect(btn.getAttribute('data-action-phase')).toBe('busy')
    expect(btn.textContent).toContain('Downloading…')
    // The resting words stay in the layout, hidden, so the button does not change size.
    expect(btn.textContent).toMatch(/Download PDF · \d+ documents/)
    expect((btn as HTMLButtonElement).disabled).toBe(true)
    // The hold is deliberate (1.5 s, then 2 s of Downloaded); a build that fails in jsdom returns at once.
    await waitFor(() => expect(btn.getAttribute('data-action-phase')).toBe('idle'), { timeout: 6000 })
    expect((btn as HTMLButtonElement).disabled).toBe(false)
  }, 10000)

  it('Print packet says it is opening at its resting width, and a blocked popup puts it straight back (v2.4584)', async () => {
    renderWithProviders(<LienInstrumentsModal {...baseProps} job={job()} />)
    const btn = await screen.findByRole('button', { name: 'Print packet' })
    expect(btn.getAttribute('data-action')).toBe('print')
    fireEvent.click(btn)
    expect(btn.getAttribute('data-action-phase')).toBe('busy')
    expect(btn.textContent).toContain('Opening…')
    expect(btn.textContent).toContain('Print packet')
    await waitFor(() => expect(btn.getAttribute('data-action-phase')).toBe('idle'), { timeout: 6000 })
  }, 10000)

  it('the email sheet’s Send keeps its words in the layout, and the footer’s Email button is the same kind of button', async () => {
    renderWithProviders(<LienInstrumentsModal {...baseProps} job={job({ gc_customer_id: null, gcCustomer: null, bill_to_party: 'customer' })} />)
    await waitFor(() => expect(screen.getByText(/the customer on the job/)).toBeTruthy())
    const foot = screen.getByRole('button', { name: 'Email with the PDF…' })
    expect(foot.getAttribute('data-action-phase')).toBe('idle')
    fireEvent.click(foot)
    const send = screen.getByRole('button', { name: /^Send · \d+ documents$/ })
    expect(send.getAttribute('data-action')).toBe('email-send')
    expect(send.getAttribute('data-action-phase')).toBe('idle')
  })

  it('unticking the delivery record drops its exhibit from the letter and the preview', async () => {
    renderWithProviders(<LienInstrumentsModal {...baseProps} job={job()} />)
    await waitFor(() => expect(document.querySelector('[data-demand-exhibit="B"]')).toBeTruthy())
    const boxes = (document.querySelector('[data-demand-enclosed]') as HTMLElement).querySelectorAll('input[type="checkbox"]')
    expect(boxes.length).toBe(1)
    fireEvent.click(boxes[0]!)
    await waitFor(() => expect(document.querySelector('[data-demand-exhibit="B"]')).toBeNull())
    expect(screen.getByText('The invoice is enclosed as Exhibit A. All payments and credits have been allowed.')).toBeTruthy()
  })

  it('an evening bill reads its own day on the statement, the exhibit and the notice history', async () => {
    // Marked billed and sent at 7:30 pm CDT on Oct 2 (the UTC date is Oct 3).
    const evening = makeInvoice({ ...INV, billed_at: '2026-10-03T00:30:00+00:00', sent_to_customer_at: '2026-10-03T00:30:10+00:00' })
    renderWithProviders(<LienInstrumentsModal {...baseProps} invoice={evening} job={job({ invoices: [evening] })} />)
    await settle()
    await waitFor(() => expect(document.querySelector('[data-demand-statement]')).toBeTruthy())
    expect((document.querySelector('[data-demand-statement]') as HTMLElement).textContent).toContain('#1 — sent October 2, 2026')
    expect((document.querySelector('[data-demand-enclosed]') as HTMLElement).textContent).toContain('Exhibit A · Invoice #1, as sent October 2, 2026')
    await waitFor(() => expect(screen.getByText('October 2, 2026 — Invoice sent')).toBeTruthy())
  })

  it('a bill addressed to the customer is demanded of the customer, with no notice pointer', async () => {
    renderWithProviders(<LienInstrumentsModal {...baseProps} job={job({ gc_customer_id: null, gcCustomer: null, bill_to_party: 'customer' })} />)
    await waitFor(() => expect(screen.getByText(/the customer on the job/)).toBeTruthy())
    const debtor = document.querySelector('[data-demand-debtor]') as HTMLElement
    expect(debtor.textContent).toContain('Rizvi Syed Zulfiqar & Kizilbash Quratulain Fatima')
    expect(debtor.textContent).not.toContain('§ 53.056')
  })

  it("a stop's title on the timeline opens the window on what that stop sends; Esc closes it alone (v2.4793)", async () => {
    renderWithProviders(<LienInstrumentsModal {...baseProps} job={job()} />)
    await waitFor(() => expect(document.querySelector('[data-lien-window-timeline] [data-lien-timeline-stop-door]')).toBeTruthy())
    const door = document.querySelector('[data-lien-window-timeline] [data-lien-timeline-stop-door="affidavit"]') as HTMLButtonElement
    fireEvent.click(door)
    expect(screen.getByTestId('lien-stop-paper')).toBeTruthy()
    expect(screen.getByTestId('lien-stop-paper-title').textContent).toBe('The lien affidavit')
    // Nothing filed yet: the act opens the Affidavit tab here.
    expect(screen.getByTestId('lien-stop-paper-act').textContent).toBe('Open the Affidavit tab ›')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('lien-stop-paper')).toBeNull()
    expect(document.querySelector('[data-lien-window-timeline]')).toBeTruthy()
  })
})
