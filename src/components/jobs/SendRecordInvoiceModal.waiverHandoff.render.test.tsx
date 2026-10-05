// @vitest-environment jsdom
/**
 * Render smoke for v2.4603: the waiver follows the bill only when the tick was drawn and
 * left on. Bill Customer opened on a GC job draws no tick, so the send hands nothing off.
 * Opened on one of the job's bills it draws the tick, and unticking sends the bill alone.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { makeInvoice, makeJob, renderWithProviders, SMOKE_AUTH_USER_ID } from '../../test/renderSmokeMocks'
import SendRecordInvoiceModal from './SendRecordInvoiceModal'

const ENSURE_RPC = 'ensure_single_ready_to_bill_invoice_for_job'

const calls = vi.hoisted(() => ({ rpc: [] as string[], writes: [] as string[] }))

const draft = makeInvoice({ id: 'inv-draft', job_id: 'job-978', amount: 2630, is_primary_rtb_bundle: true })
const detailJob = makeJob({
  id: 'job-978',
  hcp_number: '978',
  status: 'ready_to_bill',
  revenue: 2630,
  payments_made: 0,
  customer_id: 'cust-1',
  customer_name: 'Knight Contracting',
  customer_email: 'ap@knight.test',
  gc_customer_id: 'gc-1',
  invoices: [draft],
})

const JOB = { id: 'job-978', master_user_id: SMOKE_AUTH_USER_ID, hcp_number: '978', click_number: null, job_name: 'Pondhill demo', customer_id: 'cust-1', customer_name: 'Knight Contracting', customer_email: 'ap@knight.test' }

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

async function saveHouseCallPro(onClose: () => void) {
  fireEvent.click(screen.getByRole('button', { name: 'Show more billing options' }))
  fireEvent.click(screen.getByRole('button', { name: 'HouseCall Pro' }))
  const save = screen.getByRole('button', { name: 'Save' })
  await waitFor(() => expect((save as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(save)
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
}

/** The tick is seeded on once the job's details land. */
async function tickOn(): Promise<HTMLInputElement> {
  const tick = (await screen.findByTestId('bill-customer-waiver-tick')).querySelector('input') as HTMLInputElement
  await waitFor(() => expect(tick.checked).toBe(true))
  return tick
}

describe('SendRecordInvoiceModal · the lien waiver follows the tick', () => {
  it('opened on a GC job: no tick is drawn, and the send hands nothing off', async () => {
    const onClose = vi.fn()
    const onSentWantWaiver = vi.fn()
    renderWithProviders(
      <SendRecordInvoiceModal payload={{ kind: 'job', job: JOB }} onClose={onClose} onSuccess={async () => {}} onSentWantWaiver={onSentWantWaiver} jobUpdating={false} invoiceUpdating={false} />,
    )
    await screen.findByText('Lien releases')
    expect(screen.queryByTestId('bill-customer-waiver-tick')).toBeNull()
    await saveHouseCallPro(onClose)
    expect(onSentWantWaiver).not.toHaveBeenCalled()
  })

  it('opened on one bill of a GC job: the tick is on, and the send hands the bill to the waiver window', async () => {
    const onClose = vi.fn()
    const onSentWantWaiver = vi.fn()
    renderWithProviders(
      <SendRecordInvoiceModal payload={{ kind: 'invoice', job: JOB, invoice: draft }} onClose={onClose} onSuccess={async () => {}} onSentWantWaiver={onSentWantWaiver} jobUpdating={false} invoiceUpdating={false} />,
    )
    await tickOn()
    await saveHouseCallPro(onClose)
    expect(onSentWantWaiver).toHaveBeenCalledWith('job-978', 'inv-draft')
  })

  it('unticked: the bill goes alone', async () => {
    const onClose = vi.fn()
    const onSentWantWaiver = vi.fn()
    renderWithProviders(
      <SendRecordInvoiceModal payload={{ kind: 'invoice', job: JOB, invoice: draft }} onClose={onClose} onSuccess={async () => {}} onSentWantWaiver={onSentWantWaiver} jobUpdating={false} invoiceUpdating={false} />,
    )
    const tick = await tickOn()
    fireEvent.click(tick)
    expect(tick.checked).toBe(false)
    await saveHouseCallPro(onClose)
    expect(onSentWantWaiver).not.toHaveBeenCalled()
  })
})
