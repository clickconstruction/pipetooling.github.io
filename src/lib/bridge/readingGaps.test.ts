import { describe, expect, it } from 'vitest'
import { buildReadingGaps, type ReadingGapsInput } from './readingGaps'

const base: ReadingGapsInput = {
  pendingClosedHours: 0,
  pendingClosedSessions: 0,
  headlineRecordedUsd: null,
  headlineApprovedUsd: null,
  bankUsd: null,
  typedRolledUsd: null,
  typedLabel: null,
  typedDaysAgo: null,
  assumedHalfJobs: 0,
  assumedHalfEarnedUsd: 0,
  noContractJobs: [],
  unattributedNoncard: null,
  unlinkedCard: null,
  overheadPerDayUsd: 348,
  bidsNoValue: 0,
}

describe('buildReadingGaps', () => {
  it('is empty with nothing to fix', () => {
    expect(buildReadingGaps(base)).toEqual([])
  })

  it('names each gap with what it moves and its door, dollars first and biggest first', () => {
    const gaps = buildReadingGaps({
      ...base,
      pendingClosedHours: 585,
      pendingClosedSessions: 104,
      headlineRecordedUsd: 38_300,
      headlineApprovedUsd: 9700,
      bankUsd: 390,
      typedRolledUsd: 32_100,
      typedLabel: 'Sep 3',
      typedDaysAgo: 37,
      assumedHalfJobs: 6,
      assumedHalfEarnedUsd: 20_341,
      noContractJobs: [{ id: 'a', label: '912' }, { id: 'b', label: '1067' }],
      unattributedNoncard: 1151,
      unlinkedCard: 35,
      bidsNoValue: 2,
    })
    expect(gaps.map((g) => g.key)).toEqual(['cash_drift', 'unapproved', 'assumed_half', 'no_contract', 'transfers', 'card', 'bids_no_value'])
    expect(gaps[0]).toMatchObject({ chip: '$31.7k of bank flows not in the app', movesUsd: 31_710, door: { to: '/banking?tab=accounting', label: 'Sort' } })
    expect(gaps[0]?.moves).toBe('the figure typed Sep 3 rolled through the ledger reads $32.1k, the bank says $390; the net-position history is off by the same')
    expect(gaps[1]).toMatchObject({ chip: '585h unapproved', moves: 'moves the headline from +$9.7k to ≈ +$38.3k this week; payroll reads low until then', movesUsd: 28_600, count: 104, door: { to: '/people?tab=hours&approvals=1', label: 'Approve' } })
    expect(gaps[2]).toMatchObject({ chip: '6 jobs worked this window with no % complete', movesUsd: 20_341 })
    expect(buildReadingGaps({ ...base, assumedHalfJobs: 1, assumedHalfEarnedUsd: 4_000 }).find((g) => g.key === 'assumed_half')!.chip).toBe('1 job worked this window with no % complete')
    expect(gaps[3]?.moves).toBe('their hours earned $0 and every day on them reads red: 912, 1067; put the price on the job')
    expect(gaps[4]?.moves).toBe('rent, insurance, trucks and loans in there hit the bank and never the paper; overhead reads $348/day and is not')
    expect(gaps[5]).toMatchObject({ chip: '35 card purchases unsorted', door: { to: '/jobs?tab=parts' } })
    expect(gaps[6]).toMatchObject({ chip: '2 bids sent with no value', door: { to: '/bids' } })
  })

  it('a typed figure with no bank read is its own gap; a bank read within $1,000 of the typed figure is none', () => {
    const typed = buildReadingGaps({ ...base, bankUsd: null, typedRolledUsd: 32_100, typedLabel: 'Sep 3', typedDaysAgo: 37, unattributedNoncard: 1151 })
    expect(typed.map((g) => g.key)).toEqual(['cash_typed', 'transfers'])
    expect(typed[0]?.moves).toBe('rolled 37 days through bank flows that include 1,151 unsorted transfers; the bank could not be read')
    expect(buildReadingGaps({ ...base, bankUsd: 32_000, typedRolledUsd: 32_500, typedLabel: 'Sep 3', typedDaysAgo: 37 })).toEqual([])
  })

  it('unapproved hours with no headline yet still read', () => {
    const [g] = buildReadingGaps({ ...base, pendingClosedHours: 12, pendingClosedSessions: 3 })
    expect(g).toMatchObject({ key: 'unapproved', moves: '3 sessions; the headline and payroll read low until then', movesUsd: null })
  })
})
