import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { stagesNumberLookupFailedWords, stagesSearchLookupFailedWords, stagesSearchLookupOfflineMessage } from './stagesSearchLookupFailed'

describe('stagesSearchLookupFailed', () => {
  it('a lookup that failed says only the board was searched', () => {
    expect(stagesSearchLookupFailedWords(null)).toBe('Only the jobs already on the board were searched.')
    expect(stagesSearchLookupOfflineMessage(null)).toBe('No connection, so the other jobs were not searched. The search runs again when the signal is back.')
  })

  it('rows that did not load are counted, one and many', () => {
    expect(stagesSearchLookupFailedWords(1)).toBe('1 more match could not be loaded.')
    expect(stagesSearchLookupFailedWords(3)).toBe('3 more matches could not be loaded.')
    expect(stagesSearchLookupOfflineMessage(3)).toBe('No connection, so they did not load. They load again when the signal is back.')
  })

  it('the # jump names the number and the reason: a lost signal in its own words, a refusal in the server’s', () => {
    expect(stagesNumberLookupFailedWords('468', { kind: 'network', message: 'No connection.' })).toBe(
      'No connection, so #468 could not be looked up. Try again when the signal is back.',
    )
    expect(stagesNumberLookupFailedWords('468', { kind: 'server', message: 'You don’t have access to this record.' })).toBe(
      'Could not look up #468. You don’t have access to this record.',
    )
  })

  it('every sentence is plain words', () => {
    const all = [
      stagesSearchLookupFailedWords(null),
      stagesSearchLookupFailedWords(1),
      stagesSearchLookupFailedWords(12),
      stagesSearchLookupOfflineMessage(null),
      stagesSearchLookupOfflineMessage(2),
      stagesNumberLookupFailedWords('12345', { kind: 'network', message: '' }),
      stagesNumberLookupFailedWords('12345', { kind: 'server', message: 'Refused.' }),
    ]
    expect(all.flatMap((t) => plainWordsFailures(t))).toEqual([])
  })
})
