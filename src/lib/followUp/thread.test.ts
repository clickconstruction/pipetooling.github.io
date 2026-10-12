import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { backPillTip, threadStateRows } from './thread'

describe('Follow up in the thread (cut 2, C1)', () => {
  it('says when a note brings the row back, whose it is, and what × does', () => {
    expect(backPillTip({ backOn: '2026-10-02', backBy: 'Rosa' })).toBe(
      'Comes back Fri Oct 2. A note by Rosa brings this row back to Follow up that morning. × clears the day, and the note stays.',
    )
    expect(backPillTip({ backOn: null, backBy: null, backWords: 'after the walk' })).toBe(
      'A note by the team gave it words, not a day, so it will not come back by itself. × clears the words, and the note stays.',
    )
  })

  it('offers No reply needed and Remind me Monday on an open conversation, Reopen on any other, with the state each sets', () => {
    expect(threadStateRows('waiting', '2026-10-02').map((r) => [r.label, r.sets])).toEqual([
      ['No reply needed', 'done'],
      ['Remind me Monday', 'snoozed'],
    ])
    expect(threadStateRows('snoozed', '2026-10-02').map((r) => [r.label, r.sets])).toEqual([['Reopen', 'waiting']])
    expect(threadStateRows('done', '2026-10-02').map((r) => [r.label, r.sets])).toEqual([['Reopen', 'waiting']])
  })

  it('keeps its words plain', () => {
    const words = [
      backPillTip({ backOn: '2026-10-02', backBy: 'Rosa' }),
      backPillTip({ backOn: null, backBy: 'Rosa', backWords: 'soon' }),
      ...threadStateRows('waiting', '2026-10-02').map((r) => r.tip),
      ...threadStateRows('done', '2026-10-02').map((r) => r.tip),
    ]
    for (const w of words) expect(plainWordsFailures(w)).toEqual([])
  })
})
