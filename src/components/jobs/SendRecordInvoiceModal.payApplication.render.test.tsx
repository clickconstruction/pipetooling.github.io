// @vitest-environment jsdom
/**
 * Render smoke for v2.5032 (the owner's call of 2026-10-09): on a job with saved pay applications,
 * Bill Customer says which application the bill is. The match pre-picks it, the office may change it
 * or choose none, and a successful send ties the two. A tie that fails says so and never undoes the
 * send. Only the roles that can write the applications see the line.
 */
import type { ReactNode } from 'react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { makeInvoice, makeJob, renderWithProviders, SMOKE_AUTH_USER_ID } from '../../test/renderSmokeMocks'
import SendRecordInvoiceModal from './SendRecordInvoiceModal'
import type { SavedPayApplication } from '../../lib/aiaPayApplications'

const auth = vi.hoisted(() => ({ role: 'dev' }))
const io = vi.hoisted(() => ({ apps: [] as SavedPayApplication[], loads: 0, tieFails: false }))
const tieSpy = vi.hoisted(() => vi.fn())

const draft = makeInvoice({ id: 'inv-draft', job_id: 'job-978', amount: 2630, is_primary_rtb_bundle: true })
const detailJob = makeJob({ id: 'job-978', hcp_number: '978', status: 'ready_to_bill', revenue: 2630, payments_made: 0, customer_id: 'cust-1', customer_name: 'Knight Contracting', customer_email: 'ap@knight.test', invoices: [draft] })
const JOB = { id: 'job-978', master_user_id: SMOKE_AUTH_USER_ID, hcp_number: '978', click_number: null, job_name: 'Pondhill demo', customer_id: 'cust-1', customer_name: 'Knight Contracting', customer_email: 'ap@knight.test' }

const app = (o: Partial<SavedPayApplication> & Pick<SavedPayApplication, 'id' | 'applicationNumber'>): SavedPayApplication =>
  ({ jobId: 'job-978', periodTo: '2026-09-30', applicationDate: '2026-10-01', currentPaymentDue: 1000, deletedAt: null, invoiceId: null, ...o }) as SavedPayApplication

vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../../test/renderSmokeMocks')
  const values: Record<string, unknown> = {}
  const value = () => (values[auth.role] ??= makeUseAuthValue({ role: auth.role }))
  return { useAuth: value, useOptionalAuth: value, AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</> }
})

vi.mock('../../lib/aiaPayApplicationsIo', () => ({
  loadPayApplications: () => {
    io.loads += 1
    return Promise.resolve(io.apps)
  },
  tiePayApplicationBill: (appId: string, invoiceId: string | null) => {
    tieSpy(appId, invoiceId)
    return io.tieFails ? Promise.reject(new Error('Another application on this job is already tied to that bill.')) : Promise.resolve()
  },
}))

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as Record<string, unknown>
  stub.rpc = () => Promise.resolve({ data: null, error: null })
  return { supabase: stub }
})

vi.mock('../../lib/fetchJobWithDetailsById', () => ({ fetchJobWithDetailsById: async () => detailJob }))
vi.mock('./BillCustomerOwnerLine', () => ({ default: () => <div data-testid="owner-line-marker" /> }))
vi.mock('../../lib/promoteJobToBilledIfFullyInvoiced', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  maybePromoteJobToBilledAfterCustomerInvoice: async () => ({ ok: true }),
}))

beforeAll(() => {
  window.matchMedia = ((query: string) => ({ matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
})

beforeEach(() => {
  auth.role = 'dev'
  io.apps = [app({ id: 'app-2', applicationNumber: 2, currentPaymentDue: 1800 }), app({ id: 'app-3', applicationNumber: 3, currentPaymentDue: 2630 }), app({ id: 'app-1', applicationNumber: 1, invoiceId: 'inv-old' })]
  io.loads = 0
  io.tieFails = false
  tieSpy.mockClear()
})

const open = (onClose: () => void) =>
  renderWithProviders(<SendRecordInvoiceModal payload={{ kind: 'invoice', job: JOB, invoice: draft }} onClose={onClose} onSuccess={async () => {}} jobUpdating={false} invoiceUpdating={false} />)

async function saveHouseCallPro(onClose: () => void) {
  fireEvent.click(screen.getByRole('button', { name: 'Show more billing options' }))
  fireEvent.click(screen.getByRole('button', { name: 'HouseCall Pro' }))
  const save = screen.getByRole('button', { name: 'Save' })
  await waitFor(() => expect((save as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(save)
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
}

describe('SendRecordInvoiceModal · which pay application this bill is (v2.5032)', () => {
  it('pre-picks the untied application whose payment due is the bill, and the send ties them', async () => {
    const onClose = vi.fn()
    open(onClose)
    const pick = (await screen.findByLabelText('This bill is pay application')) as HTMLSelectElement
    await waitFor(() => expect(pick.value).toBe('app-3'))
    expect([...pick.options].map((o) => o.textContent)).toEqual(['none', 'No. 3 · $2,630.00 due · period to Sep 30', 'No. 2 · $1,800.00 due · period to Sep 30'])
    expect(screen.getByTestId('bill-customer-pay-app').textContent).toContain('Its payment due is this amount, to the cent.')
    await saveHouseCallPro(onClose)
    expect(tieSpy).toHaveBeenCalledWith('app-3', 'inv-draft')
  })

  it('the office may choose another, or none', async () => {
    const onClose = vi.fn()
    open(onClose)
    const pick = (await screen.findByLabelText('This bill is pay application')) as HTMLSelectElement
    await waitFor(() => expect(pick.value).toBe('app-3'))
    fireEvent.change(pick, { target: { value: '' } })
    await saveHouseCallPro(onClose)
    expect(tieSpy).not.toHaveBeenCalled()
  })

  it('a tie that fails says so, and the bill still went', async () => {
    io.tieFails = true
    const onClose = vi.fn()
    open(onClose)
    const pick = (await screen.findByLabelText('This bill is pay application')) as HTMLSelectElement
    await waitFor(() => expect(pick.value).toBe('app-3'))
    await saveHouseCallPro(onClose)
    expect(tieSpy).toHaveBeenCalledWith('app-3', 'inv-draft')
    expect(await screen.findByText(/The bill went\. Tying it to pay application 3 did not: Another application on this job is already tied to that bill\./)).toBeTruthy()
  })

  it('a role that cannot write the applications sees no line, and nothing is read', async () => {
    auth.role = 'primary'
    open(vi.fn())
    await screen.findByText('Lien releases')
    expect(screen.queryByTestId('bill-customer-pay-app')).toBeNull()
    expect(io.loads).toBe(0)
  })

  it('no line on a job with nothing left to tie', async () => {
    io.apps = [app({ id: 'app-1', applicationNumber: 1, invoiceId: 'inv-old' })]
    open(vi.fn())
    await screen.findByText('Lien releases')
    await waitFor(() => expect(io.loads).toBe(1))
    expect(screen.queryByTestId('bill-customer-pay-app')).toBeNull()
  })
})
