import { describe, expect, it } from 'vitest'
import { jobInSubject, type SubjectJob } from './jobInSubject'

const boerne: SubjectJob = { key: 'bid:b1', labels: ['BP523'], name: 'Boerne Retail Shell', mine: true }
const stoneOak: SubjectJob = { key: 'project:p1', labels: ['#42'], name: 'Stone Oak Pharmacy', mine: false }
const fairOaks: SubjectJob = { key: 'pipeline:j1', labels: ['JP1077', 'C88'], name: 'Fair Oaks Shops, Building D', mine: true }

describe('jobInSubject', () => {
  it('a number standing alone names its job, in any case', () => {
    expect(jobInSubject('Hillside sitework, bp523, rev 1', [boerne, stoneOak, fairOaks])).toBe('bid:b1')
    expect(jobInSubject('Re: #42 start date', [boerne, stoneOak, fairOaks])).toBe('project:p1')
    expect(jobInSubject('Pay app 3 (JP1077)', [boerne, stoneOak, fairOaks])).toBe('pipeline:j1')
  })

  it('a number inside a longer one names nothing', () => {
    expect(jobInSubject('Invoice BP5230', [boerne])).toBeNull()
    expect(jobInSubject('Lot #421', [stoneOak])).toBeNull()
  })

  it("one the sender is on wins; two of theirs name none", () => {
    const otherBoerne: SubjectJob = { key: 'bid:b2', labels: ['BP523'], name: 'Another job', mine: false }
    expect(jobInSubject('BP523 numbers', [otherBoerne, boerne])).toBe('bid:b1')
    expect(jobInSubject('BP523 numbers', [{ ...otherBoerne, mine: true }, boerne])).toBeNull()
  })

  it("a name names one of the sender's own jobs, when no number does", () => {
    expect(jobInSubject('Boerne Retail Shell, Addendum 2', [boerne, stoneOak])).toBe('bid:b1')
    expect(jobInSubject('Stone Oak Pharmacy start', [boerne, stoneOak])).toBeNull()
    expect(jobInSubject('fair oaks shops, building d: pay app', [fairOaks])).toBe('pipeline:j1')
  })

  it('a short number or name, an empty subject, or two names name nothing', () => {
    expect(jobInSubject('#4 again', [{ ...stoneOak, labels: ['#4'] }])).toBeNull()
    expect(jobInSubject('Shell', [{ ...boerne, labels: [], name: 'Shell' }])).toBeNull()
    expect(jobInSubject('   ', [boerne])).toBeNull()
    expect(jobInSubject('Boerne Retail Shell and Fair Oaks Shops, Building D', [boerne, fairOaks])).toBeNull()
  })
})
