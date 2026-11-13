// @vitest-environment jsdom
/**
 * Render smoke for the Quick Assign sheet's job picker (v2.6496): the Add job to schedule the
 * office opens on a phone finds a job by the number it carries, Click or HCP, typed in the
 * search box or in the # box. Taunya, 2026-11-04: typing 1007 read "No jobs match." — the
 * sheet's search box matched the HCP number alone, and a job made in the app has none.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import QuickAssignSheet from './QuickAssignSheet'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})
vi.mock('../../lib/scheduleDispatchHub', async () => {
  const actual = await vi.importActual<typeof import('../../lib/scheduleDispatchHub')>('../../lib/scheduleDispatchHub')
  return {
    ...actual,
    fetchJobsLedgerForScheduleDispatchHub: async () => ({
      data: [
        {
          id: 'j473',
          hcp_number: '473',
          click_number: null,
          job_name: 'Mike Holmby',
          project_id: null,
          created_at: '2026-01-05T15:00:00Z',
          job_address: '109 Tamberline Trail',
          customer_name: 'Mike Holmby',
          status: 'working',
          service_type: null,
        },
        {
          id: 'j1007',
          hcp_number: null,
          click_number: '1007',
          job_name: 'ZZ Test sink',
          project_id: null,
          created_at: '2026-11-03T15:00:00Z',
          job_address: '1 Test Street',
          customer_name: 'ZZ Test',
          status: 'working',
          service_type: null,
        },
      ],
      error: null,
    }),
    fetchUsersTabRosterForScheduleDispatchHub: async () => ({ data: [], error: null }),
    fetchUserNamesForIds: async () => ({ data: new Map<string, string>(), error: null }),
  }
})
vi.mock('../../lib/dispatchSwimLanes', async () => {
  const actual = await vi.importActual<typeof import('../../lib/dispatchSwimLanes')>('../../lib/dispatchSwimLanes')
  return { ...actual, fetchDispatchSwimLanes: async () => ({ data: null, error: null }) }
})
vi.mock('../../lib/dispatchModeSchedule', async () => {
  const actual = await vi.importActual<typeof import('../../lib/dispatchModeSchedule')>('../../lib/dispatchModeSchedule')
  return { ...actual, fetchDispatchModeDayBlocks: async () => ({ data: [], error: null, errorKind: null }) }
})
vi.mock('../../lib/jobSearchEvidence', async () => {
  const actual = await vi.importActual<typeof import('../../lib/jobSearchEvidence')>('../../lib/jobSearchEvidence')
  return { ...actual, fetchJobSearchEvidence: async () => new Map() }
})

beforeAll(installDomShims)
afterEach(cleanup)

/** The picker, once the ledger's two jobs are on its list. */
async function openPicker() {
  renderWithProviders(<QuickAssignSheet open onClose={() => {}} />)
  await settle()
  const picker = within(await screen.findByRole('dialog', { name: 'Add job to schedule' }))
  await picker.findByRole('button', { name: 'J1007 · ZZ Test sink' })
  return picker
}

/** The job rows' identity lines, in list order (the pick buttons carry them as their names). */
function listedJobs(picker: ReturnType<typeof within>): string[] {
  return picker
    .queryAllByRole('button')
    .map((b: HTMLElement) => b.getAttribute('aria-label') ?? '')
    .filter((name: string) => /^J\d/.test(name))
}

describe('QuickAssignSheet · the job picker', () => {
  it('lists both jobs, newest first, before anything is typed', async () => {
    const picker = await openPicker()
    expect(listedJobs(picker)).toEqual(['J1007 · ZZ Test sink', 'J473 · Mike Holmby'])
  })

  it('the search box finds a job by its Click number and a job by its HCP number', async () => {
    const picker = await openPicker()
    const search = picker.getByLabelText('Search jobs')
    fireEvent.change(search, { target: { value: '1007' } })
    expect(listedJobs(picker)).toEqual(['J1007 · ZZ Test sink'])
    expect(picker.queryByText('No jobs match.')).toBeNull()
    fireEvent.change(search, { target: { value: '473' } })
    expect(listedJobs(picker)).toEqual(['J473 · Mike Holmby'])
    fireEvent.change(search, { target: { value: '5555' } })
    expect(listedJobs(picker)).toEqual([])
    expect(picker.getByText('No jobs match.')).toBeTruthy()
  })

  it('the # box finds both kinds of number too', async () => {
    const picker = await openPicker()
    fireEvent.click(picker.getByRole('button', { name: 'Search by job number' }))
    const numberBox = picker.getByLabelText(/^Job number/)
    fireEvent.change(numberBox, { target: { value: '1007' } })
    expect(listedJobs(picker)).toEqual(['J1007 · ZZ Test sink'])
    fireEvent.change(numberBox, { target: { value: '473' } })
    expect(listedJobs(picker)).toEqual(['J473 · Mike Holmby'])
  })
})
