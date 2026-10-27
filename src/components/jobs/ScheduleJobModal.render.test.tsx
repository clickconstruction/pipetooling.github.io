// @vitest-environment jsdom
/**
 * Render smoke for Jobs → Schedule with several people (punch list #184, sweep A, PR 2): a
 * person whose day already has a block in the window is held with the block and a door to that
 * job, the button says both counts, and the rest are added as one linked group.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { ScheduleJobModal } from './ScheduleJobModal'

const insertJobScheduleBlocks = vi.fn(async (_rows: Array<{ assignee_user_id: string; shared_block_group_id: string }>) => ({ error: null as string | null }))
const fetchScheduleJobContext = vi.fn(async (jobId: string) => ({ data: { jobId, jobTitle: 'Other job', project_id: null, teamMembers: [] }, error: null }))

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'subcontractor' })
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/jobScheduleBlocks', () => ({
  fetchJobScheduleBlocksForJobDay: async () => ({ data: [], error: null }),
  // Todd already works 9–11 on another job that day.
  fetchScheduleBlocksForAssigneesOnDay: async () => ({ data: [{ id: 'b-todd', assignee_user_id: 'u2', job_id: 'job-other', bid_id: null, time_start: '09:00:00', time_end: '11:00:00' }], error: null }),
  insertJobScheduleBlocks: (rows: Array<{ assignee_user_id: string; shared_block_group_id: string }>) => insertJobScheduleBlocks(rows),
  newJobScheduleSharedBlockGroupId: () => 'group-1',
  fetchScheduleJobContext: (id: string) => fetchScheduleJobContext(id),
  deleteJobScheduleBlock: async () => ({ error: null }),
}))
// The picker is its own tested component; a plain list of toggles stands in so the test can pick.
vi.mock('../SearchableMultiSelect', () => ({
  SearchableMultiSelect: (p: { options: Array<{ value?: string; label?: string }>; value: string[]; onChange: (v: string[]) => void }) => (
    <div>
      {p.options
        .filter((o) => o.value)
        .map((o) => (
          <button key={o.value} type="button" onClick={() => p.onChange(p.value.includes(o.value!) ? p.value.filter((v) => v !== o.value) : [...p.value, o.value!])}>
            pick {o.label}
          </button>
        ))}
    </div>
  ),
}))

afterEach(() => {
  cleanup()
  insertJobScheduleBlocks.mockClear()
})

const TEAM = [
  { user_id: 'u1', name: 'Marisol' },
  { user_id: 'u2', name: 'Todd' },
  { user_id: 'u3', name: 'Ana' },
]

describe('Jobs → Schedule, several people', () => {
  it('holds the one whose day overlaps, says both counts, and adds the rest as one group', async () => {
    renderWithProviders(<ScheduleJobModal open onClose={() => {}} jobId="job-this" jobTitle="Hartline" teamMembers={TEAM} initialWorkDate="2026-10-27" />)
    // The first name in the picker (Ana) is picked on open; add Todd and Marisol.
    await screen.findByRole('button', { name: 'Add 1 to schedule' })
    fireEvent.click(screen.getByRole('button', { name: 'pick Todd' }))
    fireEvent.click(screen.getByRole('button', { name: 'pick Marisol' }))
    const add = await screen.findByRole('button', { name: 'Add 2 to schedule · 1 held: overlaps ▸' })
    const held = document.querySelector('[data-schedule-add-held]')
    expect(held?.textContent).toContain('Todd')
    expect(held?.textContent).toContain('held: overlaps 9:00 AM–11:00 AM on another job')
    expect(screen.getByText('1 is held. It stays here with the reason. The 2 ready ones add now.')).toBeTruthy()
    fireEvent.click(add)
    await waitFor(() => expect(insertJobScheduleBlocks).toHaveBeenCalledTimes(1))
    const rows = insertJobScheduleBlocks.mock.calls[0]![0]
    expect(rows.map((r) => r.assignee_user_id)).toEqual(['u3', 'u1'])
    expect(new Set(rows.map((r) => r.shared_block_group_id))).toEqual(new Set(['group-1']))
    // Todd stays picked with his reason; the two just added leave the pick.
    await screen.findByRole('button', { name: 'Add to schedule ▸' })
  })

  it('the held person’s door opens the other job', async () => {
    renderWithProviders(<ScheduleJobModal open onClose={() => {}} jobId="job-this" jobTitle="Hartline" teamMembers={TEAM} initialWorkDate="2026-10-27" />)
    await screen.findByRole('button', { name: 'Add 1 to schedule' })
    fireEvent.click(screen.getByRole('button', { name: 'pick Todd' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Open that job ▸' }))
    await waitFor(() => expect(fetchScheduleJobContext).toHaveBeenCalledWith('job-other'))
  })
})
