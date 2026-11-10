import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { buildReadingGaps, type ReadingGapsInput } from './readingGaps'
import { buildSoftNumbers } from './softNumbers'

// Made-up numbers and job names.
const input: ReadingGapsInput = {
  pendingClosedHours: 93.4,
  pendingClosedSessions: 21,
  headlineRecordedUsd: 9_800,
  headlineApprovedUsd: 2_100,
  bankUsd: 18_400,
  typedRolledUsd: 31_000,
  typedLabel: 'Sep 3',
  typedDaysAgo: 68,
  assumedHalfJobs: 5,
  assumedHalfEarnedUsd: 22_600,
  noContractJobs: [
    { id: '1', label: 'Oak Hollow HOA' },
    { id: '2', label: 'Cedar Bend Dental' },
    { id: '3', label: 'Ridgeway lot 4' },
    { id: '4', label: 'Ridgeway lot 5' },
    { id: '5', label: 'Ridgeway lot 6' },
  ],
  unattributedNoncard: 1_204,
  unlinkedCard: 37,
  overheadPerDayUsd: 1_150,
  bidsNoValue: 1,
}

const none: ReadingGapsInput = { ...input, pendingClosedHours: 0, pendingClosedSessions: 0, bankUsd: 18_400, typedRolledUsd: 18_400, assumedHalfJobs: 0, noContractJobs: [], unattributedNoncard: 0, unlinkedCard: 0, bidsNoValue: 0 }

describe('buildSoftNumbers', () => {
  it('is one row for each gap the reading has, in the same order and with the same doors', () => {
    const soft = buildSoftNumbers(input)
    const gaps = buildReadingGaps(input)
    expect(soft.map((s) => s.key)).toEqual(gaps.map((g) => g.key))
    expect(soft.map((s) => s.door)).toEqual(gaps.map((g) => g.door))
    expect(soft.length).toBe(7)
    expect(buildSoftNumbers(none)).toEqual([])
  })

  it('says what is soft and what it moves', () => {
    const by = Object.fromEntries(buildSoftNumbers(input).map((s) => [s.key, s]))
    expect(by.unapproved).toMatchObject({ name: '93 hours wait on approval', moves: 'This week reads $2.1k until they are approved. With them it is about $9.8k.' })
    expect(by.cash_drift).toMatchObject({ name: '$12.6k of bank flows are not in the app', moves: 'The figure typed Sep 3 would read $31.0k today. The bank says $18.4k. Net position’s past is off by the same.' })
    expect(by.assumed_half).toMatchObject({ name: '5 jobs worked with no percent complete', moves: '$22.6k of earned rests on a guess of half done. Set the percent and the number firms up.' })
    expect(by.no_contract).toMatchObject({ name: '5 worked jobs with no price', moves: 'Their hours earn $0 until a price is on the job. They are Oak Hollow HOA, Cedar Bend Dental, Ridgeway lot 4, Ridgeway lot 5 and 1 more.' })
    expect(by.transfers).toMatchObject({ name: '1,204 bank transfers not sorted', moves: 'Rent, insurance, trucks and loans in there never reach the paper. Overhead reads $1.1k a day and is more.' })
    expect(by.card).toMatchObject({ name: '37 card purchases not sorted' })
    expect(by.bids_no_value).toMatchObject({ name: '1 bid sent with no value', moves: 'They count as $0 sent. Put the bid value on each.' })
  })

  it('reads one of each without an s, and the typed figure when the bank is not read', () => {
    const one = Object.fromEntries(buildSoftNumbers({ ...input, pendingClosedHours: 1, headlineRecordedUsd: null, assumedHalfJobs: 1, noContractJobs: [{ id: '1', label: 'Oak Hollow HOA' }], unattributedNoncard: 1, unlinkedCard: 1 }).map((s) => [s.key, s]))
    expect(one.unapproved).toMatchObject({ name: '1 hour waits on approval', moves: 'The week’s number and payroll read low until they are approved.' })
    expect(one.assumed_half?.name).toBe('1 job worked with no percent complete')
    // Nothing earned on them in the window: the sentence drops the dollars.
    expect(buildSoftNumbers({ ...none, assumedHalfJobs: 7, assumedHalfEarnedUsd: 0 })[0]?.moves).toBe('What they earned rests on a guess of half done. Set the percent and the number firms up.')
    expect(one.no_contract).toMatchObject({ name: '1 worked job with no price', moves: 'Their hours earn $0 until a price is on the job. It is Oak Hollow HOA.' })
    expect(one.transfers?.name).toBe('1 bank transfer not sorted')
    expect(one.card?.name).toBe('1 card purchase not sorted')
    const typed = Object.fromEntries(buildSoftNumbers({ ...none, bankUsd: null }).map((s) => [s.key, s]))
    expect(typed.cash_typed).toMatchObject({ name: 'Cash was typed Sep 3', moves: 'The bank could not be read. The typed figure was rolled 68 days through the bank flows.', door: null })
    expect(buildSoftNumbers({ ...none, bankUsd: null, typedDaysAgo: 0 })[0]?.moves).toBe('The bank could not be read, so the typed figure stands.')
  })

  it('writes plain words', () => {
    for (const s of [...buildSoftNumbers(input), ...buildSoftNumbers({ ...none, bankUsd: null })]) {
      expect(plainWordsFailures(s.name), s.name).toEqual([])
      expect(plainWordsFailures(s.moves), s.moves).toEqual([])
    }
  })
})
