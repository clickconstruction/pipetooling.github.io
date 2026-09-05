// @vitest-environment jsdom
/**
 * Render smoke for Bill Customer's write-after-confirm contract (v2.2876,
 * journey-map decision 17): opening the modal for a job writes NOTHING — no
 * ensure RPC, no jobs_ledger_invoices write — and a commit (here the
 * HouseCall Pro "Save") runs `ensure_single_ready_to_bill_invoice_for_job`
 * exactly once, immediately before its own write. The remainder math the
 * preview shows lives in src/lib/billing/proposedPrimaryRtbAmount.test.ts.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
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
  customer_name: 'Knight Contracting',
  customer_email: 'ap@knight.test',
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
            job_name: 'Pondhill demo',
            customer_id: 'cust-1',
            customer_name: 'Knight Contracting',
            customer_email: 'ap@knight.test',
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
})
