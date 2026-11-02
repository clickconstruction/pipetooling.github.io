import { describe, expect, it } from 'vitest'
import { clockOutJob, clockOutPickOf } from './clockOutJob'

const onJob = { job_ledger_id: 'job-1', bid_id: null }
const onBid = { job_ledger_id: null, bid_id: 'bid-1' }
const onNothing = { job_ledger_id: null, bid_id: null }

describe('clockOutJob · which job a clock-out sends', () => {
  it('keeps the session’s own job when the pick was never touched, read back or not', () => {
    // The window's read failed with no signal: the pick is empty and the person did nothing to it.
    expect(clockOutJob({ pick: null, touched: false, session: onJob })).toEqual({ jobLedgerId: 'job-1', bidId: null, kept: true })
    // The read landed: the pick is the session's own job, and the answer is the same.
    expect(clockOutJob({ pick: { source: 'job', id: 'job-1' }, touched: false, session: onJob })).toEqual({ jobLedgerId: 'job-1', bidId: null, kept: true })
  })

  it('keeps the session’s own bid the same way', () => {
    expect(clockOutJob({ pick: null, touched: false, session: onBid })).toEqual({ jobLedgerId: null, bidId: 'bid-1', kept: true })
  })

  it('sends nothing for a session that was on nothing, with nothing to keep', () => {
    expect(clockOutJob({ pick: null, touched: false, session: onNothing })).toEqual({ jobLedgerId: null, bidId: null, kept: true })
  })

  it('sends the job or bid the person picked', () => {
    expect(clockOutJob({ pick: { source: 'job', id: 'job-2' }, touched: true, session: onJob })).toEqual({ jobLedgerId: 'job-2', bidId: null, kept: false })
    expect(clockOutJob({ pick: { source: 'bid', id: 'bid-2' }, touched: true, session: onJob })).toEqual({ jobLedgerId: null, bidId: 'bid-2', kept: false })
  })

  it('sends none when the person pressed Clear, since that removes the job on purpose', () => {
    expect(clockOutJob({ pick: null, touched: true, session: onJob })).toEqual({ jobLedgerId: null, bidId: null, kept: false })
    expect(clockOutJob({ pick: null, touched: true, session: onBid })).toEqual({ jobLedgerId: null, bidId: null, kept: false })
  })
})

describe('clockOutPickOf · the pick from the window’s row', () => {
  it('is the job or bid row, and nothing for no row or a row of another kind', () => {
    expect(clockOutPickOf({ source: 'job', id: 'job-2' })).toEqual({ source: 'job', id: 'job-2' })
    expect(clockOutPickOf({ source: 'bid', id: 'bid-2' })).toEqual({ source: 'bid', id: 'bid-2' })
    expect(clockOutPickOf(null)).toBeNull()
    expect(clockOutPickOf({ source: 'customer', id: 'c-1' })).toBeNull()
  })
})
