// @vitest-environment jsdom
/**
 * Render smoke for Bill Customer's write-after-confirm contract (v2.2885,
 * journey-map decision 17): opening the modal for a job writes NOTHING — no
 * ensure RPC, no jobs_ledger_invoices write — and a commit (here the
 * HouseCall Pro "Save") runs `ensure_single_ready_to_bill_invoice_for_job`
 * exactly once, immediately before its own write. The remainder math the
 * preview shows lives in src/lib/billing/proposedPrimaryRtbAmount.test.ts.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { makeInvoice, makeJob, renderWithProviders, SMOKE_AUTH_USER_ID } from '../../test/renderSmokeMocks'
import SendRecordInvoiceModal from './SendRecordInvoiceModal'

const ENSURE_RPC = 'ensure_single_ready_to_bill_invoice_for_job'

const calls = vi.hoisted(() => ({ rpc: [] as string[], writes: [] as string[] }))

const detailJob = makeJob({
  id: 'job-978',
  hcp_number: '978',
  status: 'ready_to_bill',
  revenue: 3630,
  payments_made: 0,
  customer_id: 'cust-1',
  customer_name: 'Kestrin Contracting',
  customer_email: 'ap@kestrin.test',
  // One $1,000 partial already carved off and no primary yet: the RPC would
  // INSERT a $2,630 primary — the plan must show that number without inserting.
  invoices: [makeInvoice({ id: 'partial-1', job_id: 'job-978', amount: 1000, is_primary_rtb_bundle: false })],
})

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as Record<string, unknown>
  const baseFrom = stub.from as (table: string) => Record<string, unknown>
  stub.from = (table: string) => {
    const b = baseFrom(table)
    for (const m of ['insert', 'update', 'upsert', 'delete'] as const) {
      const orig = b[m] as () => unknown
      b[m] = () => {
        calls.writes.push(`${table}.${m}`)
        return orig()
      }
    }
    return b
  }
  stub.rpc = (fn: string) => {
    calls.rpc.push(fn)
    if (fn === ENSURE_RPC) {
      return Promise.resolve({
        data: { ok: true, invoice_id: 'inv-primary', amount: 2630, created: true },
        error: null,
      })
    }
    return Promise.resolve({ data: null, error: null })
  }
  return { supabase: stub }
})

vi.mock('../../lib/fetchJobWithDetailsById', () => ({
  fetchJobWithDetailsById: async () => detailJob,
}))

// The text face's reads (punch list #343, PR 2) have their own kernel tests; here the window is handed what they return.
const textFaceReads = vi.hoisted(() => ({ calls: 0 }))
vi.mock('../../lib/billing/billCustomerFacesIo', () => ({
  loadBillTextFace: async () => {
    textFaceReads.calls += 1
    return {
      job: { customerId: 'cust-1', customerName: 'Kestrin Contracting', jobName: 'Penmoor demo', jobAddress: '12 Penmoor Ln', lang: 'en' },
      lines: [],
      textsOn: true,
      me: 'Rosa Alvarez',
      contact: { numbers: [{ channelId: 'ch-1', value: '5125550142', stopped: false }], lines: [] },
    }
  },
}))

// The owner-of-record line (v2.3450) has its own render smoke; here only its mount point is checked.
vi.mock('./BillCustomerOwnerLine', () => ({
  default: ({ jobId }: { jobId: string }) => <div data-testid="owner-line-marker" data-job={jobId} />,
}))

vi.mock('../../lib/promoteJobToBilledIfFullyInvoiced', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  maybePromoteJobToBilledAfterCustomerInvoice: async () => ({ ok: true }),
}))

// jsdom has no matchMedia; responsive children may ask for it.
beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
})

function ensureCalls(): number {
  return calls.rpc.filter((fn) => fn === ENSURE_RPC).length
}

describe('SendRecordInvoiceModal — write after confirm (kind:job)', () => {
  it('opening writes nothing; the plan shows the remainder; HouseCall Pro Save runs the ensure RPC exactly once', async () => {
    const onSuccess = vi.fn(async () => {})
    const onClose = vi.fn()
    const onAfterEnsureSuccess = vi.fn()

    renderWithProviders(
      <SendRecordInvoiceModal
        payload={{
          kind: 'job',
          job: {
            id: 'job-978',
            master_user_id: SMOKE_AUTH_USER_ID,
            hcp_number: '978',
            click_number: null,
            job_name: 'Penmoor demo',
            customer_id: 'cust-1',
            customer_name: 'Kestrin Contracting',
            customer_email: 'ap@kestrin.test',
          },
        }}
        onClose={onClose}
        onSuccess={onSuccess}
        onAfterEnsureSuccess={onAfterEnsureSuccess}
        jobUpdating={false}
        invoiceUpdating={false}
      />,
    )

    // The header carries the client-side plan: revenue 3,630 − the $1,000 partial.
    await waitFor(() => {
      expect(screen.getByText(/RTB \$2,630\.00/)).toBeTruthy()
    })
    expect(ensureCalls()).toBe(0)
    expect(calls.writes.filter((w) => w.startsWith('jobs_ledger_invoices.'))).toEqual([])
    expect(onAfterEnsureSuccess).not.toHaveBeenCalled()

    // Reveal HouseCall Pro (behind the caret) and record the bill.
    fireEvent.click(screen.getByRole('button', { name: 'Show more billing options' }))
    fireEvent.click(screen.getByRole('button', { name: 'HouseCall Pro' }))
    const save = screen.getByRole('button', { name: 'Save' })
    await waitFor(() => {
      expect((save as HTMLButtonElement).disabled).toBe(false)
    })
    expect(ensureCalls()).toBe(0)

    fireEvent.click(save)

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })
    expect(ensureCalls()).toBe(1)
    expect(onAfterEnsureSuccess).toHaveBeenCalledTimes(1)
    expect(onSuccess).toHaveBeenCalledTimes(1)
    // The commit's own write follows the ensure, on the row it returned.
    expect(calls.writes.filter((w) => w === 'jobs_ledger_invoices.update')).toHaveLength(1)
  })

  it('the Send-to block carries the owner-of-record line for the open job (v2.3450; the line itself is BillCustomerOwnerLine.render.test.tsx)', async () => {
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
      expect(screen.getByText('Send to')).toBeTruthy()
    })
    expect(screen.getByTestId('owner-line-marker').getAttribute('data-job')).toBe('job-978')
  })

  it('saving the missing email in the banner keeps the bill amount: Make the Stripe bill gets past both checks (v2.4880)', async () => {
    calls.writes = []
    renderWithProviders(
      <SendRecordInvoiceModal
        payload={{
          kind: 'job',
          job: { id: 'job-978', master_user_id: SMOKE_AUTH_USER_ID, hcp_number: '978', click_number: null, job_name: 'Penmoor demo', customer_id: 'cust-1', customer_name: 'Kestrin Contracting', customer_email: null },
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
    const banner = screen.getByRole('group', { name: 'Customer email missing' })
    fireEvent.change(within(banner).getByRole('textbox', { name: 'Customer email' }), { target: { value: 'ap@kestrin.test' } })
    fireEvent.click(within(banner).getByRole('button', { name: 'Save' }))
    // The saved email overlays the job and stays: the banner goes and does not come back.
    await waitFor(() => {
      expect(screen.queryByRole('group', { name: 'Customer email missing' })).toBeNull()
    })
    expect(calls.writes).toContain('jobs_ledger.update')
    fireEvent.click(screen.getByRole('button', { name: 'Make the Stripe bill' }))
    // Past the amount and email checks, the stub's missing session is the first thing to stop it.
    await waitFor(() => {
      expect(screen.getByText('Not signed in')).toBeTruthy()
    })
    expect(screen.queryByText('Enter a valid bill amount greater than 0')).toBeNull()
  })

  it('says what the customer will get before either press (punch list #343)', async () => {
    renderWithProviders(
      <SendRecordInvoiceModal
        payload={{
          kind: 'job',
          job: { id: 'job-978', master_user_id: SMOKE_AUTH_USER_ID, hcp_number: '978', click_number: null, job_name: 'Penmoor demo', customer_id: 'cust-1', customer_name: 'Kestrin Contracting', customer_email: 'ap@kestrin.test', customer_phone: '5125550142' },
        }}
        onClose={() => {}}
        onSuccess={async () => {}}
        jobUpdating={false}
        invoiceUpdating={false}
      />,
    )
    await waitFor(() => {
      expect(screen.getByText('Send to')).toBeTruthy()
    })
    // The Stripe tab: the channel's caption, who is billed with their phone, and a press that says nothing goes yet.
    expect(screen.getByTestId('bill-customer-channel-caption').textContent).toBe('An email with a Pay now button. They pay by card or bank on Stripe’s page.')
    expect(screen.getByTestId('bill-customer-send-to-name').textContent?.trim()).toBe('Kestrin Contracting')
    expect(screen.getByTestId('bill-customer-send-to-phone').textContent).toBe('Phone (512) 555-0142. A text can follow on the next screen.')
    const stripeBox = screen.getByTestId('bill-customer-press-box')
    expect(within(stripeBox).getByText('When you press Make the Stripe bill')).toBeTruthy()
    expect(within(stripeBox).getByText('Nothing goes to Kestrin Contracting yet. The next screen sends it by email or by text.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Make the Stripe bill' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Create Stripe invoice' })).toBeNull()

    // The Physical tab: no pay link, one email now, and the press names who it goes to.
    fireEvent.click(screen.getByRole('button', { name: 'Physical invoice' }))
    await waitFor(() => {
      expect(screen.getByTestId('bill-customer-channel-caption').textContent).toBe('An email with the invoice PDF attached. It has no pay link.')
    })
    const physicalBox = screen.getByTestId('bill-customer-press-box')
    expect(within(physicalBox).getByText('One email goes now to ap@kestrin.test. The invoice PDF is attached.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Email the invoice to Kestrin' })).toBeTruthy()
    expect(screen.queryByTestId('bill-customer-send-to-phone')).toBeNull()
  })

  it('draws the bill, the email and the text as three faces, and reads the text only when its face is opened (punch list #343, PR 2)', async () => {
    textFaceReads.calls = 0
    const ensuresBefore = ensureCalls()
    renderWithProviders(
      <SendRecordInvoiceModal
        payload={{
          kind: 'job',
          job: { id: 'job-978', master_user_id: SMOKE_AUTH_USER_ID, hcp_number: '978', click_number: null, job_name: 'Penmoor demo', customer_id: 'cust-1', customer_name: 'Kestrin Contracting', customer_email: 'ap@kestrin.test', job_address: '12 Penmoor Ln, Kyle, TX' },
        }}
        onClose={() => {}}
        onSuccess={async () => {}}
        jobUpdating={false}
        invoiceUpdating={false}
      />,
    )
    await waitFor(() => {
      expect(screen.getByText('What Kestrin Contracting will get')).toBeTruthy()
    })
    // The bill is the face it opens on, under its own name, and nothing has been read for the text.
    expect(screen.getByTestId('bill-customer-faces').getAttribute('data-face')).toBe('bill')
    expect(screen.getByText('On the bill:')).toBeTruthy()
    expect(textFaceReads.calls).toBe(0)

    // The email: the send's own subject and message, for the plan's $2,630.00.
    fireEvent.click(screen.getByRole('tab', { name: 'The email' }))
    await waitFor(() => {
      expect(screen.getByTestId('bill-customer-face-email-subject').textContent).toBe('Subject: Invoice from Click Plumbing and Electrical')
    })
    const frame = screen.getByTestId('bill-customer-face-email-frame')
    expect(frame.getAttribute('srcdoc')).toContain('$2,630.00')
    expect(frame.getAttribute('srcdoc')).toContain('Pay now')
    expect(frame.getAttribute('srcdoc')).toContain('12 Penmoor Ln, Kyle, TX')
    expect(textFaceReads.calls).toBe(0)

    // The text: read once, on the first look, and filled for this bill.
    fireEvent.click(screen.getByRole('tab', { name: 'The text' }))
    await waitFor(() => {
      expect(screen.getByTestId('bill-customer-face-text-words').textContent).toBe(
        'Hi Kestrin, this is Rosa with Click Plumbing. Your bill for Penmoor demo is ready, $2,630.00. Text me here with any question. Pay it here: https://my.clickplumbing.com/pay/sample',
      )
    })
    expect(screen.getByText('Text to (512) 555-0142')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'The bill' }))
    fireEvent.click(screen.getByRole('tab', { name: 'The text' }))
    expect(textFaceReads.calls).toBe(1)
    // Looking wrote nothing.
    expect(ensureCalls()).toBe(ensuresBefore)
  })
})
