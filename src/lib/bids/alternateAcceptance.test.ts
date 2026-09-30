import { describe, expect, it } from 'vitest'
import { acceptanceWords, agreedValueFromAcceptance, alternateAnswer, boardAlternateState, isDeclinedRow, jobScopeRows, offeredAlternates, setAlternateAnswer, toggleAcceptedTag } from './alternateAcceptance'

const texts = { groups: { 'group:break room': { offered: true, amount: 3220 }, 'group:annex': { offered: false, amount: 900 } } }
const rows = [
  { id: 'a', fixture: 'WC', group_tag: 'Restroom A' },
  { id: 'b', fixture: 'WH', group_tag: null },
  { id: 'c', fixture: 'WC', group_tag: 'Break room' },
  { id: 'd', fixture: 'LAV', group_tag: 'annex' },
]

describe('alternateAcceptance (v2.4197)', () => {
  it('lists the offered alternates with the stamped amount and the answer', () => {
    const bid = { outcome: 'won', alternate_group_tags: ['Break room', 'Annex'], accepted_alternate_tags: ['break room'], cover_letter_alt_texts: texts }
    expect(offeredAlternates(bid)).toEqual([
      { tag: 'Break room', key: 'group:break room', amount: 3220, offered: true, accepted: true, answer: 'taken' },
      { tag: 'Annex', key: 'group:annex', amount: 900, offered: false, accepted: false, answer: 'unanswered' },
    ])
  })

  it('the job is every row until the win, then everything but what was DECLINED (v2.4225: said, not inferred)', () => {
    const open = { outcome: null, alternate_group_tags: ['Break room', 'Annex'], accepted_alternate_tags: [], declined_alternate_tags: ['Annex'] }
    expect(jobScopeRows(rows, open).map((r) => r.id)).toEqual(['a', 'b', 'c', 'd'])
    const won = { ...open, outcome: 'won', accepted_alternate_tags: ['Break room'] }
    expect(jobScopeRows(rows, won).map((r) => r.id)).toEqual(['a', 'b', 'c'])
    expect(isDeclinedRow(rows[3]!, won)).toBe(true)
    expect(isDeclinedRow(rows[2]!, won)).toBe(false)
    expect(isDeclinedRow(rows[3]!, open)).toBe(false)
    expect(jobScopeRows(rows, { ...won, outcome: 'started_or_complete' }).map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('v2.4225: an unanswered alternate on a won bid stays in the job (BP398: started before the question existed)', () => {
    const bp398 = { outcome: 'started_or_complete', alternate_group_tags: ['Break room'], accepted_alternate_tags: [], declined_alternate_tags: [] }
    expect(jobScopeRows(rows, bp398).map((r) => r.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(isDeclinedRow(rows[2]!, bp398)).toBe(false)
    expect(alternateAnswer('break room', bp398)).toBe('unanswered')
    // an old read without the column behaves the same
    expect(isDeclinedRow(rows[2]!, { outcome: 'won', alternate_group_tags: ['Break room'], accepted_alternate_tags: [] })).toBe(false)
    // a group made an alternate AFTER another was answered is unanswered, not declined
    const later = { outcome: 'won', alternate_group_tags: ['Break room', 'Annex'], accepted_alternate_tags: ['Break room'], declined_alternate_tags: [] }
    expect(alternateAnswer('Annex', later)).toBe('unanswered')
    expect(jobScopeRows(rows, later).map((r) => r.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('v2.4225: setAlternateAnswer keeps a tag in at most one list; the board asks while any answer is missing', () => {
    let lists = setAlternateAnswer({ accepted: [], declined: [] }, 'Break room', 'taken')
    expect(lists).toEqual({ accepted: ['Break room'], declined: [] })
    lists = setAlternateAnswer(lists, 'break ROOM', 'declined')
    expect(lists).toEqual({ accepted: [], declined: ['break ROOM'] })
    lists = setAlternateAnswer(lists, 'Break room', 'unanswered')
    expect(lists).toEqual({ accepted: [], declined: [] })
    const won = { outcome: 'won', alternate_group_tags: ['Break room', 'Annex'], accepted_alternate_tags: [] as string[], declined_alternate_tags: [] as string[] }
    expect(boardAlternateState(won)).toBe('unanswered')
    expect(boardAlternateState({ ...won, accepted_alternate_tags: ['Annex'] })).toBe('unanswered')
    expect(boardAlternateState({ ...won, accepted_alternate_tags: ['Annex'], declined_alternate_tags: ['Break room'] })).toBe('taken')
    expect(boardAlternateState({ ...won, declined_alternate_tags: ['Annex', 'Break room'] })).toBe('declined')
    expect(boardAlternateState({ ...won, outcome: null })).toBeNull()
    expect(boardAlternateState({ ...won, alternate_group_tags: [] })).toBeNull()
  })

  it('the agreed value is the sent base plus the accepted add-ons', () => {
    const alts = offeredAlternates({ outcome: 'won', alternate_group_tags: ['Break room', 'Annex'], accepted_alternate_tags: [], cover_letter_alt_texts: texts })
    expect(agreedValueFromAcceptance(13580, alts, ['Break room'])).toBe(16800)
    expect(agreedValueFromAcceptance(13580, alts, ['Break room', 'Annex'])).toBe(17700)
    expect(agreedValueFromAcceptance(13580, alts, [])).toBe(13580)
    expect(agreedValueFromAcceptance(null, alts, ['Break room'])).toBeNull()
    expect(toggleAcceptedTag([], 'Break room', true)).toEqual(['Break room'])
    expect(toggleAcceptedTag(['Break room'], 'break ROOM', false)).toEqual([])
  })

  it('says the answer in words', () => {
    expect(acceptanceWords({ outcome: 'won', alternate_group_tags: ['Break room'], accepted_alternate_tags: ['Break room'] })).toBe('with Break room')
    expect(acceptanceWords({ outcome: 'won', alternate_group_tags: ['Break room', 'Annex'], accepted_alternate_tags: ['Annex', 'Break room'] })).toBe('with Break room and Annex')
    expect(acceptanceWords({ outcome: 'won', alternate_group_tags: ['Break room'], accepted_alternate_tags: [], declined_alternate_tags: ['Break room'] })).toBe('without the alternate')
    expect(acceptanceWords({ outcome: 'won', alternate_group_tags: ['Break room'], accepted_alternate_tags: [] })).toBe('— did they take Break room?')
    expect(acceptanceWords({ outcome: null, alternate_group_tags: ['Break room'], accepted_alternate_tags: [] })).toBe('')
    expect(acceptanceWords({ outcome: 'won', alternate_group_tags: [], accepted_alternate_tags: [] })).toBe('')
  })
})
