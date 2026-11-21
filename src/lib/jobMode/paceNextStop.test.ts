import { describe, expect, it } from 'vitest'
import { PACE_NEXT_STOP_WORDS, paceNextStopJobId } from './paceNextStop'

describe('paceNextStopJobId: Job pace for the next stop when the card has no job of its own', () => {
  const base = { role: 'superintendent', hasOwnJob: false, onAJob: false, nextJobId: 'job-2', closed: false }
  it('draws for the next stop when he is clocked in with no job linked, or onto a bid', () => {
    expect(paceNextStopJobId(base)).toBe('job-2')
  })
  it('draws nothing when the card already shows a job: that job has the pace card', () => {
    expect(paceNextStopJobId({ ...base, hasOwnJob: true })).toBeNull()
  })
  it('draws nothing while the job he is clocked on is still loading: its own card follows', () => {
    expect(paceNextStopJobId({ ...base, onAJob: true })).toBeNull()
  })
  it('draws nothing with no stop left in the day', () => {
    expect(paceNextStopJobId({ ...base, nextJobId: null })).toBeNull()
    expect(paceNextStopJobId({ ...base, nextJobId: '' })).toBeNull()
  })
  it('draws nothing for a job whose papers still close it to him', () => {
    expect(paceNextStopJobId({ ...base, closed: true })).toBeNull()
  })
  it('is the superintendent’s card alone', () => {
    for (const role of ['subcontractor', 'helpers', 'primary', 'master_technician', 'dev', null]) expect(paceNextStopJobId({ ...base, role })).toBeNull()
  })
  it('names the stop', () => {
    expect(PACE_NEXT_STOP_WORDS.stop('PLUM 2210 · Maple Court')).toBe('Next stop: PLUM 2210 · Maple Court')
  })
})
