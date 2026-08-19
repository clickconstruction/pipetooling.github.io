import { describe, expect, it } from 'vitest'
import {
  cardStatus,
  commentCount,
  groupEventsByInstance,
  stripStamp,
  type ChecklistCardEvent,
} from './checklistCardEvents'

function ev(partial: Partial<ChecklistCardEvent> & { event_type: string; created_at: string }): ChecklistCardEvent {
  return {
    id: partial.id ?? `${partial.event_type}-${partial.created_at}`,
    instance_id: partial.instance_id ?? 'inst-1',
    actor_user_id: partial.actor_user_id ?? 'user-a',
    body: partial.body ?? '',
    ...partial,
  }
}

describe('groupEventsByInstance', () => {
  it('groups preserving order within each instance', () => {
    const events = [
      ev({ event_type: 'completed', created_at: '2026-08-19T10:00:00Z', instance_id: 'a' }),
      ev({ event_type: 'comment', created_at: '2026-08-19T10:05:00Z', instance_id: 'b' }),
      ev({ event_type: 'reopened', created_at: '2026-08-19T11:00:00Z', instance_id: 'a' }),
    ]
    const map = groupEventsByInstance(events)
    expect(map.get('a')?.map((e) => e.event_type)).toEqual(['completed', 'reopened'])
    expect(map.get('b')?.length).toBe(1)
  })
})

describe('commentCount', () => {
  it('counts only comments', () => {
    expect(
      commentCount([
        ev({ event_type: 'completed', created_at: '1' }),
        ev({ event_type: 'comment', created_at: '2' }),
        ev({ event_type: 'comment', created_at: '3' }),
        ev({ event_type: 'accepted', created_at: '4' }),
      ]),
    ).toBe(2)
  })
})

describe('cardStatus', () => {
  it('open with no events', () => {
    expect(cardStatus({ completed_at: null, reviewed_at: null }, [])).toEqual({ kind: 'open' })
  })

  it('completed but unreviewed -> waiting_review', () => {
    const s = cardStatus({ completed_at: '2026-08-19T16:00:00Z', reviewed_at: null }, [
      ev({ event_type: 'completed', created_at: '2026-08-19T16:00:00Z' }),
    ])
    expect(s).toEqual({ kind: 'waiting_review', at: '2026-08-19T16:00:00Z' })
  })

  it('reviewed -> signed_off with the accepter from events', () => {
    const s = cardStatus({ completed_at: '2026-08-19T16:00:00Z', reviewed_at: '2026-08-19T17:00:00Z' }, [
      ev({ event_type: 'completed', created_at: '2026-08-19T16:00:00Z' }),
      ev({ event_type: 'accepted', created_at: '2026-08-19T17:00:00Z', actor_user_id: 'lead-1' }),
    ])
    expect(s.kind).toBe('signed_off')
    if (s.kind === 'signed_off') expect(s.byUserId).toBe('lead-1')
  })

  it('reopened picks the first comment at/after the reopen as the reason', () => {
    const s = cardStatus({ completed_at: null, reviewed_at: null }, [
      ev({ event_type: 'comment', created_at: '2026-08-19T15:00:00Z', body: 'before — not the reason' }),
      ev({ event_type: 'completed', created_at: '2026-08-19T16:00:00Z' }),
      ev({ event_type: 'reopened', created_at: '2026-08-19T17:00:00Z', actor_user_id: 'lead-1' }),
      ev({ event_type: 'comment', created_at: '2026-08-19T17:00:00Z', body: 'check the wire gauge', actor_user_id: 'lead-1' }),
      ev({ event_type: 'comment', created_at: '2026-08-19T17:30:00Z', body: 'later chatter' }),
    ])
    expect(s.kind).toBe('reopened')
    if (s.kind === 'reopened') {
      expect(s.byUserId).toBe('lead-1')
      expect(s.reason).toBe('check the wire gauge')
    }
  })

  it('reopened with no comment after -> null reason', () => {
    const s = cardStatus({ completed_at: null, reviewed_at: null }, [
      ev({ event_type: 'completed', created_at: '2026-08-19T16:00:00Z' }),
      ev({ event_type: 'reopened', created_at: '2026-08-19T17:00:00Z' }),
    ])
    expect(s.kind).toBe('reopened')
    if (s.kind === 'reopened') expect(s.reason).toBeNull()
  })

  it('instance row wins over stale events (completed row, no completed event)', () => {
    const s = cardStatus({ completed_at: '2026-08-19T16:00:00Z', reviewed_at: null }, [])
    expect(s.kind).toBe('waiting_review')
  })

  it('re-completed after a reopen reads waiting_review, not reopened', () => {
    const s = cardStatus({ completed_at: '2026-08-19T18:00:00Z', reviewed_at: null }, [
      ev({ event_type: 'completed', created_at: '2026-08-19T16:00:00Z' }),
      ev({ event_type: 'reopened', created_at: '2026-08-19T17:00:00Z' }),
      ev({ event_type: 'completed', created_at: '2026-08-19T18:00:00Z' }),
    ])
    expect(s.kind).toBe('waiting_review')
  })
})

describe('stripStamp', () => {
  const now = new Date('2026-08-19T20:00:00')
  it('same day -> time only', () => {
    expect(stripStamp('2026-08-19T14:30:00', now)).toMatch(/2:30/)
  })
  it('within a week -> weekday + time', () => {
    expect(stripStamp('2026-08-17T14:30:00', now)).toMatch(/Mon/)
  })
  it('older -> short date', () => {
    expect(stripStamp('2026-07-01T14:30:00', now)).toMatch(/Jul/)
  })
  it('garbage passes through', () => {
    expect(stripStamp('not-a-date', now)).toBe('not-a-date')
  })
})
