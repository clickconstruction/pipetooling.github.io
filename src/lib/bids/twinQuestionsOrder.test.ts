import { describe, expect, it } from 'vitest'
import { compareTwinQuestions, sortTwinQuestions } from './twinQuestionsOrder'

const NOW = Date.parse('2026-10-26T15:00:00Z')
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()

describe('sortTwinQuestions (punch list #184 sweep B)', () => {
  it('open before the rest; open OLDEST first; the rest newest first', () => {
    const rows = [
      { id: 'a-old', status: 'answered', created_at: daysAgo(9) },
      { id: 'o-new', status: 'open', created_at: daysAgo(0) },
      { id: 'd-new', status: 'dismissed', created_at: daysAgo(1) },
      { id: 'o-old', status: 'open', created_at: daysAgo(3) },
      { id: 'o-mid', status: 'open', created_at: daysAgo(1) },
      { id: 'p-mid', status: 'promoted', created_at: daysAgo(4) },
    ]
    expect(sortTwinQuestions(rows).map((r) => r.id)).toEqual(['o-old', 'o-mid', 'o-new', 'd-new', 'p-mid', 'a-old'])
  })

  it('an open question with no stamp sinks below the stamped open ones', () => {
    const rows = [
      { id: 'o-none', status: 'open', created_at: null },
      { id: 'o-old', status: 'open', created_at: daysAgo(2) },
    ]
    expect(sortTwinQuestions(rows).map((r) => r.id)).toEqual(['o-old', 'o-none'])
  })

  it('does not mutate the input', () => {
    const rows = [{ id: 'a', status: 'open', created_at: daysAgo(0) }, { id: 'b', status: 'open', created_at: daysAgo(2) }]
    sortTwinQuestions(rows)
    expect(rows.map((r) => r.id)).toEqual(['a', 'b'])
    expect(compareTwinQuestions(rows[0]!, rows[1]!)).toBeGreaterThan(0)
  })
})
