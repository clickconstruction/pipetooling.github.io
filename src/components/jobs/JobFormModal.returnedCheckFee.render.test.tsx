// @vitest-environment jsdom
/**
 * Edit Job keeps a returned check's fee in the job's total. Southern Post's shape, as v2.5033's tests drew it:
 * bill 1 is the $13,680 rough-in, and the $30 returned check fee went on it (`add_ar_return_case_fee`), so the
 * bill reads $13,710 and the job's revenue grew by $30 with it. The final line, $2,000, is not billed yet.
 *
 * A money edit in Edit Job rewrites the job's revenue from its line items and its riders. Until the fee was one
 * of the riders, the first edit wrote the $30 away while the bill kept it. The reads are stand-ins; the writes
 * to `jobs_ledger` are recorded.
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

const FEE_LINE = { description: 'Returned check fee (Tex. Bus. & Com. Code § 3.506)', amount: 30, case_id: 'mtx-sp', added_at: '2026-10-09T15:00:00Z' }
const line = (id: string, name: string, price: number, seq: number, invoiceId: string | null) => ({
  id,
  job_id: 'job-sp',
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

function southernPost() {
  return makeJob({
    id: 'job-sp',
    hcp_number: '878',
    job_name: 'Southern Post',
    status: 'working',
    revenue: 15_710,
    fixtures: [line('f-rough', 'Rough-in', 13_680, 0, 'inv-878'), line('f-final', 'Final', 2_000, 1, null)],
    invoices: [makeInvoice({ id: 'inv-878', job_id: 'job-sp', amount: 13_710, status: 'billed', sequence_order: 0, billed_at: '2026-10-01T15:00:00Z', fee_lines: [FEE_LINE] })],
  })
}

const revenueWrites = () => db.jobWrites.filter((w) => 'revenue' in w).map((w) => w.revenue)

async function openSouthernPost(onClose: () => void) {
  db.job = southernPost()
  db.jobWrites = []
  renderWithProviders(
    <JobFormModal mode="edit" editJobId="job-sp" initialJob={null} billingCustomerHighlightInitial={false} fixturesSectionHighlightInitial={false} jobPicturesLinkHighlightInitial={false} alsoOpenCreateCustomerModal={false} onClose={onClose} onSaved={null} />,
  )
  await settle()
  await screen.findByDisplayValue('Final')
}

describe("Edit Job keeps a returned check's $30 fee in the job's total", () => {
  it('a money edit writes the line items and the fee on bill 1 as the revenue', async () => {
    const onClose = vi.fn()
    await openSouthernPost(onClose)
    // The final line goes to 2: $13,680 + $4,000 + the $30 fee.
    const counts = screen.getAllByRole('spinbutton', { name: 'Count' }).filter((el) => !(el as HTMLInputElement).disabled)
    expect(counts).toHaveLength(1)
    fireEvent.change(counts[0]!, { target: { value: '2' } })
    await settle()
    // Escape closes through the guarded close, which saves the billing slice now.
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(revenueWrites()).toEqual([17_710])
  })

  it('the Job Total counts the fee as a rider before anything is saved', async () => {
    await openSouthernPost(vi.fn())
    expect(await screen.findByRole('button', { name: 'Job Total: $15,710.00 ($15,680.00 work + $30.00 riders)' })).toBeTruthy()
    expect(db.jobWrites).toEqual([])
  })

  it('the Bill tab’s riders block stays the hazmat fees it names: the check fee is already on bill 1', async () => {
    await openSouthernPost(vi.fn())
    const card = await screen.findByTestId('money-card')
    expect(within(card).getByText('Final')).toBeTruthy()
    expect(within(card).queryByText('Riders (hazmat fees)')).toBeNull()
  })
})
