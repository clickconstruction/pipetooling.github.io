import { describe, expect, it } from 'vitest'
import { buildReviewQueueRows, reviewQueueCutoffIso, type ReviewQueueInstance } from './checklistReviewQueue'
import type { ChecklistCardEvent } from './checklistCardEvents'

function inst(partial: Partial<ReviewQueueInstance> & { id: string }): ReviewQueueInstance {
  return {
    checklist_item_id: 'item-1',
    scheduled_date: '2026-08-19',
    completed_at: '2026-08-19T16:00:00Z',
    completed_by_user_id: 'worker-1',
    reviewed_at: null,
    checklist_items: { title: 'Task', created_by_user_id: 'lead-1', notify_on_complete_user_id: null },
    ...partial,
  }
}

const noEvents = new Map<string, ChecklistCardEvent[]>()

describe('buildReviewQueueRows', () => {
  it('creator sees their people, others do not', () => {
    const instances = [inst({ id: 'a' })]
    expect(
      buildReviewQueueRows({ instances, eventsByInstance: noEvents, currentUserId: 'lead-1', isDev: false }),
    ).toHaveLength(1)
    expect(
      buildReviewQueueRows({ instances, eventsByInstance: noEvents, currentUserId: 'stranger', isDev: false }),
    ).toHaveLength(0)
  })

  it('notify-target counts as reviewer', () => {
    const instances = [
      inst({ id: 'a', checklist_items: { title: 'T', created_by_user_id: 'x', notify_on_complete_user_id: 'lead-2' } }),
    ]
    expect(
      buildReviewQueueRows({ instances, eventsByInstance: noEvents, currentUserId: 'lead-2', isDev: false }),
    ).toHaveLength(1)
  })

  it('dev sees all, but never their own completions', () => {
    const instances = [
      inst({ id: 'a', completed_by_user_id: 'dev-1' }),
      inst({ id: 'b', completed_by_user_id: 'worker-1' }),
    ]
    const rows = buildReviewQueueRows({ instances, eventsByInstance: noEvents, currentUserId: 'dev-1', isDev: true })
    expect(rows.map((r) => r.instanceId)).toEqual(['b'])
  })

  it('skips reviewed and not-completed rows', () => {
    const instances = [
      inst({ id: 'a', reviewed_at: '2026-08-19T17:00:00Z' }),
      inst({ id: 'b', completed_at: null }),
    ]
    expect(
      buildReviewQueueRows({ instances, eventsByInstance: noEvents, currentUserId: 'lead-1', isDev: false }),
    ).toHaveLength(0)
  })

  it('carries the latest comment as the note preview', () => {
    const events = new Map<string, ChecklistCardEvent[]>([
      [
        'a',
        [
          { id: '1', instance_id: 'a', event_type: 'comment', actor_user_id: 'worker-1', body: 'first', created_at: '1' },
          { id: '2', instance_id: 'a', event_type: 'completed', actor_user_id: 'worker-1', body: '', created_at: '2' },
          { id: '3', instance_id: 'a', event_type: 'comment', actor_user_id: 'worker-1', body: 'went fine', created_at: '3' },
        ],
      ],
    ])
    const rows = buildReviewQueueRows({ instances: [inst({ id: 'a' })], eventsByInstance: events, currentUserId: 'lead-1', isDev: false })
    expect(rows[0]?.latestNoteBody).toBe('went fine')
  })

  it('sorts newest completion first', () => {
    const instances = [
      inst({ id: 'old', completed_at: '2026-08-18T10:00:00Z' }),
      inst({ id: 'new', completed_at: '2026-08-19T10:00:00Z' }),
    ]
    const rows = buildReviewQueueRows({ instances, eventsByInstance: noEvents, currentUserId: 'lead-1', isDev: false })
    expect(rows.map((r) => r.instanceId)).toEqual(['new', 'old'])
  })
})

describe('reviewQueueCutoffIso', () => {
  it('is 7 days before now', () => {
    expect(reviewQueueCutoffIso(new Date('2026-08-19T00:00:00Z'))).toBe('2026-08-12T00:00:00.000Z')
  })
})
