import { describe, expect, it } from 'vitest'
import {
  REVIEW_QUEUE_LIMIT,
  buildReviewQueueRows,
  matchesReviewQueueScope,
  reviewQueueCutoffIso,
  reviewQueueSelect,
  reviewQueueServerFilters,
  type ReviewQueueInstance,
} from './checklistReviewQueue'
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

describe('review queue server scope (v2.2917, J30-N1: filter before limit)', () => {
  const lead = { currentUserId: 'lead-1', isDev: false }
  const dev = { currentUserId: 'dev-1', isDev: true }

  /** What the section's query does now: scope, newest-first, then the cap. */
  function serverRead(all: ReviewQueueInstance[], scope: { currentUserId: string; isDev: boolean }) {
    return all
      .filter((i) => matchesReviewQueueScope(i, scope))
      .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
      .slice(0, REVIEW_QUEUE_LIMIT)
  }

  function company(): ReviewQueueInstance[] {
    // 60 newer completions reviewable by someone else, then 5 older ones for lead-1.
    const others = Array.from({ length: 60 }, (_, n) =>
      inst({
        id: `other-${n}`,
        completed_at: `2026-08-19T${String(10 + Math.floor(n / 60)).padStart(2, '0')}:${String(n).padStart(2, '0')}:00Z`,
        checklist_items: { title: 'Theirs', created_by_user_id: 'lead-9', notify_on_complete_user_id: null },
      }),
    )
    const mine = Array.from({ length: 5 }, (_, n) =>
      inst({ id: `mine-${n}`, completed_at: `2026-08-18T0${n}:00:00Z` }),
    )
    return [...others, ...mine]
  }

  it("a master's older cards survive 60 newer company-wide completions", () => {
    const all = company()
    const rows = buildReviewQueueRows({ instances: serverRead(all, lead), eventsByInstance: noEvents, currentUserId: 'lead-1', isDev: false })
    expect(rows.map((r) => r.instanceId).sort()).toEqual(['mine-0', 'mine-1', 'mine-2', 'mine-3', 'mine-4'])
  })

  it('documents the old bug: limiting before the scope lost every one of them', () => {
    const all = company().sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
    const oldRead = all.slice(0, REVIEW_QUEUE_LIMIT)
    expect(buildReviewQueueRows({ instances: oldRead, eventsByInstance: noEvents, currentUserId: 'lead-1', isDev: false })).toHaveLength(0)
  })

  it('the in-memory mirror agrees with buildReviewQueueRows on every row', () => {
    const rows: ReviewQueueInstance[] = [
      inst({ id: 'creator' }),
      inst({ id: 'notify', checklist_items: { title: 'T', created_by_user_id: 'x', notify_on_complete_user_id: 'lead-1' } }),
      inst({ id: 'stranger', checklist_items: { title: 'T', created_by_user_id: 'x', notify_on_complete_user_id: 'y' } }),
      inst({ id: 'self', completed_by_user_id: 'lead-1' }),
      inst({ id: 'no-completer', completed_by_user_id: null }),
      inst({ id: 'orphan-item', checklist_items: null }),
    ]
    for (const scope of [lead, dev]) {
      for (const r of rows) {
        const kept = buildReviewQueueRows({ instances: [r], eventsByInstance: noEvents, ...scope }).length === 1
        expect(matchesReviewQueueScope(r, scope), `${r.id} for ${scope.currentUserId}`).toBe(kept)
      }
    }
  })

  it('emits the PostgREST filters: reviewer or-clause on the embedded item, completer or-clause top-level', () => {
    expect(reviewQueueServerFilters(lead)).toEqual({
      reviewerOr: 'created_by_user_id.eq.lead-1,notify_on_complete_user_id.eq.lead-1',
      completerOr: 'completed_by_user_id.is.null,completed_by_user_id.neq.lead-1',
    })
    expect(reviewQueueServerFilters(dev).reviewerOr).toBeNull()
  })

  it('non-devs inner-join the item so the reviewer filter drops the parent row; devs keep the left join', () => {
    expect(reviewQueueSelect(false)).toContain('checklist_items!inner(')
    expect(reviewQueueSelect(true)).toContain(' checklist_items(')
    expect(reviewQueueSelect(true)).not.toContain('!inner')
    for (const sel of [reviewQueueSelect(false), reviewQueueSelect(true)]) {
      expect(sel).toMatch(/^id, checklist_item_id, scheduled_date, completed_at, completed_by_user_id, reviewed_at, /)
      expect(sel).toMatch(/\(title, created_by_user_id, notify_on_complete_user_id, roadmap_group_task_id\)$/)
    }
  })
})
