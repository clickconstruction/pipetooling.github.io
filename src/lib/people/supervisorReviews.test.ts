import { describe, expect, it } from 'vitest'
import { EMPTY_SUPERVISOR_DRAFT, buildSupervisorDeck, nextUnratedCard, supervisorCardContextLine, supervisorDeckSummary, supervisorDraftHasContent, supervisorReviewRow, type SupervisorDeckPayload } from './supervisorReviews'

const payload: SupervisorDeckPayload = {
  supervisor: true,
  month: '2026-09-01',
  people: [
    { user_id: 'bryan', name: 'Bryan Ortiz', role: 'helpers', days: 4, jobs: ['J258 · Oak St', 'J291 · Elm Ct'], reviewed: false },
    { user_id: 'sam', name: 'Sam Reyes', role: 'helpers', days: 3, jobs: ['J258 · Oak St'], reviewed: true },
    { user_id: 'devon', name: 'Devon Pruitt', role: 'helpers', days: 1, jobs: ['J258 · Oak St'], reviewed: false }, // one day: not on the deck
    { user_id: 'tre', name: 'Tre Walker', role: 'helpers', days: 5, jobs: [], reviewed: false },
  ],
}

describe('buildSupervisorDeck', () => {
  it('keeps people with two or more days, unrated first by days together, rated last', () => {
    expect(buildSupervisorDeck(payload).map((c) => `${c.name}:${c.days}${c.reviewed ? ' ✓' : ''}`)).toEqual(['Tre Walker:5', 'Bryan Ortiz:4', 'Sam Reyes:3 ✓'])
  })
  it('is empty for a non-supervisor or no payload', () => {
    expect(buildSupervisorDeck({ ...payload, supervisor: false })).toEqual([])
    expect(buildSupervisorDeck(null)).toEqual([])
  })
  it('summarises and describes a card', () => {
    const cards = buildSupervisorDeck(payload)
    expect(supervisorDeckSummary(cards)).toBe('2 to rate')
    expect(supervisorDeckSummary(cards.map((c) => ({ ...c, reviewed: true })))).toBe('all 3 rated')
    expect(supervisorDeckSummary([])).toBeNull()
    expect(supervisorCardContextLine(cards[1]!)).toBe('4 days together · J258 · Oak St, J291 · Elm Ct')
    expect(supervisorCardContextLine({ days: 1, jobs: [] })).toBe('1 day together')
  })
  it('walks to the next unrated card, wrapping, and stops when all are rated', () => {
    const cards = buildSupervisorDeck(payload)
    expect(nextUnratedCard(cards, new Set(), 0)).toBe(1)
    expect(nextUnratedCard(cards, new Set(['bryan']), 0)).toBeNull()
    expect(nextUnratedCard(cards, new Set(['tre']), 1)).toBeNull()
    expect(nextUnratedCard(cards, new Set(), 1)).toBe(0)
  })
})

describe('the draft and the row', () => {
  it('knows an empty draft from one with content', () => {
    expect(supervisorDraftHasContent(EMPTY_SUPERVISOR_DRAFT)).toBe(false)
    expect(supervisorDraftHasContent({ ...EMPTY_SUPERVISOR_DRAFT, rating_drive: 70 })).toBe(true)
    expect(supervisorDraftHasContent({ ...EMPTY_SUPERVISOR_DRAFT, comment_ability: ' careful ' })).toBe(true)
  })
  it('builds the supervisor row, trimming comments to null', () => {
    expect(supervisorReviewRow({ ...EMPTY_SUPERVISOR_DRAFT, rating_ability: 72, comment_ability: ' careful, a bit slow ' }, 'bryan', 'mike', '2026-09-01')).toEqual({
      subject_user_id: 'bryan',
      reviewer_user_id: 'mike',
      review_month: '2026-09-01',
      source: 'supervisor',
      rating_ability: 72,
      rating_drive: null,
      rating_integrity: null,
      comment_ability: 'careful, a bit slow',
      comment_drive: null,
      comment_integrity: null,
    })
  })
})
