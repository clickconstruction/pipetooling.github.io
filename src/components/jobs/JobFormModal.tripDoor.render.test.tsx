// @vitest-environment jsdom
/**
 * The Job window's door back from a trip's line to its trip (punch list #391, PR 4). Heron Point Clubhouse holds
 * a bid price and a line that came from Trip 14. The form reads that trip's number and site, draws *Open Trip 14 ›*
 * under the line, and the press closes the window as any close does and then opens the trip on its site's page.
 * A job with no trip's line reads no trip and draws no door.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

const db = vi.hoisted(() => ({ job: null as unknown, tripReads: [] as string[][], went: [] as string[] }))

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'dev' })
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/fetchJobWithDetailsById', () => ({ fetchJobWithDetailsById: async () => db.job }))
vi.mock('../../lib/trips/tripBillLineIo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/trips/tripBillLineIo')>()),
  readLineTrips: async (ids: ReadonlyArray<string>) => {
    db.tripReads.push([...ids])
    return [{ id: 't-14', tripNumber: 14, developmentId: 'dev-hp' }].filter((t) => ids.includes(t.id))
  },
}))
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => (to: string) => {
    db.went.push(to)
  },
}))

import { makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import JobFormModal from './JobFormModal'

const line = (id: string, name: string, price: number, seq: number, tripId: string | null) => ({
  id,
  job_id: 'job-hp',
  name,
  count: 1,
  line_unit_price: price,
  line_description: null,
  invoice_id: null,
  sequence_order: seq,
  line_kind: 'work',
  stage_kind: 'any',
  shared_with_gc: false,
  trip_id: tripId,
})

async function open(withTripLine: boolean) {
  db.tripReads = []
  db.went = []
  db.job = makeJob({
    id: 'job-hp',
    hcp_number: '2101',
    job_name: 'Heron Point Clubhouse',
    status: 'working',
    revenue: withTripLine ? 190_800 : 184_000,
    fixtures: [line('f-bid', 'Bid price', 184_000, 0, null), ...(withTripLine ? [line('f-trip', 'Trip 14, crew of 4, Nov 2 to 8', 6_800, 1, 't-14')] : [])],
  })
  const onClose = vi.fn()
  renderWithProviders(
    <JobFormModal mode="edit" editJobId="job-hp" initialJob={null} billingCustomerHighlightInitial={false} fixturesSectionHighlightInitial={false} jobPicturesLinkHighlightInitial={false} alsoOpenCreateCustomerModal={false} onClose={onClose} onSaved={null} />,
  )
  await settle()
  await screen.findByDisplayValue('Bid price')
  return { onClose }
}

describe('the Job window’s door back from a trip’s line (punch list #391, PR 4)', () => {
  it('draws Open Trip 14 under the trip’s line, and the press closes the window and opens the trip', async () => {
    const { onClose } = await open(true)
    const door = await screen.findByRole('button', { name: 'Open Trip 14 ›' })
    expect(screen.getAllByTestId('line-trip-door')).toHaveLength(1)
    expect(db.tripReads).toEqual([['t-14']])
    fireEvent.click(door)
    await waitFor(() => expect(db.went).toEqual(['/developments/dev-hp?trip=t-14']))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('a job with no trip’s line reads no trip and draws no door', async () => {
    await open(false)
    expect(screen.queryByTestId('line-trip-door')).toBeNull()
    expect(db.tripReads).toEqual([])
  })
})
