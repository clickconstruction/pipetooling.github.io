import { describe, expect, it } from 'vitest'
import { countDistinctJobsPerAssignee } from './currentlyInDispatchCounts'

describe('countDistinctJobsPerAssignee', () => {
  it('returns empty map for no rows', () => {
    expect(countDistinctJobsPerAssignee([]).size).toBe(0)
  })

  it('counts distinct jobs per user', () => {
    const rows = [
      { assignee_user_id: 'u1', job_id: 'j1' },
      { assignee_user_id: 'u1', job_id: 'j2' },
      { assignee_user_id: 'u2', job_id: 'j1' },
    ]
    const m = countDistinctJobsPerAssignee(rows)
    expect(m.get('u1')).toBe(2)
    expect(m.get('u2')).toBe(1)
  })

  it('dedupes multiple blocks on the same job for the same user', () => {
    const rows = [
      { assignee_user_id: 'u1', job_id: 'j1' },
      { assignee_user_id: 'u1', job_id: 'j1' },
      { assignee_user_id: 'u1', job_id: 'j1' },
    ]
    expect(countDistinctJobsPerAssignee(rows).get('u1')).toBe(1)
  })

  it('skips rows with empty ids', () => {
    const rows = [
      { assignee_user_id: '', job_id: 'j1' },
      { assignee_user_id: 'u1', job_id: '' },
    ]
    expect(countDistinctJobsPerAssignee(rows).size).toBe(0)
  })

  it('has no entry for users with no blocks (callers fall back to 0)', () => {
    const m = countDistinctJobsPerAssignee([{ assignee_user_id: 'u1', job_id: 'j1' }])
    expect(m.has('u2')).toBe(false)
  })
})
