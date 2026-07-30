import { describe, expect, it } from 'vitest'
import {
  buildDispatchScheduledJobsForAssign,
  type JobScheduleBlockWithJobEmbed,
} from './jobScheduleBlocks'

function block(
  overrides: Partial<JobScheduleBlockWithJobEmbed> = {},
): JobScheduleBlockWithJobEmbed {
  return {
    id: 'blk-1',
    job_id: 'j-1',
    assignee_user_id: 'u-1',
    work_date: '2026-07-28',
    time_start: '08:00:00',
    time_end: '12:00:00',
    note: null,
    shared_block_group_id: null,
    created_at: '2026-07-27T00:00:00.000Z',
    created_by: null,
    updated_at: '2026-07-27T00:00:00.000Z',
    jobs_ledger: {
      hcp_number: '1842',
      job_name: 'Riverside Dr',
      job_address: '1842 Riverside Dr',
      service_type_id: null,
      click_number: null,
    },
    ...overrides,
  } as JobScheduleBlockWithJobEmbed
}

describe('buildDispatchScheduledJobsForAssign', () => {
  it('groups multiple windows of one job and sums scheduled minutes', () => {
    const picks = buildDispatchScheduledJobsForAssign([
      block(),
      block({ id: 'blk-2', time_start: '13:00:00', time_end: '16:00:00' }),
    ])
    expect(picks).toHaveLength(1)
    expect(picks[0]?.scheduledMinutes).toBe(240 + 180)
    expect(picks[0]?.earliestStartMinutes).toBe(480)
    expect(picks[0]?.windowSpans).toHaveLength(2)
    expect(picks[0]?.windowsLabel).toContain('; ')
  })

  it('skips blocks with no job embed', () => {
    expect(
      buildDispatchScheduledJobsForAssign([block({ jobs_ledger: null })]),
    ).toEqual([])
  })

  it('sorts by hcp number descending (numeric), then job name', () => {
    const picks = buildDispatchScheduledJobsForAssign([
      block({
        id: 'blk-a',
        job_id: 'j-a',
        jobs_ledger: {
          hcp_number: '99',
          job_name: 'Old Job',
          job_address: '',
          service_type_id: null,
          click_number: null,
        },
      }),
      block({
        id: 'blk-b',
        job_id: 'j-b',
        jobs_ledger: {
          hcp_number: '1901',
          job_name: 'Maple Ct',
          job_address: '',
          service_type_id: null,
          click_number: null,
        },
      }),
    ])
    expect(picks.map((p) => p.hcp_number)).toEqual(['1901', '99'])
  })

  it('trims labels and falls back to — for a missing job name', () => {
    const picks = buildDispatchScheduledJobsForAssign([
      block({
        jobs_ledger: {
          hcp_number: ' 1842 ',
          job_name: '  ',
          job_address: null,
          service_type_id: null,
          click_number: null,
        },
      }),
    ])
    expect(picks[0]?.hcp_number).toBe('1842')
    expect(picks[0]?.job_name).toBe('—')
    expect(picks[0]?.job_address).toBe('')
  })
})
