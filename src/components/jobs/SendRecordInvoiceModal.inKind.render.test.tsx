// @vitest-environment jsdom
/**
 * Render smoke for Bill Customer's in kind question (punch list #301), on a job that is off the deal.
 *
 * With one open deal the In kind answer records the bill on it. With two (v2.6934) the window cannot know which
 * deal pays: before, it asked nothing and opened as an ordinary money window. Now it asks, and In kind holds every
 * send and record press and opens the customer's page, where a person picks the deal. Nothing is written here.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { makeJob, renderWithProviders, SMOKE_AUTH_USER_ID } from '../../test/renderSmokeMocks'
import type { InKindStanding } from '../../lib/inKind/inKindChip'
import { BILL_IN_KIND_CHOICE_MANY, BILL_IN_KIND_RECORD_PRESS, JOB_PICK_DEAL_PRESS, billPickDealWords } from '../../lib/inKind/inKindChip'
import SendRecordInvoiceModal from './SendRecordInvoiceModal'

const state = vi.hoisted(() => ({
  dealIds: ['deal-a', 'deal-b'] as string[],
  added: [] as Array<[string, string]>,
  writes: [] as string[],
  rpc: [] as string[],
}))

const detailJob = makeJob({
  id: 'job-978',
  hcp_number: '978',
  status: 'ready_to_bill',
  revenue: 3630,
  payments_made: 0,
  customer_id: 'cust-1',
  customer_name: 'Calloway Holdings',
  customer_email: 'ap@calloway.test',
  invoices: [],
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
        state.writes.push(`${table}.${m}`)
        return orig()
      }
    }
    return b
  }
  stub.rpc = (fn: string) => {
    state.rpc.push(fn)
    return Promise.resolve({ data: null, error: null })
  }
  return { supabase: stub }
})

vi.mock('../../lib/fetchJobWithDetailsById', () => ({
  fetchJobWithDetailsById: async () => detailJob,
}))

vi.mock('./BillCustomerOwnerLine', () => ({ default: () => null }))

// The customer's standing: its open deals, read fresh each render so a test can set how many there are.
vi.mock('../../hooks/useInKindStandings', () => ({
  useInKindStandings: (): ReadonlyMap<string, InKindStanding> =>
    new Map([['cust-1', { customerId: 'cust-1', arrangementIds: state.dealIds, left: 500, ahead: 0, paidInKind: 0, dueMonth: null, dueCount: 0 }]]),
}))

vi.mock('../../lib/inKind/inKindStandingIo', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  addJobToInKindArrangement: async (arrangementId: string, jobId: string) => {
    state.added.push([arrangementId, jobId])
  },
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

beforeEach(() => {
  state.dealIds = ['deal-a', 'deal-b']
  state.added.length = 0
  state.writes.length = 0
  state.rpc.length = 0
})

function open(onClose: () => void = () => {}) {
  return renderWithProviders(
    <SendRecordInvoiceModal
      payload={{
        kind: 'job',
        job: { id: 'job-978', master_user_id: SMOKE_AUTH_USER_ID, hcp_number: '978', click_number: null, job_name: 'Shop repipe', customer_id: 'cust-1', customer_name: 'Calloway Holdings', customer_email: 'ap@calloway.test' },
      }}
      onClose={onClose}
      onSuccess={async () => {}}
      jobUpdating={false}
      invoiceUpdating={false}
    />,
  )
}

/** The HouseCall Pro channel's press, the one a record goes through. */
async function revealRecordPress(): Promise<HTMLButtonElement> {
  fireEvent.click(screen.getByRole('button', { name: 'Show more billing options' }))
  fireEvent.click(screen.getByRole('button', { name: 'HouseCall Pro' }))
  return (await screen.findByRole('button', { name: 'Save' })) as HTMLButtonElement
}

describe('SendRecordInvoiceModal — a customer with two open in kind deals (v2.6934)', () => {
  it('asks how the bill is paid, and In kind holds the window and opens the customer’s page', async () => {
    const onClose = vi.fn()
    open(onClose)
    // The question is asked. Before v2.6934 two deals asked nothing.
    const question = await screen.findByTestId('in-kind-bill-question')
    expect(question.textContent).toContain('Calloway Holdings pays in kind. How is this bill paid?')
    expect(question.textContent).toContain(BILL_IN_KIND_CHOICE_MANY.title)
    expect(screen.queryByTestId('in-kind-bill-pick-deal')).toBeNull()

    // Unanswered: the record press is dead.
    const save = await revealRecordPress()
    expect(save.disabled).toBe(true)

    // In kind: the window says where the deal is picked, links there, and still records nothing.
    fireEvent.click(screen.getByTestId('in-kind-bill-in_kind'))
    const pick = await screen.findByTestId('in-kind-bill-pick-deal')
    expect(pick.textContent).toContain(billPickDealWords('Calloway Holdings').lead)
    const link = screen.getByRole('link', { name: JOB_PICK_DEAL_PRESS })
    expect(link.getAttribute('href')).toBe('/customers/cust-1')
    expect(save.disabled).toBe(true)
    // It is not the one-deal path: no in kind channel note, no Record the bill in kind press, the channels stay.
    expect(screen.queryByTestId('bill-in-kind-channel-note')).toBeNull()
    expect(screen.queryByRole('button', { name: BILL_IN_KIND_RECORD_PRESS })).toBeNull()
    expect(screen.getByRole('button', { name: 'Stripe bill' })).toBeTruthy()

    // Leaving for the customer's page closes the window behind the person.
    fireEvent.click(link)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(state.added).toEqual([])
    expect(state.writes).toEqual([])
  })

  it('With money lets the bill go out as any other, on no deal', async () => {
    open()
    await screen.findByTestId('in-kind-bill-question')
    const save = await revealRecordPress()
    expect(save.disabled).toBe(true)
    fireEvent.click(screen.getByTestId('in-kind-bill-in_kind'))
    fireEvent.click(screen.getByTestId('in-kind-bill-money'))
    expect(screen.queryByTestId('in-kind-bill-pick-deal')).toBeNull()
    await waitFor(() => {
      expect(save.disabled).toBe(false)
    })
    // The person's channel is left alone, and no job was put on a deal.
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
    expect(state.added).toEqual([])
  })
})

describe('SendRecordInvoiceModal — a customer with one open in kind deal', () => {
  it('In kind still goes to the record-only channel, with no trip to the customer’s page', async () => {
    state.dealIds = ['deal-a']
    open()
    await screen.findByTestId('in-kind-bill-question')
    fireEvent.click(screen.getByTestId('in-kind-bill-in_kind'))
    expect(await screen.findByTestId('bill-in-kind-channel-note')).toBeTruthy()
    expect(screen.queryByTestId('in-kind-bill-pick-deal')).toBeNull()
    expect(screen.queryByRole('link', { name: JOB_PICK_DEAL_PRESS })).toBeNull()
    const record = (await screen.findByRole('button', { name: BILL_IN_KIND_RECORD_PRESS })) as HTMLButtonElement
    await waitFor(() => {
      expect(record.disabled).toBe(false)
    })
  })
})
