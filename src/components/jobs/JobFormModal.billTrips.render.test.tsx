// @vitest-environment jsdom
/**
 * Extra trips on the Bill tab: the Job window draws the trips strip under Line Items on a job that is in a
 * development, for the roles that read every trip, and nowhere else. A line the strip adds is read into the form and
 * ticked, so Bill the 1 picked is one more press. Heron Point Clubhouse, made up. The strip itself is stood in for:
 * its own tests are `JobBillTrips.render.test.tsx`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'

const db = vi.hoisted(() => ({ job: null as unknown, role: 'assistant' as string, strip: [] as Array<Record<string, unknown>> }))

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  const made = useAuthModuleMock({ role: 'assistant' })
  return { ...made, useAuth: () => ({ ...made.useAuth(), role: db.role }) }
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/fetchJobWithDetailsById', () => ({ fetchJobWithDetailsById: async () => db.job }))
vi.mock('../trips/JobBillTrips', () => ({
  JobBillTrips: (props: Record<string, unknown> & { onLineAdded: (id: string) => Promise<void> }) => {
    db.strip.push(props)
    return (
      <button type="button" data-testid="strip-adds-a-line" onClick={() => void props.onLineAdded('f-trip')}>
        strip
      </button>
    )
  },
}))

import { makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import JobFormModal from './JobFormModal'

afterEach(() => {
  cleanup()
  db.strip = []
  db.role = 'assistant'
})

const line = (id: string, name: string, price: number, seq: number) => ({ id, job_id: 'job-hp', name, count: 1, line_unit_price: price, line_description: null, invoice_id: null, sequence_order: seq, line_kind: 'work', stage_kind: 'any', shared_with_gc: false })
const clubhouse = (over: Record<string, unknown> = {}, withTrip = false) =>
  makeJob({
    id: 'job-hp',
    hcp_number: '2101',
    job_name: 'Heron Point Clubhouse',
    status: 'working',
    revenue: withTrip ? 190_800 : 184_000,
    development_id: 'd1',
    fixtures: [line('f-bid', 'Bid price', 184_000, 0), ...(withTrip ? [line('f-trip', 'Trip 3, crew of 2, Nov 9 to 11', 6_800, 1)] : [])],
    invoices: [],
    ...over,
  })

async function open(over: { job?: unknown; region?: 'bill' | null } = {}) {
  db.job = over.job ?? clubhouse()
  renderWithProviders(
    <JobFormModal mode="edit" editJobId="job-hp" initialJob={null} billingCustomerHighlightInitial={false} fixturesSectionHighlightInitial={false} jobPicturesLinkHighlightInitial={false} alsoOpenCreateCustomerModal={false} embeddedRegion={over.region === undefined ? 'bill' : over.region} onClose={vi.fn()} onSaved={null} />,
  )
  await settle()
  await screen.findByDisplayValue('Bid price')
}

describe('Extra trips on the Job window’s Bill tab', () => {
  it('draws the strip under Line Items on a job in a development, with the job, the site and the role', async () => {
    await open()
    const strip = await screen.findByTestId('strip-adds-a-line')
    expect(strip.closest('[data-job-form-lines]')).not.toBeNull()
    const props = db.strip[db.strip.length - 1]
    expect(props).toMatchObject({ developmentId: 'd1', role: 'assistant' })
    expect(props?.job).toMatchObject({ id: 'job-hp', name: 'Heron Point Clubhouse' })
    expect(String((props?.job as { label: string }).label)).toContain('2101')
  })

  it('draws none on a job with no development, for a role that does not read every trip, or outside the Job window', async () => {
    await open({ job: clubhouse({ development_id: null }) })
    expect(screen.queryByTestId('strip-adds-a-line')).toBeNull()
    cleanup()
    db.role = 'estimator'
    await open()
    expect(screen.queryByTestId('strip-adds-a-line')).toBeNull()
    cleanup()
    db.role = 'assistant'
    await open({ region: null })
    expect(screen.queryByTestId('strip-adds-a-line')).toBeNull()
  })

  it('reads a line the strip added and ticks it, so Bill the 1 picked names its dollars', async () => {
    await open()
    expect(screen.queryByDisplayValue('Trip 3, crew of 2, Nov 9 to 11')).toBeNull()
    // The press added the line in the database; the form is told its id and reads the job again.
    db.job = clubhouse({}, true)
    fireEvent.click(screen.getByTestId('strip-adds-a-line'))
    await screen.findByDisplayValue('Trip 3, crew of 2, Nov 9 to 11')
    const card = await screen.findByTestId('money-card')
    await waitFor(() => expect((within(card).getAllByRole('checkbox') as HTMLInputElement[]).filter((c) => c.checked).map((c) => c.getAttribute('aria-label'))).toEqual(['Pick ◆ Trip 3, crew of 2, Nov 9 to 11 for a bill']))
    expect(within(card).getByTestId('bill-picked').textContent).toContain('Bill the 1 picked')
    expect(within(card).getByTestId('bill-picked').textContent).toContain('6,800')
  })
})
