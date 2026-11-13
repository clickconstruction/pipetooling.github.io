import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { WEEK_CARD_LABEL, WEEK_NOT_READ_LINE } from './weekCall'
import { NOW_GO_PRESS, NOW_NOT_ON_LIST, NOW_ON_LIST, nowDeskFoot } from './pulseWords'

describe('the words of a page that makes no call', () => {
  it('names the card and the desk press as a reading of today', () => {
    expect(WEEK_CARD_LABEL).toBe('What to do now')
    expect(NOW_GO_PRESS).toBe('Go to what to do now')
    expect(NOW_ON_LIST).toBe('on the list')
    expect(NOW_NOT_ON_LIST).toBe('not on it')
  })

  it('says how many moves the card shows, and nothing when it shows them all', () => {
    expect(nowDeskFoot(5, 3)).toBe('The list at the top shows the first three.')
    expect(nowDeskFoot(4, 2)).toBe('The list at the top shows the first two.')
    expect(nowDeskFoot(3, 3)).toBe('')
  })

  it('is plain, and never speaks of a call or of Friday', () => {
    for (const words of [WEEK_CARD_LABEL, WEEK_NOT_READ_LINE, NOW_GO_PRESS, NOW_ON_LIST, NOW_NOT_ON_LIST, nowDeskFoot(5, 3)]) {
      expect(plainWordsFailures(words)).toEqual([])
      expect(words).not.toMatch(/Friday|call/)
    }
  })
})
