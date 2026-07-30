import { describe, expect, it } from 'vitest'
import { findJobsByNumber, stagesSectionKeyForJobRow } from './stagesJobNumberJump'

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
