import { describe, expect, it } from 'vitest'
import type { JobScheduleBlockRow } from './jobScheduleBlocks'
import {
  dedupeSubScheduleBlocks,
  partitionSubScheduleBlocksByDay,
  resolveSubScheduleJobMeta,
  sortSubScheduleBlocksByStart,
  subScheduleJobLabel,
} from './dashboardSubSchedule'

const block = (over: Partial<JobScheduleBlockRow> & { id: string }): JobScheduleBlockRow => ({
  assignee_user_id: 'user-1',
  created_at: '2026-07-17T12:00:00Z',
  created_by: null,
  field_moved_at: null,
  field_moved_from: null,
  job_id: 'job-1',
  note: null,
  shared_block_group_id: null,
  time_end: '17:00',
  time_start: '08:00',
  updated_at: '2026-07-17T12:00:00Z',
  work_date: '2026-07-17',
  ...over,
})

describe('dedupeSubScheduleBlocks', () => {
  it('keeps one row per mirrored linked group (same group, date, window)', () => {
    const rows = [
      block({ id: 'a', shared_block_group_id: 'g1' }),
      block({ id: 'b', shared_block_group_id: 'g1' }),
    ]
    expect(dedupeSubScheduleBlocks(rows).map((b) => b.id)).toEqual(['a'])
  })

  it('keeps same-group rows that differ by date or window', () => {
    const rows = [
      block({ id: 'a', shared_block_group_id: 'g1' }),
      block({ id: 'b', shared_block_group_id: 'g1', work_date: '2026-07-18' }),
      block({ id: 'c', shared_block_group_id: 'g1', time_start: '09:00' }),
    ]
    expect(dedupeSubScheduleBlocks(rows).map((b) => b.id)).toEqual(['a', 'b', 'c'])
  })

  it('never collapses ungrouped rows, even with identical date and window', () => {
    const rows = [block({ id: 'a' }), block({ id: 'b' })]
    expect(dedupeSubScheduleBlocks(rows).map((b) => b.id)).toEqual(['a', 'b'])
  })
})

describe('subScheduleJobLabel', () => {
  it('joins HCP and job name with a middle dot', () => {
    expect(subScheduleJobLabel('1234', 'Smith repipe')).toBe('1234 · Smith repipe')
  })

  it('falls back to an em dash for a missing/blank HCP', () => {
    expect(subScheduleJobLabel(null, 'Smith repipe')).toBe('— · Smith repipe')
    expect(subScheduleJobLabel('  ', 'Smith repipe')).toBe('— · Smith repipe')
  })

  it("falls back to 'Job' for a missing/blank name", () => {
    expect(subScheduleJobLabel('1234', null)).toBe('1234 · Job')
    expect(subScheduleJobLabel(undefined, undefined)).toBe('— · Job')
  })
})

describe('partitionSubScheduleBlocksByDay', () => {
  it('buckets rows into today and tomorrow by work_date, dropping other days', () => {
    const rows = [
      block({ id: 'a', work_date: '2026-07-17' }),
      block({ id: 'b', work_date: '2026-07-18' }),
      block({ id: 'c', work_date: '2026-07-19' }),
    ]
    const p = partitionSubScheduleBlocksByDay(rows, '2026-07-17', '2026-07-18')
    expect(p.todayBlocks.map((b) => b.id)).toEqual(['a'])
    expect(p.tomorrowBlocks.map((b) => b.id)).toEqual(['b'])
  })

  it('puts a row in both buckets when today and tomorrow collapse to the same key', () => {
    const rows = [block({ id: 'a', work_date: '2026-07-17' })]
    const p = partitionSubScheduleBlocksByDay(rows, '2026-07-17', '2026-07-17')
    expect(p.todayBlocks.map((b) => b.id)).toEqual(['a'])
    expect(p.tomorrowBlocks.map((b) => b.id)).toEqual(['a'])
  })
})

describe('sortSubScheduleBlocksByStart', () => {
  it('sorts ascending by time_start without mutating the input', () => {
    const rows = [
      block({ id: 'late', time_start: '13:30' }),
      block({ id: 'early', time_start: '07:00' }),
      block({ id: 'mid', time_start: '09:15' }),
    ]
    expect(sortSubScheduleBlocksByStart(rows).map((b) => b.id)).toEqual(['early', 'mid', 'late'])
    expect(rows.map((b) => b.id)).toEqual(['late', 'early', 'mid'])
  })
})

describe('resolveSubScheduleJobMeta', () => {
  const meta = {
    job_pictures_link: 'https://drive.google.com/drive/folders/pics',
    hcp_number: '000',
    click_number: null,
    job_address: '12921 FM 20 Kingsbury TX',
  }

  it('falls back to the map when the job is absent from the assigned lists', () => {
    // The regression: a billed/paid scheduled job resolves `fromAssigned` to
    // undefined, which used to render the red "ask Dispatch" pictures button.
    expect(resolveSubScheduleJobMeta(undefined, meta)).toEqual(meta)
  })

  it('prefers the assigned-list row when it carries values', () => {
    expect(
      resolveSubScheduleJobMeta(
        {
          job_pictures_link: 'https://assigned',
          hcp_number: '789',
          click_number: '12',
          job_address: 'Assigned Addr',
        },
        meta,
      ),
    ).toEqual({
      job_pictures_link: 'https://assigned',
      hcp_number: '789',
      click_number: '12',
      job_address: 'Assigned Addr',
    })
  })

  it('fills per field, so a partially populated assigned row still resolves', () => {
    expect(resolveSubScheduleJobMeta({ hcp_number: '789' }, meta)).toEqual({
      job_pictures_link: meta.job_pictures_link,
      hcp_number: '789',
      click_number: null,
      job_address: meta.job_address,
    })
  })

  it('treats blank and whitespace-only values as absent on both sides', () => {
    expect(
      resolveSubScheduleJobMeta(
        { job_pictures_link: '   ', hcp_number: '', job_address: null },
        meta,
      ),
    ).toEqual(meta)
    expect(
      resolveSubScheduleJobMeta(null, {
        job_pictures_link: '  ',
        hcp_number: '',
        click_number: '   ',
        job_address: null,
      }),
    ).toEqual({
      job_pictures_link: null,
      hcp_number: null,
      click_number: null,
      job_address: null,
    })
  })

  it('returns nulls when neither side has the job', () => {
    expect(resolveSubScheduleJobMeta(undefined, undefined)).toEqual({
      job_pictures_link: null,
      hcp_number: null,
      click_number: null,
      job_address: null,
    })
  })

  it('returns the original untrimmed string so display formatting is unchanged', () => {
    expect(
      resolveSubScheduleJobMeta({ job_address: ' 12 Main St ' }, null).job_address,
    ).toBe(' 12 Main St ')
  })
})
