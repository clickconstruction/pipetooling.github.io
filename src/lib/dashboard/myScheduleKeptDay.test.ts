import { describe, expect, it } from 'vitest'
import type { JobScheduleBlockRow } from '../jobScheduleBlocks'
import { KEPT_READ_SCHEMA, parseKeptRead } from '../keptRead'
import {
  MY_SCHEDULE_KEPT_SCOPES,
  buildMyScheduleKeptRows,
  myScheduleBlockAnchorId,
  myScheduleKeptKey,
  myScheduleKeptRowIsValid,
  unpackMyScheduleKeptRows,
} from './myScheduleKeptDay'

const block = (over: Partial<JobScheduleBlockRow> & { id: string }): JobScheduleBlockRow => ({
  assignee_user_id: 'user-1',
  bid_id: null,
  created_at: '2026-10-29T12:00:00Z',
  created_by: null,
  field_moved_at: null,
  field_moved_from: null,
  job_id: 'job-1',
  note: null,
  shared_block_group_id: null,
  time_end: '12:00',
  time_start: '08:00',
  updated_at: '2026-10-29T12:00:00Z',
  work_date: '2026-10-29',
  ...over,
})

const meta = { job_pictures_link: 'https://drive.example/f', hcp_number: '512', click_number: null, job_address: '1407 Cedar Bend Dr' }

describe('myScheduleKeptKey', () => {
  it('carries the user, the page and the day, so another day is another key', () => {
    expect(myScheduleKeptKey('u1', '2026-10-29')).toBe('u1:my-schedule:2026-10-29')
    expect(myScheduleKeptKey('u1', '2026-10-30')).not.toBe(myScheduleKeptKey('u1', '2026-10-29'))
    expect(myScheduleKeptKey('u2', '2026-10-29')).not.toBe(myScheduleKeptKey('u1', '2026-10-29'))
  })

  it('wants both days', () => {
    expect(MY_SCHEDULE_KEPT_SCOPES).toEqual(['today', 'tomorrow'])
  })
})

describe('buildMyScheduleKeptRows / unpackMyScheduleKeptRows', () => {
  it('keeps each block with the label, the phone and the meta the card resolved, and unpacks them whole', () => {
    const rows = [block({ id: 'a' }), block({ id: 'b', job_id: 'job-2', work_date: '2026-10-30' }), block({ id: 'c', job_id: null, bid_id: 'bid-9' })]
    const kept = buildMyScheduleKeptRows({
      rows,
      labels: new Map([
        ['job-1', '512 · Ridgeway Builders'],
        ['bid:bid-9', 'B412 · Oakmont Clubhouse'],
      ]),
      phones: new Map([['job-1', '555-0100']]),
      meta: new Map([['job-1', meta]]),
    })
    expect(kept).toEqual([
      { block: rows[0], label: '512 · Ridgeway Builders', phone: '555-0100', meta },
      { block: rows[1], label: null, phone: null, meta: null },
      { block: rows[2], label: 'B412 · Oakmont Clubhouse', phone: null, meta: null },
    ])
    const day = unpackMyScheduleKeptRows(kept)
    expect(day.rows).toEqual(rows)
    expect([...day.labels]).toEqual([
      ['job-1', '512 · Ridgeway Builders'],
      ['bid:bid-9', 'B412 · Oakmont Clubhouse'],
    ])
    expect([...day.phones]).toEqual([
      ['job-1', '555-0100'],
      ['job-2', null],
    ])
    expect([...day.meta]).toEqual([['job-1', meta]])
  })

  it('a job with two windows keeps one phone and one meta', () => {
    const rows = [block({ id: 'a' }), block({ id: 'b', time_start: '13:00', time_end: '16:00' })]
    const day = unpackMyScheduleKeptRows(buildMyScheduleKeptRows({ rows, labels: new Map(), phones: new Map([['job-1', '555-0100']]), meta: new Map([['job-1', meta]]) }))
    expect(day.rows).toHaveLength(2)
    expect(day.phones.size).toBe(1)
    expect(day.meta.size).toBe(1)
  })

  it('the anchor is the job id, or bid:<id> on a bid-anchored visit', () => {
    expect(myScheduleBlockAnchorId({ job_id: 'job-1', bid_id: null })).toBe('job-1')
    expect(myScheduleBlockAnchorId({ job_id: null, bid_id: 'bid-9' })).toBe('bid:bid-9')
  })

  it('round-trips through the kept read shape the store parses', () => {
    const kept = buildMyScheduleKeptRows({ rows: [block({ id: 'a' })], labels: new Map(), phones: new Map(), meta: new Map() })
    const parsed = parseKeptRead({ key: 'u1:my-schedule:2026-10-29', schema: KEPT_READ_SCHEMA, scopes: ['today', 'tomorrow'], readAt: 1, rows: kept }, myScheduleKeptRowIsValid)
    expect(parsed?.rows).toEqual(kept)
  })
})

describe('myScheduleKeptRowIsValid', () => {
  it('takes a row with a block that has its id, day and window, nulls where the card allows them', () => {
    expect(myScheduleKeptRowIsValid({ block: block({ id: 'a' }), label: null, phone: null, meta: null })).toBe(true)
    expect(myScheduleKeptRowIsValid({ block: block({ id: 'a', job_id: null, bid_id: 'bid-9' }), label: 'B1 · Bid', phone: null, meta: null })).toBe(true)
  })

  it('refuses a row off the shape, so the kept day is not shown', () => {
    expect(myScheduleKeptRowIsValid(null)).toBe(false)
    expect(myScheduleKeptRowIsValid({})).toBe(false)
    expect(myScheduleKeptRowIsValid({ block: { id: 'a' } })).toBe(false)
    expect(myScheduleKeptRowIsValid({ block: block({ id: '' }) })).toBe(false)
    expect(myScheduleKeptRowIsValid({ block: block({ id: 'a' }), label: 3 })).toBe(false)
    expect(myScheduleKeptRowIsValid({ block: block({ id: 'a' }), phone: 3 })).toBe(false)
    expect(myScheduleKeptRowIsValid({ block: block({ id: 'a' }), meta: 'x' })).toBe(false)
  })
})
