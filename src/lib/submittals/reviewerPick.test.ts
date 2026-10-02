import { describe, expect, it } from 'vitest'
import { contactsOffered, gcOffered, initialReviewerPick, matchRoomPerson, reviewerChoiceFrom, reviewerPickBad, type ReviewerSources } from './reviewerPick'

describe('reviewerPick', () => {
  const people = [
    { id: 'p0', name: 'Old Hand', email: 'old@arch.test', closed_at: '2026-09-01T00:00:00Z', may_decide: true },
    { id: 'p1', name: 'Watcher', email: 'watch@arch.test', closed_at: null, may_decide: false },
    { id: 'p2', name: 'Dana Whitfield', email: 'dana@arch.test', closed_at: null, may_decide: true },
  ]
  const sources: ReviewerSources = { gcName: 'Structura', contacts: [{ id: 'c1', name: 'Marco Ruiz', email: 'marco@structura.test' }, { id: 'c2', name: 'Dana Whitfield', email: 'DANA@arch.test' }, { id: 'c3', name: 'Front Desk', email: null }] }

  it('opens on the first open person who may decide, else the bid’s GC, else the first person, else a new one', () => {
    expect(initialReviewerPick(people, sources).person).toBe('p2')
    expect(initialReviewerPick(people.slice(0, 2), sources).person).toBe('gc')
    expect(initialReviewerPick(people.slice(0, 2)).person).toBe('p0')
    expect(initialReviewerPick([], sources).person).toBe('gc')
    expect(initialReviewerPick([])).toEqual({ person: 'new', name: '', email: '', role: 'architect' })
  })

  it('offers the GC unless a person on the room carries its name, and the contacts not on the room yet', () => {
    expect(gcOffered(people, sources)).toBe(true)
    expect(gcOffered([{ id: 'g', name: ' structura ', email: null, closed_at: null, may_decide: true }], sources)).toBe(false)
    expect(gcOffered(people, { gcName: null, contacts: [] })).toBe(false)
    // Dana is on the room by her email; the other two are offered.
    expect(contactsOffered(people, sources).map((c) => c.id)).toEqual(['c1', 'c3'])
    expect(contactsOffered([{ id: 'f', name: 'front desk', email: null, closed_at: null, may_decide: true }], sources).map((c) => c.id)).toEqual(['c1', 'c2'])
  })

  it('a new reviewer needs a name; an email is optional and has to read as one when typed', () => {
    expect(reviewerPickBad({ person: 'new', name: '', email: '', role: 'architect' })).toBe(true)
    expect(reviewerPickBad({ person: 'new', name: 'Tom Reyes', email: '', role: 'architect' })).toBe(false)
    expect(reviewerPickBad({ person: 'new', name: 'Tom Reyes', email: 'tom', role: 'architect' })).toBe(true)
    expect(reviewerPickBad({ person: 'new', name: 'Tom Reyes', email: 'tom@owner.test', role: 'architect' })).toBe(false)
    expect(reviewerPickBad({ person: 'gc', name: '', email: '', role: 'architect' })).toBe(false)
    expect(reviewerPickBad({ person: 'p1', name: '', email: '', role: 'architect' })).toBe(false)
  })

  it('the choice it hands on: a room person by id, the GC by name with no email, a contact as filed, a typed person', () => {
    expect(reviewerChoiceFrom({ person: 'p1', name: 'x', email: 'y', role: 'architect' }, sources)).toEqual({ id: 'p1' })
    expect(reviewerChoiceFrom({ person: 'gc', name: '', email: '', role: 'architect' }, sources)).toEqual({ name: 'Structura', email: null, role: 'builder' })
    expect(reviewerChoiceFrom({ person: 'contact:c1', name: '', email: '', role: 'architect' }, sources)).toEqual({ name: 'Marco Ruiz', email: 'marco@structura.test', role: 'builder' })
    expect(reviewerChoiceFrom({ person: 'contact:c3', name: '', email: '', role: 'architect' }, sources)).toEqual({ name: 'Front Desk', email: null, role: 'builder' })
    expect(reviewerChoiceFrom({ person: 'new', name: ' Tom Reyes ', email: ' tom@owner.test ', role: 'owners_rep' })).toEqual({ name: 'Tom Reyes', email: 'tom@owner.test', role: 'owners_rep' })
    expect(reviewerChoiceFrom({ person: 'new', name: 'Tom Reyes', email: ' ', role: 'other' })).toEqual({ name: 'Tom Reyes', email: null, role: 'other' })
  })

  it('finds the person on the room: by email when there is one, else by name among the people with none', () => {
    const room = [
      { id: 'a', name: 'Dana Whitfield', email: 'dana@arch.test' },
      { id: 'b', name: 'Structura', email: null },
      { id: 'c', name: 'Tom Reyes', email: 'tom@owner.test' },
    ]
    expect(matchRoomPerson(room, { name: 'D. Whitfield', email: 'DANA@arch.test' })?.id).toBe('a')
    expect(matchRoomPerson(room, { name: 'structura ', email: null })?.id).toBe('b')
    // The same name with an email on file is another person: a nameless-email entry never takes it over.
    expect(matchRoomPerson(room, { name: 'Tom Reyes', email: null })).toBeNull()
    expect(matchRoomPerson(room, { name: 'New Person', email: 'new@x.test' })).toBeNull()
  })
})
