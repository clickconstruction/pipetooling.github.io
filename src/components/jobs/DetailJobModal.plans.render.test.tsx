// @vitest-environment jsdom
/**
 * The crew's job window carries the Plans section (punch list #276): a helper opening a job reads *Building from*
 * with its Open ↗ and has **Add our as-built**, never **+ New set**, and the old *Open plans* row is gone while a part
 * is read; on a job with no part the section says the office adds the set and the *Open plans* row on the job's own
 * link stays. The plans io is a fake; made-up names only.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'

import DetailJobModal from './DetailJobModal'
import { UpdateFocusOpenerBridgeProvider } from '../../contexts/UpdateFocusOpenerBridgeContext'
import type { PlanPartRow, PlanSetRow } from '../../lib/plans/planSets'
import type { JobPlansIo, JobPlansRead } from '../../lib/plans/planSetsIo'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
// A helper: the plain window, through the limited read (the stub's ledger row is null, so the assigned row carries the job).
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'helpers', profileName: 'Luis Ortega' })
})
/** What the plans io answers for the job: set per test before the window opens. */
const plans = vi.hoisted(() => ({ read: null as JobPlansRead | null }))
vi.mock('../../lib/plans/planSetsIo', async () => {
  const actual = await vi.importActual<typeof import('../../lib/plans/planSetsIo')>('../../lib/plans/planSetsIo')
  const never = async (): Promise<never> => {
    throw new Error('not pressed in this test')
  }
  const io: JobPlansIo = {
    read: async () => {
      if (!plans.read) throw new Error('the test set no read')
      return plans.read
    },
    readSite: async () => ({ parts: [], sets: [], names: {} }),
    readPapers: async () => ({ rows: [], requests: [] }),
    keepPaper: never,
    markPaperCame: never,
    makeSitePart: never,
    makePart: never,
    pickPart: never,
    addSet: never,
    makeCurrent: never,
    removeSet: never,
    movePaper: never,
    updateMemo: never,
    updateChanges: never,
  }
  return { ...actual, supabaseJobPlansIo: () => io }
})

const issued: PlanSetRow = {
  id: 's1',
  part_id: 'p1',
  name: 'Issued set',
  kind: 'issued',
  source: 'gc',
  dated: null,
  came_at: '2026-10-01T12:00:00Z',
  memo: '',
  link: 'https://drive.google.com/drive/folders/issued-set',
  replaces_set_id: null,
  marks_up_set_id: null,
  job_id: null,
  file_name: null,
  file_size: null,
  file_count: null,
  checked_at: null,
  check_note: null,
  owed: false,
  ask_lane: null,
  ask_request_id: null,
  created_by: 'u-office',
  created_at: '2026-10-01T12:00:00Z',
  updated_at: '2026-10-01T12:00:00Z',
}
const part: PlanPartRow = {
  id: 'p1',
  development_id: 'd1',
  job_id: null,
  name: 'Building A',
  position: 0,
  current_set_id: 's1',
  current_set_by: 'u-office',
  current_set_at: '2026-10-02T15:00:00Z',
  created_by: 'u-office',
  created_at: '2026-10-01T12:00:00Z',
  updated_at: '2026-10-02T15:00:00Z',
}

const assigned = [
  {
    id: 'job-1',
    hcp_number: '9001',
    job_name: 'Whitfield water heater',
    job_address: '1208 Mesquite Ln, Cedar Bend, TX',
    google_drive_link: null,
    job_pictures_link: null,
    job_plans_link: 'https://drive.google.com/drive/folders/issued-set',
    revenue: 1850,
    project_id: null,
  },
]

beforeAll(() => {
  vi.stubGlobal('scrollTo', vi.fn())
  installDomShims()
})
afterEach(() => {
  plans.read = null
})

async function openAsHelper() {
  renderWithProviders(
    <UpdateFocusOpenerBridgeProvider>
      <DetailJobModal open onClose={vi.fn()} jobId="job-1" authRole="helpers" assignedJobsRows={assigned} scheduleContext={null} />
    </UpdateFocusOpenerBridgeProvider>,
  )
  await settle()
  await screen.findByRole('heading', { name: /Whitfield water heater/ })
  return screen.getByTestId('detail-job-plans')
}

describe('DetailJobModal · the crew reads the plans on their own window', () => {
  it('reads Building from with its Open ↗ and has Add our as-built, never + New set or the old Open plans row', async () => {
    plans.read = {
      job: { id: 'job-1', plan_part_id: 'p1', development_id: 'd1', development_name: null, job_plans_link: assigned[0]!.job_plans_link },
      part,
      sets: [issued],
      developmentParts: [{ id: 'p1', name: 'Building A', hasSet: true }],
      names: { 'u-office': 'Dana Example' },
    }
    const plansBox = await openAsHelper()
    await waitFor(() => expect(plansBox.getAttribute('data-state')).toBe('current'))
    expect(within(plansBox).getByRole('heading', { name: 'Plans' })).toBeTruthy()
    expect(within(plansBox).getByText(/Building from:/)).toBeTruthy()
    expect(within(plansBox).getByText('Issued set')).toBeTruthy()
    expect(within(plansBox).getByRole('button', { name: 'Open ↗' })).toBeTruthy()
    expect(within(plansBox).getByRole('button', { name: 'Add our as-built' })).toBeTruthy()
    expect(within(plansBox).queryByRole('button', { name: '+ New set' })).toBeNull()
    expect(within(plansBox).queryByRole('button', { name: 'Open plans' })).toBeNull()
    // The crew reads no development row, so the embedded name is null: the section still reads, and no other-plans notice shows for their one part.
    expect(within(plansBox).queryByTestId('job-plans-other-plans')).toBeNull()
  })

  it('on a job with no part says the office adds the set and keeps Open plans on the job’s own link', async () => {
    plans.read = {
      job: { id: 'job-1', plan_part_id: null, development_id: null, development_name: null, job_plans_link: assigned[0]!.job_plans_link },
      part: null,
      sets: [],
      developmentParts: [],
      names: {},
    }
    const plansBox = await openAsHelper()
    await waitFor(() => expect(plansBox.getAttribute('data-state')).toBe('no-part'))
    expect(within(plansBox).getByText('The office adds the set the job builds from.')).toBeTruthy()
    expect(within(plansBox).getByRole('button', { name: 'Open plans' })).toBeTruthy()
    expect(within(plansBox).queryByRole('button', { name: '+ New set' })).toBeNull()
  })
})
