import { describe, expect, it } from 'vitest'
import { bidInSubject } from './bidInSubject'

describe('bidInSubject (v2.6231)', () => {
  const bids = [
    { id: 'b1', project_name: 'Oak Hill Clinic, Boerne' },
    { id: 'b2', project_name: 'Oak Hill Clinic, Boerne Phase 2' },
    { id: 'b3', project_name: 'Shell' },
    { id: 'b4', project_name: 'Fire Station 9 Make Ready' },
    { id: 'b5', project_name: null },
  ]

  it('names the live bid whose name the subject carries, the longest when one holds another', () => {
    expect(bidInSubject('Addendum 2 - Oak Hill Clinic, Boerne', bids)).toBe('bid:b1')
    expect(bidInSubject('Re: Oak Hill Clinic,  Boerne Phase 2 site visit', bids)).toBe('bid:b2')
    expect(bidInSubject('FIRE STATION 9 MAKE READY: plans posted', bids)).toBe('bid:b4')
  })

  it('names nothing for a short name, a name run into other letters, two bids named the same, or no subject', () => {
    expect(bidInSubject('The shell is ready', bids)).toBeNull()
    expect(bidInSubject('Fire Station 9 Make Readyx', bids)).toBeNull()
    expect(bidInSubject('Oak Hill Clinic, Boerne', [...bids, { id: 'b6', project_name: 'Oak Hill Clinic, Boerne' }])).toBeNull()
    expect(bidInSubject('   ', bids)).toBeNull()
    expect(bidInSubject('Invoice 4471', bids)).toBeNull()
  })
})
