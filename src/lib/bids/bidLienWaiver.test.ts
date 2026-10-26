import { describe, expect, it } from 'vitest'
import {
  BID_LIEN_WAIVER_COMPANY_DEFAULT,
  bidLienWaiverOutputsHeld,
  bidLienWaiverPaper,
  bidLienWaiverPayor,
  bidLienWaiverPrefill,
  canSendUnconditionalFromBid,
} from './bidLienWaiver'

describe('bidLienWaiverPrefill', () => {
  it('fills the payor from the GC first, the customer second', () => {
    expect(bidLienWaiverPayor({ bids_gc_builders: { name: 'Southern Post' }, customers: { name: 'Take 5' } })).toBe('Southern Post')
    expect(bidLienWaiverPayor({ bids_gc_builders: null, customers: { name: 'Take 5' } })).toBe('Take 5')
    expect(bidLienWaiverPayor({})).toBe('')
  })

  it('prefills the amount from agreed value over bid value, as a money input string', () => {
    const f = bidLienWaiverPrefill({ agreed_value: 38625, bid_value: 40000 }, '2026-10-26')
    expect(f.amount).toBe('38625.00')
    expect(bidLienWaiverPrefill({ bid_value: 1234.5 }, '2026-10-26').amount).toBe('1234.50')
    expect(bidLienWaiverPrefill({}, '2026-10-26').amount).toBe('')
  })

  it('joins project name and address with an em dash and dates both boxes today', () => {
    const f = bidLienWaiverPrefill({ project_name: 'Take 5 Seguin', address: '380 TX-123, Seguin, TX 78155' }, '2026-10-26')
    expect(f.projectDescription).toBe('Take 5 Seguin — 380 TX-123, Seguin, TX 78155')
    expect(f.throughDate).toBe('2026-10-26')
    expect(f.signedDate).toBe('2026-10-26')
    expect(f.companyName).toBe(BID_LIEN_WAIVER_COMPANY_DEFAULT)
    expect(bidLienWaiverPrefill({ project_name: 'Take 5 Seguin' }, '2026-10-26').projectDescription).toBe('Take 5 Seguin')
  })
})

describe('bidLienWaiverPaper', () => {
  it("draws the kernel's own words for the chosen form", () => {
    const fields = bidLienWaiverPrefill({ project_name: 'Take 5 Seguin', address: '380 TX-123', agreed_value: 34825, bids_gc_builders: { name: 'Southern Post' } }, '2026-10-26')
    const conditional = bidLienWaiverPaper('conditional_progress', fields)
    expect(conditional.title).toBe('Conditional Waiver and Release on Progress Payment')
    expect(conditional.paragraphs.join(' ')).toContain('Upon receipt by the undersigned of a check from Southern Post in the sum of $34,825.00')
    const unconditional = bidLienWaiverPaper('unconditional_progress', fields)
    expect(unconditional.paragraphs.join(' ')).toContain('This release does not affect any retainage, pending change orders, or disputed claims for extra work.')
    expect(unconditional.foot.company).toBe(BID_LIEN_WAIVER_COMPANY_DEFAULT)
  })
})

describe('the leader gate', () => {
  it('holds unconditional outputs for everyone but the leaders and the controller', () => {
    expect(canSendUnconditionalFromBid('master_technician')).toBe(true)
    expect(canSendUnconditionalFromBid('controller')).toBe(true)
    expect(canSendUnconditionalFromBid('dev')).toBe(true)
    expect(canSendUnconditionalFromBid('estimator')).toBe(false)
    expect(canSendUnconditionalFromBid('assistant')).toBe(false)
    expect(canSendUnconditionalFromBid(null)).toBe(false)
    expect(bidLienWaiverOutputsHeld('unconditional_progress', 'estimator')).toBe(true)
    expect(bidLienWaiverOutputsHeld('unconditional_final', 'estimator')).toBe(true)
    expect(bidLienWaiverOutputsHeld('unconditional_progress', 'master_technician')).toBe(false)
    expect(bidLienWaiverOutputsHeld('conditional_progress', 'estimator')).toBe(false)
    expect(bidLienWaiverOutputsHeld('conditional_final', 'estimator')).toBe(false)
  })
})
