import { describe, expect, it } from 'vitest'
import { inHouseWords, offerAmountOf, offerDraftProblem, offerExpiryOnLine, offerExpiryWhat, offerFirmKindWords, offerHoldKey, offerKindWords, offerMetaOf, offerStatusWords } from './legalOffers'

const TODAY = '2026-10-25'

describe('offers (punch list #172, v2.5847)', () => {
  it('reads an offer’s meta defensively', () => {
    expect(offerMetaOf(null)).toEqual({ direction: 'made', expiresOn: null, status: 'open', notes: '', statusNote: '', source: 'office' })
    expect(offerMetaOf({ direction: 'received', expires_on: '2026-11-11', status: 'countered', notes: 'n', status_note: 's', source: 'mcp' })).toEqual({ direction: 'received', expiresOn: '2026-11-11', status: 'countered', notes: 'n', statusNote: 's', source: 'mcp' })
    expect(offerMetaOf({ expires_on: 'soon', status: 'bogus' })).toEqual(expect.objectContaining({ expiresOn: null, status: 'open' }))
  })
  it('reads the amount typed and refuses a bad draft', () => {
    expect(offerAmountOf('$12,500.50')).toBe(12500.5)
    expect(offerAmountOf('0')).toBeNull()
    expect(offerAmountOf('abc')).toBeNull()
    const ok = { direction: 'made' as const, amountText: '12,500', on: '2026-10-24', expiresOn: '2026-11-11', notes: '' }
    expect(offerDraftProblem(ok, TODAY)).toBeNull()
    expect(offerDraftProblem({ ...ok, amountText: '' }, TODAY)).toBe('Type the offer’s amount.')
    expect(offerDraftProblem({ ...ok, on: '' }, TODAY)).toBe('Pick the day.')
    expect(offerDraftProblem({ ...ok, on: '2026-10-26' }, TODAY)).toBe('The day cannot be ahead of today.')
    expect(offerDraftProblem({ ...ok, expiresOn: '2026-10-01' }, TODAY)).toBe('An offer cannot expire before it was made.')
    expect(offerDraftProblem({ ...ok, expiresOn: '' }, TODAY)).toBeNull()
  })
  it('words the kind, the status, the expiry item and the in-house header', () => {
    const made = offerMetaOf({ direction: 'made', expires_on: '2026-11-11', status: 'open' })
    expect(offerKindWords(made)).toBe('offer made')
    expect(offerFirmKindWords(offerMetaOf({ direction: 'received' }))).toBe('offer the office received')
    expect(offerStatusWords('withdrawn')).toBe('Withdrawn')
    expect(offerExpiryOnLine(made)).toBe('2026-11-11')
    expect(offerExpiryOnLine(offerMetaOf({ direction: 'made', expires_on: '2026-11-11', status: 'accepted' }))).toBeNull()
    expect(offerExpiryOnLine(offerMetaOf({ direction: 'made' }))).toBeNull()
    expect(offerExpiryWhat(made, '$12,500.00')).toBe('Offer made expires · $12,500.00')
    expect(offerHoldKey('x')).toBe('offer:x')
    expect(inHouseWords('Oct 25', 'counsel away until Nov 3')).toBe('In house since Oct 25 · counsel away until Nov 3')
    expect(inHouseWords('', '')).toBe('In house')
  })
})
