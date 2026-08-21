import { describe, expect, it } from 'vitest'
import type { ChecklistCardEvent } from './checklistCardEvents'
import { buildManageTimeline, commentTargetInstance, type ManageInstanceLite } from './checklistManageActivity'

const ev = (over: Partial<ChecklistCardEvent>): ChecklistCardEvent => ({
  id: 'e1',
  instance_id: 'i1',
  event_type: 'comment',
  actor_user_id: 'u1',
  body: '',
  created_at: '2026-08-20T10:00:00Z',
  ...over,
})

const inst = (over: Partial<ManageInstanceLite>): ManageInstanceLite => ({
  id: 'i1',
  scheduled_date: '2026-08-20',
  completed_at: null,
  ...over,
})

describe('buildManageTimeline', () => {
  it('merges creation + events oldest-first and tags events with their instance day', () => {
    const timeline = buildManageTimeline(
      { created_at: '2026-08-19T08:00:00Z', created_by_user_id: 'creator' },
      [inst({ id: 'i1', scheduled_date: '2026-08-20' }), inst({ id: 'i2', scheduled_date: '2026-08-21' })],
      [
        ev({ id: 'e2', instance_id: 'i2', event_type: 'completed', created_at: '2026-08-21T09:00:00Z' }),
        ev({ id: 'e1', instance_id: 'i1', event_type: 'comment', body: 'hi', created_at: '2026-08-20T10:00:00Z' }),
      ],
    )
    expect(timeline.map((t) => (t.kind === 'created' ? 'created' : t.id))).toEqual(['created', 'e1', 'e2'])
    const last = timeline[2]
    expect(last?.kind === 'event' && last.scheduledDate).toBe('2026-08-21')
  })

  it('omits the creation row when created_at is null and leaves unknown instances untagged', () => {
    const timeline = buildManageTimeline({ created_at: null, created_by_user_id: null }, [], [ev({})])
    expect(timeline).toHaveLength(1)
    expect(timeline[0]?.kind === 'event' && timeline[0].scheduledDate).toBeNull()
  })

  it('puts creation before an event with the identical timestamp', () => {
    const at = '2026-08-20T10:00:00Z'
    const timeline = buildManageTimeline(
      { created_at: at, created_by_user_id: 'creator' },
      [inst({})],
      [ev({ created_at: at })],
    )
    expect(timeline[0]?.kind).toBe('created')
  })
})

describe('commentTargetInstance', () => {
  const today = '2026-08-21'

  it('picks the latest past-or-today instance, ignoring pre-materialized future rows', () => {
    const target = commentTargetInstance(
      [
        inst({ id: 'far-future', scheduled_date: '2028-02-09' }),
        inst({ id: 'today', scheduled_date: '2026-08-21' }),
        inst({ id: 'older-open', scheduled_date: '2026-08-19' }),
      ],
      today,
    )
    expect(target?.id).toBe('today')
  })

  it('targets a completed current occurrence rather than skipping to the future', () => {
    const target = commentTargetInstance(
      [
        inst({ id: 'tomorrow', scheduled_date: '2026-08-22' }),
        inst({ id: 'today-done', scheduled_date: '2026-08-21', completed_at: '2026-08-21T12:00:00Z' }),
      ],
      today,
    )
    expect(target?.id).toBe('today-done')
  })

  it('falls back to the earliest future instance when nothing is due yet', () => {
    const target = commentTargetInstance(
      [inst({ id: 'later', scheduled_date: '2026-09-05' }), inst({ id: 'sooner', scheduled_date: '2026-08-28' })],
      today,
    )
    expect(target?.id).toBe('sooner')
  })

  it('returns null with no instances', () => {
    expect(commentTargetInstance([], today)).toBeNull()
  })
})
