import { describe, expect, it } from 'vitest'

import { bidNumbersAcross, bidNumbersIn, bidRefHref, resolveBidRefId, splitBidRefs, trailingBidRef } from './twinQuestionBidRefs'

const Q = '[audit b474 / footage · sheet P2.01] Your 4in sanitary is 50 ft, and the underfloor 4in main scales at well over 100 ft.'

describe('splitBidRefs', () => {
  it('lifts "b474" out of the audit prefix and leaves the prose alone', () => {
    expect(splitBidRefs(Q)).toEqual([
      { kind: 'text', text: '[audit ' },
      { kind: 'bid', text: 'b474', number: '474' },
      { kind: 'text', text: ' / footage · sheet P2.01] Your 4in sanitary is 50 ft, and the underfloor 4in main scales at well over 100 ft.' },
    ])
  })

  it('accepts B and bp prefixes, and needs a word boundary on both sides', () => {
    expect(splitBidRefs('B398 and bp391').filter((s) => s.kind === 'bid').map((s) => s.text)).toEqual(['B398', 'bp391'])
    expect(splitBidRefs('sub12 4b5 b12x').filter((s) => s.kind === 'bid')).toEqual([])
    expect(splitBidRefs('4in main from b2 restrooms').filter((s) => s.kind === 'bid').map((s) => s.number)).toEqual(['2'])
  })

  it('returns one text segment for prose with no reference, and nothing for empty text', () => {
    expect(splitBidRefs('Which sinks get the TMV-2?')).toEqual([{ kind: 'text', text: 'Which sinks get the TMV-2?' }])
    expect(splitBidRefs('')).toEqual([])
  })
})

describe('bidNumbersIn / bidNumbersAcross', () => {
  it('dedupes within and across questions, first seen first', () => {
    expect(bidNumbersIn('b474 vs b474 vs b398')).toEqual(['474', '398'])
    expect(bidNumbersAcross(['b474 …', 'b398 …', 'b474 again', 'no ref'])).toEqual(['474', '398'])
  })
})

describe('resolveBidRefId', () => {
  it('prefers the fetched id', () => {
    expect(resolveBidRefId('474', Q, { '474': 'id-474' }, 'about-id')).toBe('id-474')
  })
  it('falls back to about_bid_id only when the question names exactly one bid', () => {
    expect(resolveBidRefId('474', Q, {}, 'about-id')).toBe('about-id')
    expect(resolveBidRefId('474', 'b474 vs b398', {}, 'about-id')).toBeNull()
    expect(resolveBidRefId('474', Q, {}, null)).toBeNull()
  })
})

describe('bidRefHref', () => {
  it('lands on the board row deep link', () => {
    expect(bidRefHref('abc')).toBe('/bids?tab=bid-board&bidId=abc')
  })
})

describe('trailingBidRef', () => {
  it('names the bid a question is about when the text never does', () => {
    expect(trailingBidRef('The plans file on this bid is not shared.', 'id-474', '474')).toEqual({ id: 'id-474', label: 'b474' })
  })
  it('stays out of the way when the text already references a bid, or nothing is known', () => {
    expect(trailingBidRef(Q, 'id-474', '474')).toBeNull()
    expect(trailingBidRef('this bid', null, '474')).toBeNull()
    expect(trailingBidRef('this bid', 'id-474', null)).toBeNull()
  })
})
