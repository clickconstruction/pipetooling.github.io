import { describe, expect, it } from 'vitest'
import type { JobModeScheduleBlock } from '../jobModePickCurrentNext'
import { KEPT_READ_SCHEMA, parseKeptRead } from '../keptRead'
import { buildJobModeDayRail } from '../jobModeDayRail'
import { JOB_MODE_KEPT_SCOPES, buildJobModeKeptRows, jobModeKeptKey, jobModeKeptRowIsValid, unpackJobModeKeptRows } from './keptDay'

const block = (id: string, job_id: string, time_start: string): JobModeScheduleBlock => ({
  id,
  job_id,
  time_start,
  time_end: '12:00',
  hcp_number: '512',
  click_number: null,
  job_name: 'Ridgeway Builders',
  job_address: '1407 Cedar Bend Dr',
  service_type_id: null,
})

describe('jobModeKeptKey', () => {
  it('carries the user, the page and the day', () => {
    expect(jobModeKeptKey('u1', '2026-10-29')).toBe('u1:job-mode:2026-10-29')
    expect(jobModeKeptKey('u1', '2026-10-30')).not.toBe(jobModeKeptKey('u1', '2026-10-29'))
    expect(JOB_MODE_KEPT_SCOPES).toEqual(['today'])
  })
})

describe('buildJobModeKeptRows / unpackJobModeKeptRows', () => {
  const blocks = [block('b1', 'job-a', '08:00'), block('b2', 'job-b', '10:30'), block('b3', 'job-c', '14:00'), block('b4', 'job-a', '16:00')]

  it('flags each block from the open session and the day’s closed sessions, and unpacks the rail’s facts', () => {
    const kept = buildJobModeKeptRows({ blocks, currentJobId: 'job-c', visitedJobIds: new Set(['job-a']) })
    expect(kept.map((r) => [r.block.id, r.current, r.visited])).toEqual([
      ['b1', false, true],
      ['b2', false, false],
      ['b3', true, false],
      ['b4', false, true],
    ])
    const day = unpackJobModeKeptRows(kept)
    expect(day.blocks).toEqual(blocks)
    expect(day.currentJobId).toBe('job-c')
    expect([...day.visitedJobIds]).toEqual(['job-a'])
  })

  it('the unpacked day draws the same rail the live one did', () => {
    const live = buildJobModeDayRail({ blocks, currentJobId: 'job-c', visitedJobIds: new Set(['job-a']) })
    const day = unpackJobModeKeptRows(buildJobModeKeptRows({ blocks, currentJobId: 'job-c', visitedJobIds: new Set(['job-a']) }))
    expect(buildJobModeDayRail({ blocks: day.blocks, currentJobId: day.currentJobId, visitedJobIds: day.visitedJobIds })).toEqual(live)
  })

  it('not clocked in, or clocked in off the schedule or on a bid, keeps no current job', () => {
    expect(unpackJobModeKeptRows(buildJobModeKeptRows({ blocks, currentJobId: null, visitedJobIds: new Set() })).currentJobId).toBeNull()
    expect(unpackJobModeKeptRows(buildJobModeKeptRows({ blocks, currentJobId: 'job-off-schedule', visitedJobIds: new Set() })).currentJobId).toBeNull()
  })

  it('round-trips through the kept read shape the store parses', () => {
    const kept = buildJobModeKeptRows({ blocks, currentJobId: null, visitedJobIds: new Set() })
    const parsed = parseKeptRead({ key: 'u1:job-mode:2026-10-29', schema: KEPT_READ_SCHEMA, scopes: ['today'], readAt: 1, rows: kept }, jobModeKeptRowIsValid)
    expect(parsed?.rows).toEqual(kept)
  })
})

describe('jobModeKeptRowIsValid', () => {
  it('takes a row with its block and both flags', () => {
    expect(jobModeKeptRowIsValid({ block: block('b1', 'job-a', '08:00'), current: false, visited: true })).toBe(true)
  })

  it('refuses a row off the shape', () => {
    expect(jobModeKeptRowIsValid(null)).toBe(false)
    expect(jobModeKeptRowIsValid({ block: block('b1', 'job-a', '08:00') })).toBe(false)
    expect(jobModeKeptRowIsValid({ block: block('', 'job-a', '08:00'), current: false, visited: false })).toBe(false)
    expect(jobModeKeptRowIsValid({ block: block('b1', '', '08:00'), current: false, visited: false })).toBe(false)
    expect(jobModeKeptRowIsValid({ block: { id: 'b1', job_id: 'job-a' }, current: false, visited: false })).toBe(false)
  })
})
