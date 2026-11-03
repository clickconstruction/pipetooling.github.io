import { describe, expect, it } from 'vitest'
import { jobEarned } from './jobEarned'

describe('jobEarned', () => {
  it('a finished job earns the whole contract, no flag', () => {
    expect(jobEarned({ contractUsd: 241431, pct: 100, finished: true })).toEqual({ usd: 241431, flags: [] })
  })
  it('a working job earns the percent’s share and is flagged earned', () => {
    expect(jobEarned({ contractUsd: 16000, pct: 20, finished: false })).toEqual({ usd: 3200, flags: ['earned'] })
  })
  it('no percent on record earns half, flagged assumed', () => {
    expect(jobEarned({ contractUsd: 54514, pct: null, finished: false })).toEqual({ usd: 27257, flags: ['assumed-50', 'earned'] })
  })
  it('no price earns nothing and is not flagged earned', () => {
    expect(jobEarned({ contractUsd: 0, pct: 75, finished: false })).toEqual({ usd: 0, flags: [] })
    expect(jobEarned({ contractUsd: 0, pct: null, finished: false })).toEqual({ usd: 0, flags: ['assumed-50'] })
  })
})
