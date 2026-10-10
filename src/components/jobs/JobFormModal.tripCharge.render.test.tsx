// @vitest-environment jsdom
/**
 * Edit Job keeps a turnaway trip charge in the job's total (v2.5129). Hawthorne: the $1,200 rough-in is billed on
 * bill 1, the $800 final is not billed yet, and a $99 trip charge (client not home) is on its own bill, which
 * `create_turnaway_trip_charge` made, raising the job's revenue to $2,099. The bill carries the trip charge as its
 * rider, a `fee_lines` entry that names it.
 *
 * A money edit in Edit Job rewrites the job's revenue from its line items and its riders. Until the trip charge was
 * one of them, the first edit wrote the $99 away while its bill kept it. The reads are stand-ins; the writes to
 * `jobs_ledger` are recorded.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

const db = vi.hoisted(() => ({ jobWrites: [] as Array<Record<string, unknown>>, job: null as unknown }))

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'dev' })
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as unknown as Record<string, unknown> & { from: (table: string) => Record<string, unknown> }
  const stubFrom = stub.from.bind(stub)
  return {
    supabase: {
      ...stub,
      from: (table: string) => {
        const b = stubFrom(table)
        if (table === 'jobs_ledger') {
          const update = b.update as (payload: unknown) => unknown
          b.update = (payload: Record<string, unknown>) => {
            db.jobWrites.push(payload)
            return update(payload)
          }
        }
        return b
      },
    },
  }
})
vi.mock('../../lib/fetchJobWithDetailsById', () => ({ fetchJobWithDetailsById: async () => db.job }))

import { makeInvoice, makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import JobFormModal from './JobFormModal'

const TRIP = { trip_charge: 'client_not_home', amount: 99 }
const line = (id: string, name: string, price: number, seq: number, invoiceId: string | null) => ({
  id,
  job_id: 'job-hw',
  name,
  count: 1,
  line_unit_price: price,
  line_description: null,
  invoice_id: invoiceId,
  sequence_order: seq,
  line_kind: 'work',
  stage_kind: null,
  shared_with_gc: false,
})

function hawthorne() {
  return makeJob({
    id: 'job-hw',
    hcp_number: '912',
    job_name: 'Hawthorne',
    status: 'working',
    revenue: 2_099,
    fixtures: [line('f-rough', 'Rough-in', 1_200, 0, 'inv-912'), line('f-final', 'Final', 800, 1, null)],
    invoices: [
      makeInvoice({ id: 'inv-912', job_id: 'job-hw', amount: 1_200, status: 'billed', sequence_order: 0, billed_at: '2026-10-01T15:00:00Z' }),
      makeInvoice({ id: 'inv-trip', job_id: 'job-hw', amount: 99, status: 'ready_to_bill', sequence_order: 1, is_primary_rtb_bundle: false, stripe_invoice_memo: 'Trip charge — client not home', fee_lines: [TRIP] }),
    ],
  })
}

const revenueWrites = () => db.jobWrites.filter((w) => 'revenue' in w).map((w) => w.revenue)

async function openHawthorne(onClose: () => void) {
  db.job = hawthorne()
  db.jobWrites = []
  renderWithProviders(
    <JobFormModal mode="edit" editJobId="job-hw" initialJob={null} billingCustomerHighlightInitial={false} fixturesSectionHighlightInitial={false} jobPicturesLinkHighlightInitial={false} alsoOpenCreateCustomerModal={false} onClose={onClose} onSaved={null} />,
  )
  await settle()
  await screen.findByDisplayValue('Final')
}

describe("Edit Job keeps a turnaway trip charge in the job's total (v2.5129)", () => {
  it('a money edit writes the line items and the trip charge as the revenue', async () => {
    const onClose = vi.fn()
    await openHawthorne(onClose)
    // The final line goes to 2: $1,200 + $1,600 + the $99 trip charge.
    const counts = screen.getAllByRole('spinbutton', { name: 'Count' }).filter((el) => !(el as HTMLInputElement).disabled)
    expect(counts).toHaveLength(1)
    fireEvent.change(counts[0]!, { target: { value: '2' } })
    await settle()
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(revenueWrites()).toEqual([2_899])
  })

  it('the Job Total counts the trip charge as a rider before anything is saved', async () => {
    await openHawthorne(vi.fn())
    expect(await screen.findByRole('button', { name: 'Job Total: $2,099.00 ($2,000.00 work + $99.00 riders)' })).toBeTruthy()
    expect(db.jobWrites).toEqual([])
  })

  it('the Final line reads not billed: the $99 is the trip charge bill’s own, not money covering Final', async () => {
    await openHawthorne(vi.fn())
    const card = await screen.findByTestId('money-card')
    expect(within(card).queryByText(/covered/)).toBeNull()
    expect(within(card).getByText(/not billed/)).toBeTruthy()
  })
})
