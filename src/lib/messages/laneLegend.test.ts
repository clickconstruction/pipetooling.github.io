import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { laneLegend, LEGEND_WORDS } from './laneLegend'
import { JUMP_LANE_LABEL } from './jumpStrip'

describe('what each lane holds (punch list #151 PR 3)', () => {
  it('lists the six lanes in the strip’s order, each with its sentence', () => {
    const rows = laneLegend()
    expect(rows.map((r) => r.key)).toEqual(['new', 'needsYou', 'needsReply', 'weOwe', 'waiting', 'wentOut'])
    expect(rows.map((r) => r.label)).toEqual(Object.values(JUMP_LANE_LABEL))
    expect(rows[0]!.note).toBe('What came in and still needs sorting. Its row opens the thread, with the sort at the top.')
    expect(rows[1]!.note).not.toContain('clause')
    expect(rows[4]!.note).toMatch(/^Our line is the last word/)
    expect(rows[5]!.note).toMatch(/^Every text and email we sent in the last 7 days/)
  })

  it('says every sentence, and the button’s tips, in plain words', () => {
    for (const r of laneLegend()) expect(plainWordsFailures(r.note)).toEqual([])
    expect(plainWordsFailures(LEGEND_WORDS.tip)).toEqual([])
    expect(plainWordsFailures(LEGEND_WORDS.closeTip)).toEqual([])
    expect(LEGEND_WORDS.label).toBe('What each lane holds')
  })
})
