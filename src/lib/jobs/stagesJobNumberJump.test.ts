import { describe, expect, it } from 'vitest'
import { findJobsByNumber, resolvePendingNumberJump, stagesSectionKeyForJobRow } from './stagesJobNumberJump'

const job = (id: string, o: Partial<Parameters<typeof findJobsByNumber>[0][number]> = {}) => ({
  id,
  status: 'working',
  hcp_number: '',
  click_number: '',
  ...o,
})

describe('findJobsByNumber', () => {
  const jobs = [
    job('a', { hcp_number: '878' }),
    job('b', { click_number: '87' }),
    job('c', { hcp_number: '8790' }),
    job('d', { click_number: '913' }),
    job('e', { hcp_number: '87', click_number: '940' }),
  ]

  it('puts exact matches (either number) before prefix matches, input-order within tiers', () => {
    expect(findJobsByNumber(jobs, '87').map((j) => j.id)).toEqual(['b', 'e', 'a', 'c'])
    expect(findJobsByNumber(jobs, '878').map((j) => j.id)).toEqual(['a'])
    expect(findJobsByNumber(jobs, '940').map((j) => j.id)).toEqual(['e'])
  })

  it('strips non-digits and returns [] for empty or no-hit input', () => {
    expect(findJobsByNumber(jobs, ' #913 ').map((j) => j.id)).toEqual(['d'])
    expect(findJobsByNumber(jobs, '')).toEqual([])
    expect(findJobsByNumber(jobs, 'abc')).toEqual([])
    expect(findJobsByNumber(jobs, '555')).toEqual([])
  })

  it('never matches on empty number fields', () => {
    expect(findJobsByNumber([job('x')], '0')).toEqual([])
  })
})

describe('stagesSectionKeyForJobRow', () => {
  it('maps every board section, splitting billed by collections_at', () => {
    expect(stagesSectionKeyForJobRow({ status: 'waiting' })).toBe('waiting')
    expect(stagesSectionKeyForJobRow({ status: 'working' })).toBe('working')
    expect(stagesSectionKeyForJobRow({ status: 'ready_to_bill' })).toBe('readyToBill')
    expect(stagesSectionKeyForJobRow({ status: 'billed', collections_at: null })).toBe('billed')
    expect(stagesSectionKeyForJobRow({ status: 'billed', collections_at: '2026-07-01' })).toBe('collections')
    expect(stagesSectionKeyForJobRow({ status: 'paid' })).toBe('paid')
    expect(stagesSectionKeyForJobRow({ status: null })).toBe('working')
    expect(stagesSectionKeyForJobRow({ status: 'unknown' })).toBeNull()
  })
})

describe('resolvePendingNumberJump', () => {
  const board = [job('w', { hcp_number: '878' })]
  const withPaid = [...board, job('p', { hcp_number: '959' })]

  it('a hit is final immediately, even mid paid fetch', () => {
    const res = resolvePendingNumberJump({ jobs: withPaid, digits: '959', paidJobsLoading: true, paidMergedForCurrentKey: false, mainListBusy: false })
    expect(res).toEqual({ done: true, matches: [withPaid[1]] })
  })

  it('keeps waiting while the paid fetch is loading and nothing matches yet', () => {
    expect(
      resolvePendingNumberJump({ jobs: board, digits: '959', paidJobsLoading: true, paidMergedForCurrentKey: false, mainListBusy: false }),
    ).toEqual({ done: false })
  })

  it('paid rows merged and still no match -> final miss', () => {
    const res = resolvePendingNumberJump({ jobs: withPaid, digits: '555', paidJobsLoading: false, paidMergedForCurrentKey: true, mainListBusy: false })
    expect(res).toEqual({ done: true, matches: [] })
  })

  it('fetch failed (not loading, not merged) -> gives up with the current match instead of spinning', () => {
    const res = resolvePendingNumberJump({ jobs: board, digits: '959', paidJobsLoading: false, paidMergedForCurrentKey: false, mainListBusy: false })
    expect(res).toEqual({ done: true, matches: [] })
  })

  it('waits while the MAIN list is busy — the paid fetch cannot start yet (v2.1813 prod race)', () => {
    expect(
      resolvePendingNumberJump({ jobs: board, digits: '959', paidJobsLoading: false, paidMergedForCurrentKey: false, mainListBusy: true }),
    ).toEqual({ done: false })
  })

  it('merged paid rows are final even while the main list refreshes', () => {
    expect(
      resolvePendingNumberJump({ jobs: withPaid, digits: '555', paidJobsLoading: false, paidMergedForCurrentKey: true, mainListBusy: true }),
    ).toEqual({ done: true, matches: [] })
  })
})
