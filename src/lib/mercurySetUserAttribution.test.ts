import { describe, it, expect } from 'vitest'
import { mercuryJobSplitsToPayload } from './mercurySetUserAttribution'

describe('mercuryJobSplitsToPayload', () => {
  it('maps empty allocations to an empty array', () => {
    expect(mercuryJobSplitsToPayload([])).toEqual([])
  })

  it('coerces amount to a number and keeps job_id', () => {
    expect(mercuryJobSplitsToPayload([{ job_id: 'j1', amount: '-40.27' }])).toEqual([
      { job_id: 'j1', amount: -40.27 },
    ])
  })

  it('includes note only when present and non-blank', () => {
    expect(
      mercuryJobSplitsToPayload([
        { job_id: 'j1', amount: 10, note: 'fuel' },
        { job_id: 'j2', amount: 20, note: '   ' },
        { job_id: 'j3', amount: 30, note: null },
        { job_id: 'j4', amount: 40 },
      ]),
    ).toEqual([
      { job_id: 'j1', amount: 10, note: 'fuel' },
      { job_id: 'j2', amount: 20 },
      { job_id: 'j3', amount: 30 },
      { job_id: 'j4', amount: 40 },
    ])
  })

  it('preserves multiple splits in order (so re-passing leaves them unchanged)', () => {
    const allocs = [
      { job_id: 'a', amount: 100 },
      { job_id: 'b', amount: 200 },
    ]
    expect(mercuryJobSplitsToPayload(allocs)).toEqual(allocs)
  })
})
