// @vitest-environment jsdom
/**
 * Bill Customer's RTB as the row's bar and rows (punch list #217, jobs-pipeline-4, a prototype):
 * the header reads *RTB $X* as today with the switch off; with it on, the Pipeline row's bar sits
 * under the header with this bill as its next segment and the sum as rows, the open bills
 * unfolding to each bill with its day; a dev with `?sbs=1` sees both one above the other.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '../../contexts/ToastContext'
import { ConfirmDialogProvider } from '../../contexts/ConfirmDialogContext'
import { makeInvoice, makeJob, SMOKE_AUTH_USER_ID } from '../../test/renderSmokeMocks'
import SendRecordInvoiceModal, { BILL_CUSTOMER_RTB_SHAPE_KEY } from './SendRecordInvoiceModal'
import { shapeViewStorageKey } from '../prototypes/SideBySide'

const detailJob = makeJob({
  id: 'job-978',
  hcp_number: '978',
  status: 'ready_to_bill',
  revenue: 3630,
  payments_made: 0,
  customer_id: 'cust-1',
  customer_name: 'Knight Contracting',
  customer_email: 'ap@knight.test',
  // One $1,000 bill already out and no primary yet: the plan is a $2,630 primary.
  invoices: [makeInvoice({ id: 'bill-1', job_id: 'job-978', amount: 1000, status: 'billed', billed_at: '2026-09-12T15:00:00Z', is_primary_rtb_bundle: false })],
  payments: [],
})

const auth = vi.hoisted(() => ({ role: 'dev' as string }))
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../../test/renderSmokeMocks')
  return {
    useAuth: () => makeUseAuthValue({ role: auth.role }),
    useOptionalAuth: () => makeUseAuthValue({ role: auth.role }),
    AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  }
})

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

vi.mock('../../lib/fetchJobWithDetailsById', () => ({
  fetchJobWithDetailsById: async () => detailJob,
}))

vi.mock('./BillCustomerOwnerLine', () => ({
  default: ({ jobId }: { jobId: string }) => <div data-testid="owner-line-marker" data-job={jobId} />,
}))

vi.mock('../../lib/promoteJobToBilledIfFullyInvoiced', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  maybePromoteJobToBilledAfterCustomerInvoice: async () => ({ ok: true }),
}))

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

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  auth.role = 'dev'
})

function mount(path = '/jobs?tab=stages') {
  return render(
    <ToastProvider>
      <ConfirmDialogProvider>
        <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
            onClose={() => {}}
            onSuccess={async () => {}}
            jobUpdating={false}
            invoiceUpdating={false}
          />
        </MemoryRouter>
      </ConfirmDialogProvider>
    </ToastProvider>,
  )
}

describe('SendRecordInvoiceModal — the RTB as the row’s bar and rows', () => {
  it('reads RTB $X as today with the switch off', async () => {
    mount()
    await waitFor(() => expect(screen.getByText(/RTB \$2,630\.00/)).toBeTruthy())
    expect(screen.queryByTestId('bill-customer-rtb-parts')).toBeNull()
    expect(screen.getByRole('button', { name: 'Show the bars' })).toBeTruthy()
  })

  it('draws the bar and the rows once the switch is on, remembered for the person; the open bills unfold', async () => {
    mount()
    await waitFor(() => expect(screen.getByText(/RTB \$2,630\.00/)).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Show the bars' }))
    expect(window.localStorage.getItem(shapeViewStorageKey(BILL_CUSTOMER_RTB_SHAPE_KEY, SMOKE_AUTH_USER_ID))).toBe('1')
    const parts = await screen.findByTestId('bill-customer-rtb-parts')
    expect(screen.queryByText(/RTB \$2,630\.00/)).toBeNull()
    expect(within(parts).getByTitle('$1,000.00 on 1 open bill, still unpaid')).toBeTruthy()
    expect(within(parts).getByTitle('This bill, $2,630.00')).toBeTruthy()
    expect(within(parts).getByText('this bill is the rest')).toBeTruthy()
    const row = (kind: string) => within(parts.querySelector(`[data-rtb-row="${kind}"]`) as HTMLElement)
    expect(row('bid').getByText('Bid')).toBeTruthy()
    expect(row('bid').getByText('$3,630.00')).toBeTruthy()
    expect(row('paid').getByText('Paid · 0 payments')).toBeTruthy()
    expect(row('open').getByText('Open bills · 1')).toBeTruthy()
    expect(row('this').getByText('This bill')).toBeTruthy()
    expect(row('this').getByText('$2,630.00')).toBeTruthy()
    expect((row('bid').getByTitle('Open Edit tab in a new tab') as HTMLAnchorElement).getAttribute('href')).toBe('/jobs?tab=stages&edit=job-978')
    expect((row('paid').getByTitle('Open Payments in a new tab') as HTMLAnchorElement).getAttribute('href')).toBe('/jobs?tab=stages&edit=job-978&editFocus=payments')
    fireEvent.click(row('open').getByRole('button', { name: '▾ unfold' }))
    expect(row('open').getByText(/^Bill 1 · Sep 12 · \d+ d$/)).toBeTruthy()
    expect(row('open').getAllByText('$1,000.00')).toHaveLength(2)
  })

  it('a dev with ?sbs=1 sees today over the bars, with no switch', async () => {
    mount('/jobs?tab=stages&sbs=1')
    const both = await screen.findByTestId('bill-customer-side-by-side')
    await waitFor(() => expect(within(both).getByText(/RTB \$2,630\.00/)).toBeTruthy())
    expect(within(both).getByText('Today')).toBeTruthy()
    expect(within(both).getByText('With the bars')).toBeTruthy()
    expect(within(both).getByTestId('bill-customer-rtb-parts')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Show the bars' })).toBeNull()
  })

  it('?sbs=1 does nothing for anyone but a dev', async () => {
    auth.role = 'assistant'
    mount('/jobs?tab=stages&sbs=1')
    await waitFor(() => expect(screen.getByText(/RTB \$2,630\.00/)).toBeTruthy())
    expect(screen.queryByTestId('bill-customer-side-by-side')).toBeNull()
  })
})
