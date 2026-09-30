import { describe, expect, it } from 'vitest'
import { initialReviewerPick, reviewerChoiceFrom, reviewerPickBad } from './reviewerPick'

describe('reviewerPick', () => {
  const people = [
    { id: 'p0', closed_at: '2026-09-01T00:00:00Z', may_decide: true },
    { id: 'p1', closed_at: null, may_decide: false },
    { id: 'p2', closed_at: null, may_decide: true },
  ]
  it('opens on the first open person who may decide, else the first person, else a new one', () => {
    expect(initialReviewerPick(people).person).toBe('p2')
    expect(initialReviewerPick(people.slice(0, 2)).person).toBe('p0')
    expect(initialReviewerPick([])).toEqual({ person: 'new', name: '', email: '', role: 'architect' })
  })
  it('a new reviewer needs a name and an email; a person on the room needs nothing more', () => {
    expect(reviewerPickBad({ person: 'new', name: '', email: '', role: 'architect' })).toBe(true)
    expect(reviewerPickBad({ person: 'new', name: 'Tom Reyes', email: 'tom', role: 'architect' })).toBe(true)
    expect(reviewerPickBad({ person: 'new', name: 'Tom Reyes', email: 'tom@owner.test', role: 'architect' })).toBe(false)
    expect(reviewerPickBad({ person: 'p1', name: '', email: '', role: 'architect' })).toBe(false)
    expect(reviewerChoiceFrom({ person: 'new', name: ' Tom Reyes ', email: ' tom@owner.test ', role: 'owners_rep' })).toEqual({ name: 'Tom Reyes', email: 'tom@owner.test', role: 'owners_rep' })
    expect(reviewerChoiceFrom({ person: 'p1', name: 'x', email: 'y', role: 'architect' })).toEqual({ id: 'p1' })
  })
})
