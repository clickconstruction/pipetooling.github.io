// @vitest-environment jsdom
/**
 * Render-smoke tests for the My Schedule pictures-link control.
 *
 * The regression these pin: `list_assigned_jobs_for_dashboard` filters to
 * `status IN ('waiting','working')` and the ready-to-bill RPC to
 * `ready_to_bill`, but schedule blocks carry no status filter — so a scheduled
 * job that is billed or paid is in NEITHER assigned list. The row used to read
 * the pictures link straight off that lookup, so those jobs rendered the red
 * "no photos — ask Dispatch" button even when the job had a link. Tapping it
 * filed a duplicate `link_job_pictures` dispatch request that could never
 * auto-close (auto-close needs a blank→set transition on the job form).
 */
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
// The % done layer (v2.1567): the section's hook feeds whatever the kernel
// returns straight into the cards, so tests steer this mutable result.
let pctTodayResult: Map<string, { pct: number; delta: number | null }> = new Map()
vi.mock('../../lib/jobPctDayDelta', async () => {
  const actual = await vi.importActual<typeof import('../../lib/jobPctDayDelta')>('../../lib/jobPctDayDelta')
  return { ...actual, computeJobPctToday: () => pctTodayResult }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import { DashboardMyScheduleSection } from './DashboardMyScheduleSection'
import type { DashboardMyScheduleSectionProps } from './DashboardMyScheduleSection'
import type { JobScheduleBlockRow } from '../../lib/jobScheduleBlocks'
import type { SubScheduleJobMeta } from '../../lib/dashboardSubSchedule'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const TODAY = '2026-08-06'
const JOB_ID = 'job-office'
const PICTURES_URL = 'https://drive.google.com/drive/folders/1IBsb1Ep0UR4OKFePV0fT_Zj04Y8GmAWj'

function block(over: Partial<JobScheduleBlockRow> = {}): JobScheduleBlockRow {
  return {
    assignee_user_id: 'user-1',
    created_at: '2026-08-06T12:00:00Z',
    created_by: null,
    id: 'blk-1',
    job_id: JOB_ID,
    note: null,
    shared_block_group_id: null,
    time_end: '17:00',
    time_start: '08:00',
    updated_at: '2026-08-06T12:00:00Z',
    work_date: TODAY,
    ...over,
  }
}

function meta(over: Partial<SubScheduleJobMeta> = {}): SubScheduleJobMeta {
  return {
    job_pictures_link: PICTURES_URL,
    hcp_number: '000',
    click_number: null,
    job_address: '12921 FM 20 Kingsbury TX',
    ...over,
  }
}

function renderSection(over: Partial<DashboardMyScheduleSectionProps> = {}) {
  const props: DashboardMyScheduleSectionProps = {
    role: 'assistant',
    firstAssistantDispatchPhone: null,
    subScheduleLoading: false,
    subScheduleDayPartition: {
      todayYmd: TODAY,
      tomorrowYmd: '2026-08-07',
      todayBlocks: [block()],
      tomorrowBlocks: [],
    },
    subScheduleLabels: new Map([[JOB_ID, '000 · Office']]),
    subSchedulePhones: new Map(),
    subScheduleJobMeta: new Map([[JOB_ID, meta()]]),
    leaveReportReminderForJobRow: () => false,
    // The job is billed/paid: absent from both assigned lists, exactly as the
    // dashboard RPCs return it.
    assignedJobs: [],
    assignedReadyToBillJobs: [],
    detailModalAssignedJobsRows: [],
    submitLinkJobPicturesDispatchRequest: vi.fn(async () => {}),
    setLeaveReportJob: vi.fn(),
    ...over,
  }
  return renderWithProviders(<DashboardMyScheduleSection {...props} />)
}

describe('DashboardMyScheduleSection pictures link', () => {
  it('renders the open-photos link for a scheduled job that is in neither assigned list', () => {
    renderSection()
    expect(screen.getByLabelText('Open customer pictures')).toBeTruthy()
    expect(screen.queryByLabelText(/No customer photos link/i)).toBeNull()
  })

  it('still shows the ask-Dispatch button when the job genuinely has no link', () => {
    renderSection({
      subScheduleJobMeta: new Map([[JOB_ID, meta({ job_pictures_link: null })]]),
    })
    expect(screen.getByLabelText(/No customer photos link/i)).toBeTruthy()
    expect(screen.queryByLabelText('Open customer pictures')).toBeNull()
  })

  it('treats a whitespace-only link as missing', () => {
    renderSection({
      subScheduleJobMeta: new Map([[JOB_ID, meta({ job_pictures_link: '   ' })]]),
    })
    expect(screen.getByLabelText(/No customer photos link/i)).toBeTruthy()
  })

  it('falls back to ask-Dispatch when the meta map has not loaded yet', () => {
    renderSection({ subScheduleJobMeta: new Map() })
    expect(screen.getByLabelText(/No customer photos link/i)).toBeTruthy()
  })

  it('prefers the assigned-list row when the job IS in an assigned list', () => {
    renderSection({
      assignedJobs: [
        {
          id: JOB_ID,
          job_pictures_link: 'https://drive.google.com/drive/folders/from-assigned',
        } as unknown as DashboardMyScheduleSectionProps['assignedJobs'][number],
      ],
      subScheduleJobMeta: new Map([[JOB_ID, meta({ job_pictures_link: null })]]),
    })
    expect(screen.getByLabelText('Open customer pictures')).toBeTruthy()
  })

  it('moved-today card: % stack under the button AND the movement bar (v2.1567)', async () => {
    pctTodayResult = new Map([[JOB_ID, { pct: 62, delta: 13 }]])
    renderSection()
    // Stack delta line + bar right label both carry the movement.
    expect(await screen.findAllByText('▲ 13 today')).toHaveLength(2)
    // Bar footer's combined "62% done" label (the stack splits it across spans).
    expect(screen.getByText('62% done')).toBeTruthy()
    pctTodayResult = new Map()
  })

  it('unmoved card: % stack with "no change today", NO bar (v2.1567)', async () => {
    pctTodayResult = new Map([[JOB_ID, { pct: 75, delta: 0 }]])
    renderSection()
    expect(await screen.findByText('no change today')).toBeTruthy()
    expect(screen.queryByText(/▲|▼/)).toBeNull()
    expect(screen.queryByText('75% done')).toBeNull() // bar absent; stack renders 75% + "done" in separate spans
    pctTodayResult = new Map()
  })

  it('report-due card: amber Report due button + reason line, no footer banner (v2.1549)', () => {
    renderSection({
      role: 'helpers',
      leaveReportReminderForJobRow: () => true,
      assignedJobs: [
        { id: JOB_ID, my_last_report_at: null } as unknown as DashboardMyScheduleSectionProps['assignedJobs'][number],
      ],
    })
    expect(screen.queryByText(/You haven't filed a report yet/)).toBeNull()
    const btn = screen.getByTitle('Scheduled work ended — leave a job report.') as HTMLButtonElement
    expect(btn.textContent).toMatch(/Report\s*due/)
  })
})
