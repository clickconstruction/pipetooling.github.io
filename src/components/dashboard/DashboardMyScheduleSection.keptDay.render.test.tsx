// @vitest-environment jsdom
/**
 * My Schedule's kept day on screen (punch list #183 PR 3): the card under `data-kept-read` with
 * the stamp *Your day as read at 7:52 AM · reading again…*, the presses that write on a block held,
 * the two days drawn; a failed read with nothing kept draws the panel and never *Nothing scheduled*;
 * the live day carries none of it. The seam's side is `useDashboardSubSchedule.keptDay.render.test.tsx`.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { OFFLINE_ERROR_MESSAGE } from '../../lib/networkErrorMessage'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: () => {} }))

import { DashboardMyScheduleSection, type DashboardMyScheduleSectionProps } from './DashboardMyScheduleSection'
import type { JobScheduleBlockRow } from '../../lib/jobScheduleBlocks'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'

const TODAY = '2026-10-29'
const JOB_ID = 'job-1'
const READ_AT = Date.UTC(2026, 9, 29, 12, 52)

function block(over: Partial<JobScheduleBlockRow> = {}): JobScheduleBlockRow {
  return {
    assignee_user_id: 'user-1',
    bid_id: null,
    created_at: '2026-10-29T12:00:00Z',
    created_by: null,
    field_moved_at: null,
    field_moved_from: null,
    id: 'blk-1',
    job_id: JOB_ID,
    note: null,
    shared_block_group_id: null,
    time_end: '12:00',
    time_start: '08:00',
    updated_at: '2026-10-29T12:00:00Z',
    work_date: TODAY,
    ...over,
  }
}

function renderSection(over: Partial<DashboardMyScheduleSectionProps> = {}) {
  const props: DashboardMyScheduleSectionProps = {
    role: 'helpers',
    firstAssistantDispatchPhone: null,
    subScheduleLoading: false,
    subScheduleDayPartition: { todayYmd: TODAY, tomorrowYmd: '2026-10-30', todayBlocks: [block()], tomorrowBlocks: [] },
    subScheduleLabels: new Map([[JOB_ID, '512 · Ridgeway Builders']]),
    subSchedulePhones: new Map([[JOB_ID, '555-0100']]),
    subScheduleJobMeta: new Map([[JOB_ID, { job_pictures_link: null, hcp_number: '512', click_number: null, job_address: '1407 Cedar Bend Dr' }]]),
    leaveReportReminderForJobRow: () => false,
    assignedJobs: [],
    assignedReadyToBillJobs: [],
    detailModalAssignedJobsRows: [],
    submitLinkJobPicturesDispatchRequest: vi.fn(async () => {}),
    setLeaveReportJob: vi.fn(),
    reloadSubSchedule: vi.fn(),
    ...over,
  }
  return renderWithProviders(<DashboardMyScheduleSection {...props} />)
}

describe('DashboardMyScheduleSection, the kept day (#183 PR 3)', () => {
  it('draws the kept day under the stamp with data-kept-read, holds the presses that write on a block, and keeps + Add job live', async () => {
    renderSection({ subScheduleKeptAt: READ_AT })
    await settle()
    const root = document.getElementById('dash-my-schedule')!
    expect(root.hasAttribute('data-kept-read')).toBe(true)
    const stamp = screen.getByRole('status')
    expect(stamp.textContent).toMatch(/^Your day as read at \d{1,2}:\d{2} [AP]M · reading again…$/)
    // The day itself, as read.
    expect(screen.getByText('Ridgeway Builders')).toBeTruthy()
    expect(screen.queryByText(/Nothing scheduled today/)).toBeNull()
    // Held: a write on a kept block waits for the live read.
    const update = screen.getByRole('button', { name: 'Update % done' }) as HTMLButtonElement
    expect(update.disabled).toBe(true)
    expect(update.className).toContain('keptPress')
    expect(update.title).toBe('reading again…')
    const leave = screen.getByRole('button', { name: 'Leave Report' }) as HTMLButtonElement
    expect(leave.disabled).toBe(true)
    const rearrange = screen.getByRole('button', { name: 'Rearrange my schedule' }) as HTMLButtonElement
    expect(rearrange.disabled).toBe(true)
    // The ask-Dispatch press for a missing pictures link files a request, so it waits too.
    expect(screen.getByLabelText(/No customer photos link/i).closest('.keptPress')).not.toBeNull()
    // Live: a press that does not depend on the row.
    const add = screen.getAllByRole('button', { name: '+ Add job' })[0] as HTMLButtonElement // the header's; tomorrow's empty state offers it too
    expect(add.disabled).toBe(false)
    fireEvent.click(add)
    expect(await screen.findByRole('dialog', { name: 'Add a job to my schedule' })).toBeTruthy()
  })

  it('a failed live read over the kept day reads could not read again with Retry, and Retry reads the schedule again', async () => {
    const reloadSubSchedule = vi.fn()
    renderSection({ subScheduleKeptAt: READ_AT, subScheduleKeptFailed: true, reloadSubSchedule })
    await settle()
    expect(screen.getByRole('status').textContent).toMatch(/could not read again · Retry$/)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(reloadSubSchedule).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Ridgeway Builders')).toBeTruthy()
  })

  it('a failed read with nothing kept draws the failure in place of the two days, never Nothing scheduled, and a lost signal offers Retry', async () => {
    const reloadSubSchedule = vi.fn()
    renderSection({
      subScheduleDayPartition: { todayYmd: TODAY, tomorrowYmd: '2026-10-30', todayBlocks: [], tomorrowBlocks: [] },
      subScheduleError: { kind: 'network', message: OFFLINE_ERROR_MESSAGE },
      reloadSubSchedule,
    })
    await settle()
    expect(document.getElementById('dash-my-schedule')!.hasAttribute('data-kept-read')).toBe(false)
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByText(OFFLINE_ERROR_MESSAGE)).toBeTruthy()
    expect(screen.queryByText(/Nothing scheduled/)).toBeNull()
    expect(document.querySelector('[data-empty-state]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(reloadSubSchedule).toHaveBeenCalledTimes(1)
  })

  it('a refusal with nothing kept names its reason with no Retry', async () => {
    renderSection({
      subScheduleDayPartition: { todayYmd: TODAY, tomorrowYmd: '2026-10-30', todayBlocks: [], tomorrowBlocks: [] },
      subScheduleError: { kind: 'server', message: "You don't have access to this schedule." },
    })
    await settle()
    expect(screen.getByText("You don't have access to this schedule.")).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
    expect(screen.queryByText(/Nothing scheduled/)).toBeNull()
  })

  it('the live day carries no stamp, no attribute, and its presses are live', async () => {
    renderSection()
    await settle()
    expect(document.getElementById('dash-my-schedule')!.hasAttribute('data-kept-read')).toBe(false)
    expect(screen.queryByRole('status')).toBeNull()
    expect((screen.getByRole('button', { name: 'Update % done' }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole('button', { name: 'Leave Report' }) as HTMLButtonElement).disabled).toBe(false)
    expect(document.querySelector('.keptPress')).toBeNull()
  })
})
