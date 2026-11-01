import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { PUT_BACK_WORDS, SET_ASIDE_WHY, setAsideLines, setAsideTitle } from './setAsideFold'

describe('the set-aside fold (v2.6231)', () => {
  const NOW = '2026-10-31T15:00:00Z'
  const rows = [
    { id: 's1', mailbox: 'bids', from_address: 'news@alamosurety.example', from_name: 'Alamo Surety Partners', subject: 'Five surety trends', at: '2026-10-29T13:00:00Z', reason: 'body_cue' },
    { id: 's2', mailbox: 'bids', from_address: 'deals@hillcountrysupply.example', from_name: null, subject: null, at: '2026-10-31T13:00:00Z', reason: 'marked_domain' },
    { id: 's3', mailbox: 'bids', from_address: 'x@y.example', from_name: ' ', subject: '  ', at: '2026-10-30T13:00:00Z', reason: 'odd' },
  ]

  it('counts in words', () => {
    expect(setAsideTitle(3)).toBe('3 notices set aside this week')
    expect(setAsideTitle(1)).toBe('1 notice set aside this week')
  })

  it('lists newest first, the name else the address, No subject, and why', () => {
    const lines = setAsideLines(rows, NOW)
    expect(lines.map((l) => l.id)).toEqual(['s2', 's3', 's1'])
    expect(lines[0]).toMatchObject({ who: 'deals@hillcountrysupply.example', subject: 'No subject', why: SET_ASIDE_WHY.marked_domain })
    expect(lines[1]).toMatchObject({ who: 'x@y.example', subject: 'No subject', why: 'The reader set it aside.' })
    expect(lines[2]).toMatchObject({ who: 'Alamo Surety Partners', subject: 'Five surety trends', why: SET_ASIDE_WHY.body_cue })
    expect(lines[0]!.when).toBeTruthy()
  })

  it('writes plain words', () => {
    for (const words of [PUT_BACK_WORDS, ...Object.values(SET_ASIDE_WHY)]) expect(plainWordsFailures(words)).toEqual([])
  })
})
