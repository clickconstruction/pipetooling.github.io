import { describe, expect, it } from 'vitest'
import {
  MY_DISPATCH_REQUESTS_COPY,
  splitMyDispatchRequests,
  summarizeMyDispatchRequest,
  type MyDispatchRequestRow,
} from './myDispatchRequests'

// 1:00 PM CDT on 2026-09-05.
const now = new Date('2026-09-05T18:00:00Z')

function row(over: Partial<MyDispatchRequestRow> & { id: string }): MyDispatchRequestRow {
  return {
    title: 'Add a customer phone number for HCP 846 - Uhl',
    status: 'open',
    created_at: '2026-09-05T15:00:00Z',
    closed_at: null,
    closed_note: null,
    closed_by: null,
    pending_action: 'add_job_phone',
    ...over,
  }
}

describe('summarizeMyDispatchRequest', () => {
  it('an open row is waiting on Dispatch with its age', () => {
    const v = summarizeMyDispatchRequest(row({ id: 'a' }), now)
    expect(v.state).toBe('open')
    expect(v.headline).toBe('Waiting on Dispatch · today')
    expect(v.answer).toBeNull()
  })

  it('a closed row shows "Office answered", who, when, and the note', () => {
    const v = summarizeMyDispatchRequest(
      row({
        id: 'b',
        status: 'closed',
        created_at: '2026-09-01T15:00:00Z',
        closed_at: '2026-09-03T15:00:00Z',
        closed_note: '  Added — 555-0100  ',
        closed_by: { name: 'Maria' },
      }),
      now,
    )
    expect(v.state).toBe('answered')
    expect(v.headline).toBe('Office answered (Maria) · 2d ago')
    expect(v.answer).toBe('Added — 555-0100')
  })

  it('a closed row without a note or closer still reads as answered', () => {
    const v = summarizeMyDispatchRequest(row({ id: 'c', status: 'closed', closed_at: '2026-09-05T16:00:00Z', closed_note: '   ' }), now)
    expect(v.headline).toBe('Office answered · today')
    expect(v.answer).toBeNull()
  })

  it('a blank title falls back to "Request"', () => {
    expect(summarizeMyDispatchRequest(row({ id: 'd', title: '  ' }), now).title).toBe('Request')
  })
})

describe('splitMyDispatchRequests', () => {
  it('open newest-first, answered newest-closed-first, cap with a hidden count', () => {
    const rows = [
      row({ id: 'o-old', created_at: '2026-09-01T15:00:00Z' }),
      row({ id: 'o-new', created_at: '2026-09-05T15:00:00Z' }),
      row({ id: 'c1', status: 'closed', closed_at: '2026-09-02T15:00:00Z' }),
      row({ id: 'c2', status: 'closed', closed_at: '2026-09-04T15:00:00Z' }),
      row({ id: 'c3', status: 'closed', closed_at: '2026-09-03T15:00:00Z' }),
    ]
    const split = splitMyDispatchRequests(rows, now, 2)
    expect(split.open.map((v) => v.id)).toEqual(['o-new', 'o-old'])
    expect(split.answered.map((v) => v.id)).toEqual(['c2', 'c3'])
    expect(split.answeredHidden).toBe(1)
  })

  it('empty in, empty out', () => {
    expect(splitMyDispatchRequests([], now)).toEqual({ open: [], answered: [], answeredHidden: 0 })
  })

  it('the empty-state copy points at the action, not the log', () => {
    expect(MY_DISPATCH_REQUESTS_COPY.empty).toMatch(/red phone/)
    expect(MY_DISPATCH_REQUESTS_COPY.empty).not.toMatch(/logged/)
  })
})
