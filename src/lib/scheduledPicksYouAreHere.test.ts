import { describe, expect, it } from 'vitest'
import { YOU_ARE_HERE_LABEL, orderScheduledPicksCurrentFirst } from './scheduledPicksYouAreHere'

const picks = [
  { jobId: 'j-922', hcp: '922' },
  { jobId: 'j-514', hcp: '514' },
  { jobId: 'j-101', hcp: '101' },
]

describe('orderScheduledPicksCurrentFirst', () => {
  it('moves the current job to the front and flags only it', () => {
    const out = orderScheduledPicksCurrentFirst(picks, 'j-101')
    expect(out.map((p) => p.pick.jobId)).toEqual(['j-101', 'j-922', 'j-514'])
    expect(out.map((p) => p.isCurrent)).toEqual([true, false, false])
  })

  it('keeps the incoming order for the other picks', () => {
    const out = orderScheduledPicksCurrentFirst(picks, 'j-514')
    expect(out.map((p) => p.pick.jobId)).toEqual(['j-514', 'j-922', 'j-101'])
  })

  it('leaves the list untouched when nothing is current (Clock In has no open session)', () => {
    for (const current of [null, undefined, '']) {
      const out = orderScheduledPicksCurrentFirst(picks, current)
      expect(out.map((p) => p.pick.jobId)).toEqual(['j-922', 'j-514', 'j-101'])
      expect(out.every((p) => !p.isCurrent)).toBe(true)
    }
  })

  it('flags nothing when the open session is on a job that is not on today\'s schedule', () => {
    const out = orderScheduledPicksCurrentFirst(picks, 'j-off-schedule')
    expect(out.map((p) => p.pick.jobId)).toEqual(['j-922', 'j-514', 'j-101'])
    expect(out.some((p) => p.isCurrent)).toBe(false)
  })

  it('handles an empty pick list', () => {
    expect(orderScheduledPicksCurrentFirst([], 'j-1')).toEqual([])
  })

  it('exports the label the row renders', () => {
    expect(YOU_ARE_HERE_LABEL).toBe('You are here')
  })
})
