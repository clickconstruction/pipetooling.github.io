/** The words and the Try again outcome behind an address the map cannot place (punch list #408, step 3). */
import { describe, expect, it } from 'vitest'
import { plainSentence, sentenceParts } from '../valuesInPlace'
import { UNPLACED_DOOR_PARAM, UNPLACED_DOOR_PATH, keptMissesInAnswer, missCheckedSentence, missDayWords, tryAgainOutcome, tryAgainWords } from './unplacedMemory'

const NOW = '2026-11-24T15:00:00Z'
const KEY = 'zz the pasture behind the made up barn'

describe('the door from a card to the Map page\'s list', () => {
  it('is the Map page with the list open', () => {
    expect(UNPLACED_DOOR_PATH).toBe('/map?unplaced=1')
    expect(new URLSearchParams(UNPLACED_DOOR_PATH.split('?')[1]).get(UNPLACED_DOOR_PARAM)).toBe('1')
  })
})

describe('the day a miss was checked', () => {
  it('reads as a short day in the app\'s zone', () => {
    expect(missDayWords('2026-11-20T18:00:00Z', NOW)).toBe('Nov 20')
    // 02:30 UTC on the 21st is still the evening of the 20th in Texas.
    expect(missDayWords('2026-11-21T02:30:00Z', NOW)).toBe('Nov 20')
  })

  it('carries the year when it is not this one', () => {
    expect(missDayWords('2027-01-03T18:00:00Z', NOW)).toBe('Jan 3, 2027')
  })

  it('is empty for a day nobody can read', () => {
    expect(missDayWords(null, NOW)).toBe('')
    expect(missDayWords('nope', NOW)).toBe('')
  })

  it('says when it was checked and when the app asks again, each day a value', () => {
    const s = missCheckedSentence('2026-11-20T18:00:00Z', NOW)
    expect(plainSentence(s)).toBe('Checked Nov 20. The app asks again by itself on Dec 20.')
    expect(sentenceParts(s).filter((p) => typeof p !== 'string')).toEqual([
      { kind: 'day', text: 'Nov 20' },
      { kind: 'day', text: 'Dec 20' },
    ])
  })

  it('says nothing for a miss nobody kept', () => {
    expect(missCheckedSentence(undefined, NOW)).toBe('')
  })
})

describe('what Try again found', () => {
  it('placed: the address is in the results', () => {
    expect(tryAgainOutcome({ results: [{ address_normalized: KEY, lat: 29.5, lng: -98.5 }], failures: [] }, KEY)).toEqual({ kind: 'placed' })
  })

  it('still no match, and the function kept the miss again: the day is the one it answered with', () => {
    const o = tryAgainOutcome({ results: [], failures: [{ address_normalized: KEY, error_code: 'not_found', detail: 'OpenStreetMap (Nominatim) HTTP 403; no match from Google; no match from US Census', checked_at: NOW }] }, KEY)
    expect(o).toEqual({ kind: 'missed', reason: 'No map service could find this address.', checkedAt: NOW })
    expect(tryAgainWords(o)).toBe('Still no match. Open the record and fix the address to place it.')
    // The row's own line carries the new day.
    expect(plainSentence(missCheckedSentence(o.kind === 'missed' ? o.checkedAt : null, NOW))).toBe('Checked Nov 24. The app asks again by itself on Dec 24.')
  })

  it('Google or the Census did not answer: nothing was kept, and the words say so with the reason', () => {
    const o = tryAgainOutcome({ results: [], failures: [{ address_normalized: KEY, error_code: 'google_over_query' }] }, KEY)
    expect(o).toEqual({ kind: 'missed', reason: 'Google is taking no more look-ups right now. Try again later.', checkedAt: null })
    expect(tryAgainWords(o)).toBe('Not placed. Nothing was kept, so the app asks again on the next open. Google is taking no more look-ups right now. Try again later.')
  })

  it('a not found with no day kept nothing either: a training account, or a function that predates the day', () => {
    const o = tryAgainOutcome({ results: [], failures: [{ address_normalized: KEY, error_code: 'not_found' }] }, KEY)
    expect(o).toMatchObject({ kind: 'missed', checkedAt: null })
    expect(tryAgainOutcome({ results: [], failures: [{ address_normalized: KEY, error_code: 'not_found', checked_at: 'not a day' }] }, KEY)).toMatchObject({ checkedAt: null })
  })

  it('an answer with nothing for this address is a failed ask, never a silent pass', () => {
    for (const data of [null, undefined, {}, { results: [], failures: [] }, { failures: [{ address_normalized: 'another key', error_code: 'not_found' }] }, 'words']) {
      expect(tryAgainOutcome(data, KEY).kind).toBe('failed')
    }
  })

  it('placed and failed say what happened', () => {
    expect(tryAgainWords({ kind: 'placed' })).toBe('Placed. The map is reloading with it.')
    expect(tryAgainWords({ kind: 'failed', reason: 'Lost signal.' })).toBe('Could not ask the map services. Lost signal.')
  })
})

describe('Try again on a row that carries its own address box (punch list #441)', () => {
  it('points at the box, since the row opens no record to fix', () => {
    expect(tryAgainWords({ kind: 'placed' }, 'box')).toBe('Placed. Its pin is on the map.')
    expect(tryAgainWords({ kind: 'missed', reason: 'No map service could find this address.', checkedAt: NOW }, 'box')).toBe('Still no match. Fix the address in the box and save to place it.')
  })

  it('says a miss nobody kept and a failed ask in the list\'s own words', () => {
    const notKept = { kind: 'missed', reason: 'Google is taking no more look-ups right now. Try again later.', checkedAt: null } as const
    expect(tryAgainWords(notKept, 'box')).toBe(tryAgainWords(notKept))
    const failed = { kind: 'failed', reason: 'Lost signal.' } as const
    expect(tryAgainWords(failed, 'box')).toBe(tryAgainWords(failed))
  })
})

describe('the misses the function kept while it answered (punch list #441)', () => {
  it('are the failures that carry a day, as rows of the memory', () => {
    const data = {
      results: [{ address_normalized: 'a placed key', lat: 1, lng: 2 }],
      failures: [
        { address_normalized: KEY, error_code: 'not_found', detail: 'no match from Google; no match from US Census', checked_at: NOW },
        { address_normalized: 'a second made up key', error_code: 'not_found', checked_at: NOW },
        // Google did not answer: nothing was kept, so there is no day to say.
        { address_normalized: 'a third made up key', error_code: 'google_over_query' },
        { address_normalized: 'a fourth made up key', error_code: 'not_found', checked_at: 'not a day' },
      ],
    }
    expect(keptMissesInAnswer(data)).toEqual([
      { address_normalized: KEY, error_code: 'not_found', detail: 'no match from Google; no match from US Census', checked_at: NOW },
      { address_normalized: 'a second made up key', error_code: 'not_found', detail: null, checked_at: NOW },
    ])
  })

  it('is empty for an answer nobody can read', () => {
    for (const data of [null, undefined, {}, 'words', { failures: 'words' }, { failures: [null, { error_code: 'not_found', checked_at: NOW }] }]) {
      expect(keptMissesInAnswer(data)).toEqual([])
    }
  })
})
