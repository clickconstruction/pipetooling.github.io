import { describe, expect, it } from 'vitest'
import { parseReviewDoor, reviewDoorHref, reviewDoorPersonIndex } from './reviewDoor'

describe('reviewDoor', () => {
  it('builds the People → Review href for a person and a pay week, and parses it back', () => {
    const href = reviewDoorHref({ person: ' Michael A ', from: '2026-08-30', to: '2026-09-05' })
    expect(href).toBe('/people?tab=review&review_person=Michael+A&review_from=2026-08-30&review_to=2026-09-05')
    expect(parseReviewDoor(href.slice(href.indexOf('?')))).toEqual({ person: 'Michael A', from: '2026-08-30', to: '2026-09-05' })
  })

  it('refuses a door with the wrong tab, no person, or a malformed date; swaps a backwards range; ignores the Person desk’s own person= param', () => {
    expect(parseReviewDoor('?tab=review&person=Bob&from=2026-08-30&to=2026-09-05')).toBeNull()
    expect(parseReviewDoor('?tab=hours&review_person=Bob&review_from=2026-08-30&review_to=2026-09-05')).toBeNull()
    expect(parseReviewDoor('?tab=review&review_from=2026-08-30&review_to=2026-09-05')).toBeNull()
    expect(parseReviewDoor('?tab=review&review_person=Bob&review_from=Aug+30&review_to=2026-09-05')).toBeNull()
    expect(parseReviewDoor('tab=review&review_person=Bob&review_from=2026-09-05&review_to=2026-08-30')).toEqual({ person: 'Bob', from: '2026-08-30', to: '2026-09-05' })
  })

  it('finds the person in the roster exactly first, then trimmed and case-insensitively', () => {
    const roster = ['Abraham', 'Michael A', 'michael a', 'Tristen ']
    expect(reviewDoorPersonIndex(roster, 'michael a')).toBe(2)
    expect(reviewDoorPersonIndex(roster, 'MICHAEL A')).toBe(1)
    expect(reviewDoorPersonIndex(roster, 'tristen')).toBe(3)
    expect(reviewDoorPersonIndex(roster, 'Nobody')).toBe(-1)
    expect(reviewDoorPersonIndex(roster, '  ')).toBe(-1)
  })
})
