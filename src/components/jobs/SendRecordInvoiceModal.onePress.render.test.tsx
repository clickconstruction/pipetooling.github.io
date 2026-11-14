// @vitest-environment jsdom
/**
 * Bill Customer's one press (punch list #343, PR 3). *Make the bill and email Kestrin* makes the Stripe bill and then
 * makes the same send as Send Email invoice, once; *Make the bill, send later* makes the bill and sends nothing; and a
 * send that fails leaves the bill made, with the reason on the made-bill screen. The send itself is
 * `lib/billing/sendStripeBillEmail.ts`, exercised through the Send Email invoice button's own smokes.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { makeInvoice, makeJob, renderWithProviders, SMOKE_AUTH_USER_ID } from '../../test/renderSmokeMocks'
import SendRecordInvoiceModal from './SendRecordInvoiceModal'

const ENSURE_RPC = 'ensure_single_ready_to_bill_invoice_for_job'

const walk = vi.hoisted(() => ({
  made: false,
  invoked: [] as string[],
  sends: [] as string[],
  sendAnswer: { ok: true, line: 'Bill email sent to ap@kestrin.test.', copiesHint: '', copiesFailed: null } as { ok: true; line: string; copiesHint: string; copiesFailed: string | null } | { ok: false; error: string },
}))

const detailJob = makeJob({
  id: 'job-978',
  hcp_number: '978',
  status: 'ready_to_bill',
  revenue: 3630,
  payments_made: 0,
  customer_id: 'cust-1',
  customer_name: 'Kestrin Contracting',
  customer_email: 'ap@kestrin.test',
  invoices: [makeInvoice({ id: 'partial-1', job_id: 'job-978', amount: 1000, is_primary_rtb_bundle: false })],
})

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as Record<string, unknown>
  stub.rpc = (fn: string) => Promise.resolve(fn === ENSURE_RPC ? { data: { ok: true, invoice_id: 'inv-primary', amount: 2630, created: true }, error: null } : { data: null, error: null })
  stub.auth = { ...(stub.auth as object), getSession: () => Promise.resolve({ data: { session: { access_token: 'jwt' } }, error: null }) }
  stub.functions = {
    invoke: (name: string) => {
      walk.invoked.push(name)
      if (name === 'create-stripe-invoice') {
        walk.made = true
        return Promise.resolve({ data: { success: true, stripe_invoice_id: 'in_1', hosted_invoice_url: 'https://invoice.stripe.test/i/1', stripe_invoice_status: 'open' }, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    },
  }
  return { supabase: stub }
})

// After the bill is made the job reads back with its new billed row, so the window opens the made-bill screen on it.
vi.mock('../../lib/fetchJobWithDetailsById', () => ({
  fetchJobWithDetailsById: async () =>
    walk.made
      ? { ...detailJob, invoices: [...(detailJob.invoices ?? []), makeInvoice({ id: 'inv-primary', job_id: 'job-978', amount: 2630, status: 'billed', stripe_invoice_id: 'in_1', hosted_invoice_url: 'https://invoice.stripe.test/i/1' })] }
      : detailJob,
}))

vi.mock('../../lib/promoteJobToBilledIfFullyInvoiced', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  maybePromoteJobToBilledAfterCustomerInvoice: async () => ({ ok: true }),
}))

vi.mock('../../lib/billing/sendStripeBillEmail', () => ({
  sendStripeBillEmail: async (invoiceId: string) => {
    walk.sends.push(invoiceId)
    return walk.sendAnswer
  },
  rememberBillEmailSent: () => {},
}))

// The made-bill panel has its own smokes; here only what the window hands it is read.
vi.mock('./HostedStripeBillPanel', () => ({
  HostedStripeBillPanel: ({ justMade, justMadeLead }: { justMade?: boolean; justMadeLead?: string }) => <div data-testid="made-bill-panel" data-just-made={String(Boolean(justMade))} data-lead={justMadeLead ?? ''} />,
}))
vi.mock('./BillCustomerOwnerLine', () => ({ default: () => null }))

beforeAll(() => {
  window.matchMedia = ((query: string) => ({ matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
})

beforeEach(() => {
  walk.made = false
  walk.invoked = []
  walk.sends = []
  walk.sendAnswer = { ok: true, line: 'Bill email sent to ap@kestrin.test.', copiesHint: '', copiesFailed: null }
})

async function open() {
  renderWithProviders(
    <SendRecordInvoiceModal
      payload={{
        kind: 'job',
        job: { id: 'job-978', master_user_id: SMOKE_AUTH_USER_ID, hcp_number: '978', click_number: null, job_name: 'Penmoor demo', customer_id: 'cust-1', customer_name: 'Kestrin Contracting', customer_email: 'ap@kestrin.test' },
      }}
      onClose={() => {}}
      onSuccess={async () => {}}
      jobUpdating={false}
      invoiceUpdating={false}
    />,
  )
  await waitFor(() => {
    expect(screen.getByText(/RTB \$2,630\.00/)).toBeTruthy()
  })
  // The amount reaches the bill a tick after the header: wait for the bill's own total before pressing.
  await waitFor(() => {
    expect(screen.getAllByText('$2,630.00').length).toBeGreaterThan(0)
  })
}

const creates = () => walk.invoked.filter((n) => n === 'create-stripe-invoice').length

describe('SendRecordInvoiceModal — one press makes the bill and emails it (punch list #343, PR 3)', () => {
  it('the box says the email goes now, and names the quiet press beside it', async () => {
    await open()
    const box = screen.getByTestId('bill-customer-press-box')
    expect(box.textContent).toContain('When you press Make the bill and email Kestrin')
    expect(box.textContent).toContain('The bill email goes now to ap@kestrin.test.')
    expect(box.textContent).toContain('Make the bill, send later makes the bill and sends nothing.')
    // Opening made nothing and sent nothing.
    expect(creates()).toBe(0)
    expect(walk.sends).toEqual([])
  })

  it('Make the bill and email: one bill, one send on that bill, and the made-bill screen leads with the send’s line', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Make the bill and email Kestrin' }))
    await waitFor(() => {
      expect(screen.getByTestId('made-bill-panel')).toBeTruthy()
    })
    expect(creates()).toBe(1)
    expect(walk.sends).toEqual(['inv-primary'])
    const line = screen.getByTestId('bill-customer-made-email')
    expect(line.getAttribute('data-kind')).toBe('sent')
    expect(line.textContent).toBe('Bill email sent to ap@kestrin.test.')
    expect(screen.getByTestId('made-bill-panel').getAttribute('data-lead')).toBe('Bill email sent to ap@kestrin.test.')
  })

  it('Make the bill, send later: the bill is made and nothing is sent', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Make the bill, send later' }))
    await waitFor(() => {
      expect(screen.getByTestId('made-bill-panel')).toBeTruthy()
    })
    expect(creates()).toBe(1)
    expect(walk.sends).toEqual([])
    expect(screen.queryByTestId('bill-customer-made-email')).toBeNull()
    // The panel keeps its own lead: nothing has gone to the customer yet.
    expect(screen.getByTestId('made-bill-panel').getAttribute('data-lead')).toBe('')
  })

  it('a send that fails leaves the bill made and says the email did not go, with the reason', async () => {
    walk.sendAnswer = { ok: false, error: 'The address bounced.' }
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Make the bill and email Kestrin' }))
    await waitFor(() => {
      expect(screen.getByTestId('made-bill-panel')).toBeTruthy()
    })
    expect(creates()).toBe(1)
    const line = screen.getByTestId('bill-customer-made-email')
    expect(line.getAttribute('data-kind')).toBe('failed')
    expect(line.textContent).toBe('The bill is made. The bill email did not go: The address bounced. Press Send Email invoice below to send it.')
    expect(screen.getByTestId('made-bill-panel').getAttribute('data-lead')).toBe('')
  })
})
