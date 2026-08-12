// @vitest-environment jsdom
/**
 * Render tests for the Linked crew modal redesign (v2.1401): the shared
 * job/date/time renders ONCE per leg as a header card (no <table>), person
 * rows carry the actions, the "outside week" badge appears only with hub-week
 * context, and multi-day groups get one header card per leg.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders, useAuthModuleMock } from '../../test/renderSmokeMocks'

vi.mock('../../hooks/useAuth', async () => useAuthModuleMock())

const blocks = [
  {
    id: 'b1',
    job_id: 'job-1',
    assignee_user_id: 'u-abraham',
    work_date: '2026-08-05',
    time_start: '08:00',
    time_end: '10:00',
    note: null,
    shared_block_group_id: 'g1',
  },
  {
    id: 'b2',
    job_id: 'job-1',
    assignee_user_id: 'u-juan',
    work_date: '2026-08-05',
    time_start: '08:00',
    time_end: '10:00',
    note: null,
    shared_block_group_id: 'g1',
  },
  {
    id: 'b3',
    job_id: 'job-1',
    assignee_user_id: 'u-abraham',
    work_date: '2026-08-12',
    time_start: '08:00',
    time_end: '10:00',
    note: null,
    shared_block_group_id: 'g1',
  },
]

vi.mock('../../lib/jobScheduleBlocks', () => ({
  fetchJobScheduleBlocksForSharedGroupId: vi.fn(async () => ({ data: blocks, error: null })),
  updateJobScheduleBlock: vi.fn(async () => ({ error: null })),
  deleteJobScheduleBlock: vi.fn(async () => ({ error: null })),
  insertJobScheduleBlock: vi.fn(async () => ({ error: null })),
}))

vi.mock('../../lib/scheduleDispatchHub', () => ({
  fetchUserNamesForIds: vi.fn(async () => ({
    data: new Map([
      ['u-abraham', 'Abraham'],
      ['u-juan', 'Juan'],
    ]),
    error: null,
  })),
}))

import { LinkedScheduleGroupModal } from './LinkedScheduleGroupModal'

function renderModal(overrides: Partial<Parameters<typeof LinkedScheduleGroupModal>[0]> = {}) {
  return renderWithProviders(
    <LinkedScheduleGroupModal
      open
      onClose={() => {}}
      groupId="g1"
      getJobDisplayTitle={() => '940 · Lyndsey McDermott'}
      canManage
      addPeople={[{ userId: 'u-mario', displayName: 'Mario' }]}
      {...overrides}
    />,
  )
}

describe('LinkedScheduleGroupModal redesign', () => {
  it('renders one header card per leg with shared job/date/time, person rows, and no table', async () => {
    renderModal()
    const jobTitles = await screen.findAllByText('940 · Lyndsey McDermott')
    expect(jobTitles).toHaveLength(2)
    expect(screen.getByText(/Wed, Aug 5/)).toBeTruthy()
    expect(screen.getByText(/Wed, Aug 12/)).toBeTruthy()
    expect(screen.getAllByText('Abraham')).toHaveLength(2)
    expect(screen.getAllByText('Juan')).toHaveLength(1)
    expect(document.querySelector('table')).toBeNull()
    expect(screen.getByText('Crew · 2 people')).toBeTruthy()
    expect(screen.getByText('Crew · 1 person')).toBeTruthy()
    expect(screen.getAllByText('Unlink')).toHaveLength(3)
    expect(screen.getAllByText('Remove')).toHaveLength(3)
  })

  it('shows the outside-week badge only with hub-week context', async () => {
    renderModal({ weekStart: '2026-08-02', weekEnd: '2026-08-08' })
    await screen.findAllByText('940 · Lyndsey McDermott')
    expect(screen.getAllByText('outside week')).toHaveLength(1)
  })

  it('hides badges and shows the combined add-person row in Dispatch Mode (no week context)', async () => {
    renderModal()
    await screen.findAllByText('940 · Lyndsey McDermott')
    expect(screen.queryByText('outside week')).toBeNull()
    expect(screen.getByText('Add a person…')).toBeTruthy()
    expect(screen.getByText('Add')).toBeTruthy()
  })

  it('Remove asks in-app (no window.confirm): confirm strip appears, Cancel restores (v2.1603)', async () => {
    renderModal()
    await screen.findAllByText('940 · Lyndsey McDermott')
    const firstRemove = screen.getAllByText('Remove')[0]
    expect(firstRemove).toBeTruthy()
    fireEvent.click(firstRemove!)
    expect(screen.getByText(/Delete .+’s block\?/)).toBeTruthy()
    // Row's Unlink/Remove pair swapped for the confirm strip — one fewer Unlink.
    expect(screen.getAllByText('Unlink')).toHaveLength(2)
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText(/Delete .+’s block\?/)).toBeNull()
    expect(screen.getAllByText('Unlink')).toHaveLength(3)
  })

  it('read-only variant renders the cards without manage buttons', async () => {
    renderModal({ canManage: false, addPeople: undefined })
    await screen.findAllByText('940 · Lyndsey McDermott')
    expect(screen.queryByText('Unlink')).toBeNull()
    expect(screen.queryByText('Remove')).toBeNull()
  })
})
