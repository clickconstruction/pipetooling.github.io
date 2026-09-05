import { describe, expect, it } from 'vitest'
import {
  CREW_OFFICE_GAP,
  buildCrewDeck,
  crewCardContextLine,
  crewDraftHasContent,
  crewDraftToRow,
  crewSubjectsInOrder,
  emptyCrewDraft,
  emptyOpenWords,
  openWordsHaveContent,
  parseOpenPrompts,
  retiredQuestionGroups,
  summarizeCrewSubject,
  type CrewTeammate,
  type SourcedReviewRow,
} from './crewReview'

const ME = 'me'
const tm = (user_id: string, days_together: number, jobs: string[] = [], name = user_id.toUpperCase()): CrewTeammate => ({
  user_id,
  name,
  role: 'helpers',
  days_together,
  jobs,
})

describe('buildCrewDeck', () => {
  it('deals teammates in RPC order, skips me and anyone rated this month, puts the lead last', () => {
    const deck = buildCrewDeck({
      meUserId: ME,
      teammates: [tm('lead', 4), tm('grace', 3), tm(ME, 9), tm('roxi', 1), tm('done', 2)],
      leadUserId: 'lead',
      ratedThisMonth: new Set(['done']),
    })
    expect(deck.map((c) => `${c.kind}:${c.user_id}`)).toEqual(['teammate:grace', 'teammate:roxi', 'lead:lead'])
  })

  it('keeps a lead with no shared days but drops any other zero-day row', () => {
    const deck = buildCrewDeck({
      meUserId: ME,
      teammates: [tm('grace', 2), tm('lead', 0), tm('ghost', 0)],
      leadUserId: 'lead',
      ratedThisMonth: new Set(),
    })
    expect(deck.map((c) => c.user_id)).toEqual(['grace', 'lead'])
    expect(deck[1]?.kind).toBe('lead')
  })

  it('never deals the rater as their own lead', () => {
    const deck = buildCrewDeck({ meUserId: ME, teammates: [tm(ME, 0)], leadUserId: ME, ratedThisMonth: new Set() })
    expect(deck).toEqual([])
  })

  it('names a blank teammate "Teammate" and dedupes repeated ids', () => {
    const deck = buildCrewDeck({
      meUserId: ME,
      teammates: [tm('a', 2, [], ''), tm('a', 2)],
      leadUserId: null,
      ratedThisMonth: new Set(),
    })
    expect(deck).toHaveLength(1)
    expect(deck[0]?.name).toBe('Teammate')
  })
})

describe('crewCardContextLine', () => {
  it('reads days and up to two jobs; the lead is labelled', () => {
    const [card] = buildCrewDeck({
      meUserId: ME,
      teammates: [tm('grace', 3, ['J1042 — Balcones', 'J1039 — Lamar', 'J1001 — Third'])],
      leadUserId: null,
      ratedThisMonth: new Set(),
    })
    expect(crewCardContextLine(card!)).toBe('3 days together this cycle · J1042 — Balcones, J1039 — Lamar')
    const [lead] = buildCrewDeck({ meUserId: ME, teammates: [tm('lead', 0)], leadUserId: 'lead', ratedThisMonth: new Set() })
    expect(crewCardContextLine(lead!)).toBe('Your lead · no shared jobs this cycle')
    const [leadWithDay] = buildCrewDeck({ meUserId: ME, teammates: [tm('lead', 1, ['J9'])], leadUserId: 'lead', ratedThisMonth: new Set() })
    expect(crewCardContextLine(leadWithDay!)).toBe('Your lead · 1 day together this cycle · J9')
  })
})

describe('drafts and rows', () => {
  it('an untouched draft has no content; a moved bar or a typed note does', () => {
    expect(crewDraftHasContent(emptyCrewDraft())).toBe(false)
    expect(crewDraftHasContent({ ...emptyCrewDraft(), rating_drive: 0 })).toBe(true)
    expect(crewDraftHasContent({ ...emptyCrewDraft(), comment_ability: '  x ' })).toBe(true)
    expect(crewDraftHasContent({ ...emptyCrewDraft(), comment_ability: '   ' })).toBe(false)
  })

  it('the saved row is tagged crew and trims notes to null', () => {
    const row = crewDraftToRow({
      draft: { ...emptyCrewDraft(), rating_ability: 78, comment_ability: ' quick ' },
      subjectUserId: 'grace',
      reviewerUserId: ME,
      reviewMonth: '2026-09-01',
    })
    expect(row).toEqual({
      subject_user_id: 'grace',
      reviewer_user_id: ME,
      review_month: '2026-09-01',
      source: 'crew',
      rating_ability: 78,
      rating_drive: null,
      rating_integrity: null,
      comment_ability: 'quick',
      comment_drive: null,
      comment_integrity: null,
    })
  })
})

describe('open words', () => {
  it('prompts fall back to the defaults unless exactly four non-empty strings are stored', () => {
    expect(parseOpenPrompts(null)[0]).toBe('Something we should fix or improve')
    expect(parseOpenPrompts(['a', 'b', 'c'])).toHaveLength(4)
    expect(parseOpenPrompts(['a', 'b', 'c', ' '])[3]).toBe('Anything at all')
    expect(parseOpenPrompts([' a ', 'b', 'c', 'd'])).toEqual(['a', 'b', 'c', 'd'])
  })

  it('a card with only whitespace is nothing to send', () => {
    expect(openWordsHaveContent(emptyOpenWords())).toBe(false)
    expect(openWordsHaveContent({ ...emptyOpenWords(), anything: ' \n' })).toBe(false)
    expect(openWordsHaveContent({ ...emptyOpenWords(), training: 'backflow' })).toBe(true)
  })
})

const row = (o: Partial<SourcedReviewRow> & Pick<SourcedReviewRow, 'subject_user_id' | 'reviewer_user_id' | 'review_month' | 'source'>): SourcedReviewRow => ({
  id: `${o.subject_user_id}-${o.reviewer_user_id}-${o.review_month}-${o.source}`,
  rating_ability: null,
  rating_drive: null,
  rating_integrity: null,
  comment_ability: null,
  comment_drive: null,
  comment_integrity: null,
  ...o,
})

describe('summarizeCrewSubject', () => {
  const rows: SourcedReviewRow[] = [
    row({ subject_user_id: 'mal', reviewer_user_id: 'c1', review_month: '2026-09-01', source: 'crew', rating_ability: 90, rating_drive: 60, comment_drive: 'Leaves at 3 when we are still loading.' }),
    row({ subject_user_id: 'mal', reviewer_user_id: 'c2', review_month: '2026-09-01', source: 'crew', rating_ability: 86, rating_drive: 62, rating_integrity: 84 }),
    // c1 also rated last month: only the latest per rater counts, but its note still lists.
    row({ subject_user_id: 'mal', reviewer_user_id: 'c1', review_month: '2026-08-01', source: 'crew', rating_drive: 40, comment_drive: 'Hard to reach after lunch.' }),
    row({ subject_user_id: 'mal', reviewer_user_id: 'o1', review_month: '2026-08-01', source: 'office', rating_ability: 90, rating_drive: 82, rating_integrity: 86 }),
    row({ subject_user_id: 'grace', reviewer_user_id: 'c1', review_month: '2026-09-01', source: 'crew', rating_ability: 79 }),
  ]

  it('averages each rater once, lays crew beside office, and flags a 15-point gap', () => {
    const s = summarizeCrewSubject(rows, 'mal')
    expect(s.crewRaterCount).toBe(2)
    expect(s.officeReviewerCount).toBe(1)
    const drive = s.lanes.find((l) => l.short === 'Drive')!
    expect(drive.crew).toBe(61)
    expect(drive.office).toBe(82)
    expect(drive.gap).toBe(true)
    const ability = s.lanes.find((l) => l.short === 'Ability')!
    expect(ability.crew).toBe(88)
    expect(ability.gap).toBe(false)
    const integrity = s.lanes.find((l) => l.short === 'Integrity')!
    expect(integrity.crew).toBe(84)
    expect(s.gapDimensions).toEqual(['Drive'])
    expect(CREW_OFFICE_GAP).toBe(15)
  })

  it('lists crew notes newest month first and never office notes', () => {
    const s = summarizeCrewSubject(rows, 'mal')
    expect(s.crewNotes.map((n) => n.text)).toEqual(['Leaves at 3 when we are still loading.', 'Hard to reach after lunch.'])
    expect(s.crewNotes.every((n) => n.short === 'Drive')).toBe(true)
  })

  it('no office lane is no gap', () => {
    const s = summarizeCrewSubject(rows, 'grace')
    expect(s.officeReviewerCount).toBe(0)
    expect(s.lanes.every((l) => !l.gap)).toBe(true)
  })

  it('orders subjects by crew rater count, then name', () => {
    const names: Record<string, string> = { mal: 'Malachi', grace: 'Grace' }
    expect(crewSubjectsInOrder(rows, (id) => names[id] ?? id)).toEqual(['mal', 'grace'])
    const tie = crewSubjectsInOrder(rows.filter((r) => r.reviewer_user_id === 'c1'), (id) => names[id] ?? id)
    expect(tie).toEqual(['grace', 'mal'])
  })
})

describe('retiredQuestionGroups', () => {
  it('uses saved wording when valid and defaults otherwise', () => {
    const groups = retiredQuestionGroups(
      { manager_step_heading: ' About your lead ', manager_likert_prompts: ['a', 'b', 'c', 'd', 'e'], manager_overall_prompt: null, peer_step_heading: null, peer_likert_prompts: ['bad'] },
      { managerHeading: 'M', managerPrompts: ['m1', 'm2', 'm3', 'm4', 'm5'], managerOverall: 'overall?', peerHeading: 'P', peerPrompts: ['p1', 'p2', 'p3', 'p4', 'p5'] },
    )
    expect(groups[0]?.heading).toBe('About your lead')
    expect(groups[0]?.items).toEqual(['a', 'b', 'c', 'd', 'e', 'overall?'])
    expect(groups[1]?.heading).toBe('P')
    expect(groups[1]?.items).toEqual(['p1', 'p2', 'p3', 'p4', 'p5'])
    expect(groups[2]?.items).toHaveLength(3)
  })
})
