import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { DONE_FOLD_DAYS, DONE_FOLD_WHY, doneFoldLines, doneFoldTitle, reopenedWords, type DoneFiledRow, type DoneSaidRow } from './doneFold'
import { noReplyBody } from './noReply'

const NOW = '2026-11-12T18:00:00Z'
const said = (set: Partial<DoneSaidRow> = {}): DoneSaidRow => ({ contactId: 'dale', name: 'Dale Okafor', body: noReplyBody('Rosa', 'Nov 10'), at: '2026-11-10T15:02:00Z', ...set })
const filed = (set: Partial<DoneFiledRow> = {}): DoneFiledRow => ({ contactId: 'harlan', name: 'permits@harlanfreight.example', landedAt: '2026-11-09T22:12:00Z', ...set })

describe('done with no reply this week (v2.7030, punch list #324)', () => {
  it('reads a week back and counts in its title', () => {
    expect(DONE_FOLD_DAYS).toBe(7)
    expect(doneFoldTitle(1)).toBe('1 done with no reply this week')
    expect(doneFoldTitle(3)).toBe('3 done with no reply this week')
  })

  it('lists a person the office closed, with who said so and when', () => {
    expect(doneFoldLines([said()], [], NOW)).toEqual([{ contactId: 'dale', who: 'Dale Okafor', how: 'noReply', words: 'No reply needed · Rosa, on Tuesday', why: DONE_FOLD_WHY.noReply }])
  })

  it('lists a person whose old mail was filed, with the count and the newest day', () => {
    const rows = doneFoldLines([], [filed(), filed({ landedAt: '2026-11-09T22:12:05Z' }), filed({ landedAt: '2026-11-11T16:00:00Z' })], NOW)
    expect(rows).toEqual([{ contactId: 'harlan', who: 'permits@harlanfreight.example', how: 'filed', words: 'Old mail filed yesterday · 3 mails', why: DONE_FOLD_WHY.filed }])
    expect(doneFoldLines([], [filed()], NOW)[0]!.words).toBe('Old mail filed on Monday · 1 mail')
  })

  it('gives each person one row, the newer fact, newest first', () => {
    const rows = doneFoldLines(
      [said(), said({ at: '2026-11-08T15:00:00Z', body: noReplyBody('Marisol', 'Nov 8') }), said({ contactId: 'harlan', name: null, at: '2026-11-12T14:00:00Z' })],
      [filed(), filed({ contactId: 'dale', name: 'Dale Okafor', landedAt: '2026-11-09T10:00:00Z' })],
      NOW,
    )
    expect(rows.map((r) => [r.contactId, r.how])).toEqual([
      ['harlan', 'noReply'],
      ['dale', 'noReply'],
    ])
    expect(rows[0]!.who).toBe('A sender nobody has named')
    expect(rows[1]!.words).toBe('No reply needed · Rosa, on Tuesday')
  })

  it('skips a grey line that is not the press’s own', () => {
    expect(doneFoldLines([said({ body: 'Rosa took Dale Okafor.' })], [], NOW)).toEqual([])
  })

  it('writes plain words', () => {
    for (const words of [reopenedWords('Dale Okafor'), DONE_FOLD_WHY.noReply, DONE_FOLD_WHY.filed]) expect(plainWordsFailures(words)).toEqual([])
  })
})
