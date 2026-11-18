// @vitest-environment jsdom
/**
 * The Job window opened with lines already picked (punch list #391). Putting a trip on a bill adds one line to
 * the job and opens the job on Bill with that line picked, so Bill the 1 picked is one more press. Heron Point
 * Clubhouse: a bid price not billed, a trip's line not billed, and a rough-in line already on a bill.
 *
 * The form clears its ticks when a job loads, so the asked lines are ticked once the job is in. A line that
 * cannot be ticked by hand (on a bill, or gone) is skipped without a word. Opening picks lines and saves nothing.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'

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

const line = (id: string, name: string, price: number, seq: number, invoiceId: string | null) => ({
  id,
  job_id: 'job-hp',
  name,
  count: 1,
  line_unit_price: price,
  line_description: null,
  invoice_id: invoiceId,
  sequence_order: seq,
  line_kind: 'work',
  stage_kind: 'any',
  shared_with_gc: false,
})

function clubhouse() {
  return makeJob({
    id: 'job-hp',
    hcp_number: '2101',
    job_name: 'Heron Point Clubhouse',
    status: 'working',
    revenue: 192_000,
    fixtures: [line('f-rough', 'Rough-in', 1_200, 0, 'inv-1'), line('f-bid', 'Bid price', 184_000, 1, null), line('f-trip', 'Trip 14, crew of 4, Nov 2 to 8', 6_800, 2, null)],
    invoices: [makeInvoice({ id: 'inv-1', job_id: 'job-hp', amount: 1_200, status: 'billed', sequence_order: 0, billed_at: '2026-10-01T15:00:00Z' })],
  })
}

async function open(pickLineIds: string[] | null) {
  db.job = clubhouse()
  db.jobWrites = []
  renderWithProviders(
    <JobFormModal mode="edit" editJobId="job-hp" initialJob={null} billingCustomerHighlightInitial={false} fixturesSectionHighlightInitial={false} jobPicturesLinkHighlightInitial={false} pickLineIdsInitial={pickLineIds} alsoOpenCreateCustomerModal={false} onClose={vi.fn()} onSaved={null} />,
  )
  await settle()
  await screen.findByDisplayValue('Bid price')
  return screen.findByTestId('money-card')
}
const ticked = (card: HTMLElement): string[] =>
  (within(card).getAllByRole('checkbox') as HTMLInputElement[]).filter((c) => c.checked).map((c) => c.getAttribute('aria-label') ?? '')

describe('the Job window opened with lines already picked (punch list #391)', () => {
  it('ticks the trip’s line once the job is in, and Bill the 1 picked names its dollars', async () => {
    const card = await open(['f-trip'])
    expect(ticked(card)).toEqual(['Pick ◆ Trip 14, crew of 4, Nov 2 to 8 for a bill'])
    expect(within(card).getByTestId('bill-picked').textContent).toContain('Bill the 1 picked')
    expect(within(card).getByTestId('bill-picked').textContent).toContain('6,800')
    expect(db.jobWrites).toEqual([])
  })

  it('skips a line that is already on a bill and one that is not on the job, without a word', async () => {
    const card = await open(['f-rough', 'f-gone'])
    expect(ticked(card)).toEqual([])
    expect(within(card).queryByTestId('bill-picked')).toBeNull()
    expect(db.jobWrites).toEqual([])
  })

  it('ticks nothing when no line is asked for, as before', async () => {
    const card = await open(null)
    expect(ticked(card)).toEqual([])
    expect(within(card).queryByTestId('bill-picked')).toBeNull()
  })
})
