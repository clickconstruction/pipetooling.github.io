import { describe, expect, it } from 'vitest'
import type { JobTeamMemberRow } from './fetchJobTeamMembersForJobLedger'
import { teamMembersToActivityItems } from './jobThreadCrewActivity'

const row = (over: Partial<JobTeamMemberRow>): JobTeamMemberRow =>
  ({
    id: 't1',
    user_id: 'u1',
    created_at: '2026-06-03T15:00:00Z',
    users: { name: 'Alex' },
    ...over,
  }) as JobTeamMemberRow

describe('teamMembersToActivityItems', () => {
  it('maps to crew_added with name, non-financial, stable key', () => {
    const [it0] = teamMembersToActivityItems([row({ id: 'm' })])
    expect(it0!.event.type).toBe('crew_added')
    expect(it0!.event.dedupeKey).toBe('ev:crew:m')
    expect(it0!.event.summary).toBe('Alex added to crew')
    expect(it0!.event.financial).toBe(false)
  })

  it('falls back to "Someone" and skips rows without created_at', () => {
    const items = teamMembersToActivityItems([
      row({ id: 'a', users: null }),
      row({ id: 'b', created_at: null }),
    ])
    expect(items.map((i) => i.event.dedupeKey)).toEqual(['ev:crew:a'])
    expect(items[0]!.event.summary).toBe('Someone added to crew')
  })
})
