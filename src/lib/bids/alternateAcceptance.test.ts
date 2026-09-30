import { describe, expect, it } from 'vitest'
import { acceptanceWords, agreedValueFromAcceptance, isDeclinedRow, jobScopeRows, offeredAlternates, toggleAcceptedTag } from './alternateAcceptance'

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
      { tag: 'Break room', key: 'group:break room', amount: 3220, offered: true, accepted: true },
      { tag: 'Annex', key: 'group:annex', amount: 900, offered: false, accepted: false },
    ])
  })

  it('the job is every row until the win, then the base plus what was taken', () => {
    const open = { outcome: null, alternate_group_tags: ['Break room', 'Annex'], accepted_alternate_tags: [] }
    expect(jobScopeRows(rows, open).map((r) => r.id)).toEqual(['a', 'b', 'c', 'd'])
    const won = { ...open, outcome: 'won', accepted_alternate_tags: ['Break room'] }
    expect(jobScopeRows(rows, won).map((r) => r.id)).toEqual(['a', 'b', 'c'])
    expect(isDeclinedRow(rows[3]!, won)).toBe(true)
    expect(isDeclinedRow(rows[2]!, won)).toBe(false)
    expect(isDeclinedRow(rows[3]!, open)).toBe(false)
    expect(jobScopeRows(rows, { ...won, outcome: 'started_or_complete' }).map((r) => r.id)).toEqual(['a', 'b', 'c'])
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
    expect(acceptanceWords({ outcome: 'won', alternate_group_tags: ['Break room'], accepted_alternate_tags: [] })).toBe('without the alternate')
    expect(acceptanceWords({ outcome: null, alternate_group_tags: ['Break room'], accepted_alternate_tags: [] })).toBe('')
    expect(acceptanceWords({ outcome: 'won', alternate_group_tags: [], accepted_alternate_tags: [] })).toBe('')
  })
})
