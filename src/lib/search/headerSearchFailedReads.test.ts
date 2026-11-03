import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  HEADER_SEARCH_OFFLINE_MESSAGE,
  headerSearchFailedLines,
  headerSearchFailedRead,
  headerSearchNotSearchedWords,
  headerSearchNothingMatchedWords,
  type HeaderSearchFailedRead,
} from './headerSearchFailedReads'

/** The error a Supabase result carries when the fetch layer never reached the server. */
const LOST_SIGNAL = { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' }
/** The error a Supabase result carries when RLS refuses the read. */
const REFUSED = { message: 'permission denied for function search_jobs_ledger', details: null, hint: null, code: '42501' }

describe('headerSearchFailedReads', () => {
  it('names the kinds a failure kept from being searched, in the box’s order, one and many', () => {
    expect(headerSearchNotSearchedWords(['jobs'], 'office')).toBe('Jobs were not searched.')
    expect(headerSearchNotSearchedWords(['bids', 'jobs'], 'office')).toBe('Jobs and bids were not searched.')
    expect(headerSearchNotSearchedWords(['customers', 'estimates', 'bids', 'jobs'], 'office')).toBe('Jobs, bids, estimates and customers were not searched.')
    expect(headerSearchNotSearchedWords(['jobs'], 'field')).toBe('Your jobs were not searched.')
    expect(headerSearchNotSearchedWords([], 'office')).toBe('')
  })

  it('a lost signal is told by its kind and a refusal by its code, each with the kind’s own lead', () => {
    const lost = headerSearchFailedRead('jobs', LOST_SIGNAL, 'office')
    expect(lost.kind).toBe('jobs')
    expect(lost.failure.kind).toBe('network')
    const refused = headerSearchFailedRead('bids', REFUSED, 'office')
    expect(refused.failure.kind).toBe('server')
    expect(refused.failure.message).toBe("Could not search bids. You don't have access to this record.")
    // A bare Error with no code keeps its own words, as `formatErrorMessage` gives them.
    const thrown = headerSearchFailedRead('jobs', new Error('boom'), 'field')
    expect(thrown.failure.kind).toBe('unknown')
    expect(thrown.failure.message).toBe('boom')
  })

  it('four reads lost to the same signal are one line with one failure; a refusal beside them is its own line', () => {
    const lost = (kind: HeaderSearchFailedRead['kind']) => headerSearchFailedRead(kind, LOST_SIGNAL, 'office')
    const lines = headerSearchFailedLines([lost('customers'), lost('jobs'), lost('estimates'), lost('bids')], 'office')
    expect(lines).toHaveLength(1)
    expect(lines[0]!.kinds).toEqual(['jobs', 'bids', 'estimates', 'customers'])
    expect(lines[0]!.words).toBe('Jobs, bids, estimates and customers were not searched.')
    expect(lines[0]!.failure.kind).toBe('network')
    expect(lines[0]!.offlineMessage).toBe(HEADER_SEARCH_OFFLINE_MESSAGE)

    const mixed = headerSearchFailedLines([lost('jobs'), headerSearchFailedRead('bids', REFUSED, 'office'), lost('customers')], 'office')
    expect(mixed.map((l) => l.words)).toEqual(['Jobs and customers were not searched.', 'Bids were not searched.'])
    expect(mixed.map((l) => l.failure.kind)).toEqual(['network', 'server'])
    expect(headerSearchFailedLines([], 'office')).toEqual([])
  })

  it('with nothing to show, the box says what was searched and found nothing, never No matches', () => {
    const lost = (kind: HeaderSearchFailedRead['kind']) => headerSearchFailedRead(kind, LOST_SIGNAL, 'office')
    expect(headerSearchNothingMatchedWords([lost('jobs')], 'office')).toBe('Nothing matched in bids, estimates, customers, pages, settings and guides.')
    expect(headerSearchNothingMatchedWords([lost('jobs'), lost('bids'), lost('estimates'), lost('customers')], 'office')).toBe('Nothing matched in pages, settings and guides.')
    expect(headerSearchNothingMatchedWords([headerSearchFailedRead('jobs', LOST_SIGNAL, 'field')], 'field')).toBe('Nothing matched in the guides for your role.')
  })

  it('every sentence is plain words', () => {
    const lost = (kind: HeaderSearchFailedRead['kind']) => headerSearchFailedRead(kind, LOST_SIGNAL, 'office')
    const all = [
      headerSearchNotSearchedWords(['jobs'], 'office'),
      headerSearchNotSearchedWords(['jobs', 'bids', 'estimates', 'customers'], 'office'),
      headerSearchNotSearchedWords(['jobs'], 'field'),
      HEADER_SEARCH_OFFLINE_MESSAGE,
      headerSearchNothingMatchedWords([lost('jobs')], 'office'),
      headerSearchNothingMatchedWords([lost('jobs'), lost('bids'), lost('estimates'), lost('customers')], 'office'),
      headerSearchNothingMatchedWords([headerSearchFailedRead('jobs', LOST_SIGNAL, 'field')], 'field'),
      headerSearchFailedRead('bids', REFUSED, 'office').failure.message,
    ]
    expect(all.flatMap((t) => plainWordsFailures(t))).toEqual([])
  })
})
