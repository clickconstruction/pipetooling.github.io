// @vitest-environment jsdom
/**
 * Render smoke for the Job window's in kind strip (punch list #301): whose arrangement it reads.
 *
 * The strip is about this job's bill, so it reads whoever the bill goes to (v2.6946, the owner's call). On a job
 * billed to its GC that is the GC, as Bill Customer already read it. Before, the strip read the job's customer, so
 * it could offer to put a GC-billed job on the customer's arrangement while Bill Customer asked nothing.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

import { JobWindowModal } from './JobWindowModal'
import { UpdateFocusOpenerBridgeProvider } from '../../contexts/UpdateFocusOpenerBridgeContext'
import { makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { InKindStanding } from '../../lib/inKind/inKindChip'
import { JOB_PICK_DEAL_PRESS, JOB_PUT_ON_DEAL_PRESS } from '../../lib/inKind/inKindChip'
import type { JobWithDetails } from '../../types/jobWithDetails'

const HOME = 'cust-home'
const GC = 'cust-gc'

const state = vi.hoisted(() => ({
  job: null as unknown,
  standings: new Map<string, unknown>(),
}))

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

vi.mock('../../lib/fetchJobWithDetailsById', () => ({
  fetchJobWithDetailsById: async () => state.job,
}))

vi.mock('../../hooks/useInKindStandings', () => ({
  useInKindStandings: () => state.standings,
}))

vi.mock('../projects/ProjectsJobHistoryTab', () => ({ ProjectsJobHistoryTab: () => null }))
vi.mock('./JobHistoryLienTimeline', () => ({ default: () => null }))
vi.mock('./JobWindowDocumentsTab', () => ({ JobWindowDocumentsTab: () => null }))

beforeAll(() => {
  vi.stubGlobal('scrollTo', vi.fn())
})

const standing = (customerId: string, arrangementIds: string[]): InKindStanding => ({ customerId, arrangementIds, left: 500, ahead: 0, paidInKind: 0, dueMonth: null, dueCount: 0 })

/** A job for Randy Vargo whose bills go to its GC, Done Right Foundation. */
const gcBilledJob = (): JobWithDetails =>
  ({
    ...makeJob({ id: 'job-1', hcp_number: '1117', job_name: 'Vargo Pretest', status: 'ready_to_bill', customer_id: HOME, customer_name: 'Randy Vargo' }),
    gc_customer_id: GC,
    bill_to_party: 'gc',
    gcCustomer: { id: GC, name: 'Done Right Foundation' },
  }) as JobWithDetails

async function openWindow(job: JobWithDetails) {
  state.job = job
  renderWithProviders(
    <UpdateFocusOpenerBridgeProvider>
      <JobWindowModal
        jobId={job.id}
        initialTab="job"
        onClose={() => {}}
        authRole="dev"
        scheduleContext={null}
        assignedJobsRows={[]}
        initialJob={job}
        billingCustomerHighlightInitial={false}
        fixturesSectionHighlightInitial={false}
        jobPicturesLinkHighlightInitial={false}
        alsoOpenCreateCustomerModal={false}
        onSaved={null}
      />
    </UpdateFocusOpenerBridgeProvider>,
  )
  await settle()
}

beforeEach(() => {
  state.standings = new Map()
})

describe('JobWindowModal — the in kind strip reads whoever the bill goes to (v2.6946)', () => {
  it('on a job billed to its GC, the GC’s arrangement shows the strip, in the GC’s name', async () => {
    state.standings = new Map([[GC, standing(GC, ['deal-gc'])]])
    await openWindow(gcBilledJob())
    const strip = screen.getByTestId('job-in-kind-strip')
    expect(strip.textContent).toContain('Done Right Foundation pays in kind.')
    expect(strip.textContent).not.toContain('Randy Vargo')
    expect(screen.getByRole('button', { name: JOB_PUT_ON_DEAL_PRESS })).toBeTruthy()
  })

  it('on a job billed to its GC, the customer’s own arrangement shows no strip: the customer does not owe this bill', async () => {
    state.standings = new Map([[HOME, standing(HOME, ['deal-home'])]])
    await openWindow(gcBilledJob())
    expect(screen.queryByTestId('job-in-kind-strip')).toBeNull()
  })

  it('with two arrangements on the GC, the strip opens the GC’s page, not the customer’s', async () => {
    state.standings = new Map([[GC, standing(GC, ['deal-a', 'deal-b'])]])
    await openWindow(gcBilledJob())
    expect(screen.getByRole('link', { name: JOB_PICK_DEAL_PRESS }).getAttribute('href')).toBe(`/customers/${GC}`)
  })

  it('on a job billed to its customer, nothing changes: the customer’s arrangement shows the strip', async () => {
    state.standings = new Map([[HOME, standing(HOME, ['deal-home'])]])
    await openWindow(makeJob({ id: 'job-2', hcp_number: '995', job_name: 'Shop repipe', status: 'ready_to_bill', customer_id: HOME, customer_name: 'Calloway Holdings' }))
    expect(screen.getByTestId('job-in-kind-strip').textContent).toContain('Calloway Holdings pays in kind.')
  })
})
