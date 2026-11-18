// @vitest-environment jsdom
/**
 * The Job window says its trips (punch list #379, PR 6). This holds the pane's wiring: it asks for a job's
 * trips for the office door only, with the job's development and address; a job a trip names draws the line
 * under its address on the Job tab; a clock line in the feed wears the tag it was handed; and a job with no
 * trip draws nothing new. The hook and the job's read are stood in. Every name here is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, within } from '@testing-library/react'
import type { JobTripsState } from '../../hooks/useJobTrips'

const db = vi.hoisted(() => ({ job: null as unknown }))
const asked = vi.hoisted(() => ({ calls: [] as Array<{ jobId: string | null; developmentId: string | null; address: string | null; enabled: boolean }>, state: null as unknown }))

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'dev' })
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/fetchJobWithDetailsById', () => ({ fetchJobWithDetailsById: async () => db.job }))
vi.mock('../../lib/fetchClockSessionsForJobLedger', () => ({
  fetchClockSessionsForJobLedger: async () => ({ data: [{ id: 'cs-1', user_id: 'u-luis', clocked_in_at: '2026-11-03T13:00:00Z', clocked_out_at: '2026-11-03T23:30:00Z', work_date: '2026-11-03', notes: 'Pumps hooked up at the lift station', approved_at: '2026-11-04T00:00:00Z', rejected_at: null, users: { name: 'Luis' } }], error: null }),
  fetchApprovedClosedClockSessionsForJobLedger: async () => ({ data: [], error: null, truncated: false }),
}))
vi.mock('../../hooks/useJobTrips', () => ({
  useJobTrips: (args: { jobId: string | null; developmentId: string | null; address: string | null; enabled: boolean }) => {
    asked.calls.push({ jobId: args.jobId, developmentId: args.developmentId, address: args.address, enabled: args.enabled })
    return asked.state
  },
}))

import DetailJobModal from './DetailJobModal'
import { UpdateFocusOpenerBridgeProvider } from '../../contexts/UpdateFocusOpenerBridgeContext'
import { makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'

afterEach(() => {
  cleanup()
  asked.calls.length = 0
})

const none: JobTripsState = { records: [], line: null, hours: null, hoursState: 'reading', noSitePoint: false, clockTags: new Map(), roster: null, save: async () => undefined }
const withTrips: JobTripsState = {
  ...none,
  line: { gone: 3, count: '3 trips', last: 'last Oct 23 to Nov 4, Luis, Priya', next: 'next Dec 1 to 5', words: '3 trips · last Oct 23 to Nov 4, Luis, Priya · next Dec 1 to 5' },
  hours: { site: 84, road: 18, ready: 6, noPlace: 9, home: 42, all: 159, notAtSite: 75 },
  hoursState: 'read',
  clockTags: new Map([['cs:cs-1', { bucket: 'site', words: 'TRIP · AT THE SITE', quiet: false }]]),
  roster: [],
}
const job = (over: Record<string, unknown> = {}) => makeJob({ id: 'job-1', hcp_number: '2101', job_name: 'ZZ Test Rough-in', job_address: '12 Marsh Road, Tidewater, NC', development_id: 'dev-zz', development: { id: 'dev-zz', name: 'ZZ Test Heron Point' }, ...over })

function pane(over: { authRole?: string; paneBodyHidden?: boolean } = {}) {
  return (
    <UpdateFocusOpenerBridgeProvider>
      <DetailJobModal open paneMode paneBodyHidden={over.paneBodyHidden ?? false} onClose={() => {}} jobId="job-1" authRole={over.authRole ?? 'dev'} assignedJobsRows={[]} scheduleContext={null} />
    </UpdateFocusOpenerBridgeProvider>
  )
}
const last = () => asked.calls[asked.calls.length - 1]

describe('DetailJobModal · trips on this job', () => {
  it('asks for the job’s trips for the office door, with its development and its address', async () => {
    db.job = job()
    asked.state = none
    renderWithProviders(pane())
    await settle()
    await screen.findByRole('heading', { name: /ZZ Test Rough-in/ })
    expect(last()).toEqual({ jobId: 'job-1', developmentId: 'dev-zz', address: '12 Marsh Road, Tidewater, NC', enabled: true })
    // No trip names the job: nothing new is drawn.
    expect(screen.queryByTestId('job-trips-line')).toBeNull()
    expect(screen.queryByTestId('trip-clock-tag')).toBeNull()
  })

  it('hands a job with no development no development, and a reader outside the office door a closed door', async () => {
    db.job = job({ development_id: null, development: null })
    asked.state = none
    renderWithProviders(pane())
    await settle()
    await screen.findByRole('heading', { name: /ZZ Test Rough-in/ })
    expect(last()).toMatchObject({ developmentId: null, enabled: true })
    cleanup()
    asked.calls.length = 0
    renderWithProviders(pane({ authRole: 'estimator' }))
    await settle()
    expect(asked.calls.length).toBeGreaterThan(0)
    expect(asked.calls.every((c) => !c.enabled)).toBe(true)
  })

  it('draws the line under the address on a job a trip names, and the feed’s clock line wears its tag', async () => {
    db.job = job()
    asked.state = withTrips
    renderWithProviders(pane())
    await settle()
    const line = await screen.findByTestId('job-trips-line')
    expect(within(line).getByTestId('job-trips-words').textContent).toBe('3 trips · last Oct 23 to Nov 4, Luis, Priya · next Dec 1 to 5')
    expect(within(line).getByTestId('job-trips-hours-site').textContent).toBe('At the site 84 h')
    expect(within(line).getByRole('button', { name: 'Open the site’s trips' })).toBeTruthy()
    expect(within(line).getByRole('button', { name: '+ Trip' })).toBeTruthy()
    const tag = await screen.findByTestId('trip-clock-tag')
    expect(tag.textContent).toBe('TRIP · AT THE SITE')
    expect(tag.closest('li')?.textContent).toContain('Luis')
  })

  it('keeps the line to the Job tab', async () => {
    db.job = job()
    asked.state = withTrips
    renderWithProviders(pane({ paneBodyHidden: true }))
    await settle()
    const line = await screen.findByTestId('job-trips-line')
    expect(line.parentElement?.style.display).toBe('none')
  })
})
