import { describe, expect, it } from 'vitest'
import {
  lienOfferApprovedWords,
  lienOfferChipWords,
  lienOfferCost,
  lienOfferCreditCents,
  lienOfferDayProblem,
  lienOfferDefaultDay,
  lienOfferFromItem,
  lienOfferLatestDay,
  lienOfferLowAmount,
  lienOfferOnInvoice,
  lienOfferPatch,
  lienOfferPayLinkWords,
  lienOfferPayerLine,
  lienOfferRowWords,
  lienOfferSentence,
  lienOfferTotalWords,
  lienOfferWriteDownNote,
} from './lienPayOffer'

const offer = { pct: 10, by: '2026-11-15' }

describe('lienPayOffer — reading the offer', () => {
  it('reads a desk item, and nothing when the item carries no offer or a broken one', () => {
    expect(lienOfferFromItem({ offer_pct: 10, offer_by: '2026-11-15' })).toEqual(offer)
    expect(lienOfferFromItem({ offer_pct: 0, offer_by: null })).toBeNull()
    expect(lienOfferFromItem({ offer_pct: 10, offer_by: null })).toBeNull()
    expect(lienOfferFromItem({ offer_pct: 60, offer_by: '2026-11-15' })).toBeNull()
    expect(lienOfferFromItem(null)).toBeNull()
  })
  it('reads a bill only while the credit is on it, neither taken nor ended', () => {
    const live = { lien_offer_pct: 10, lien_offer_by: '2026-11-15', lien_offer_credit_note_id: 'cn_1', lien_offer_taken_at: null, lien_offer_ended_at: null }
    expect(lienOfferOnInvoice(live)).toEqual(offer)
    expect(lienOfferOnInvoice({ ...live, lien_offer_credit_note_id: null })).toBeNull()
    expect(lienOfferOnInvoice({ ...live, lien_offer_taken_at: '2026-11-03T10:00:00Z' })).toBeNull()
    expect(lienOfferOnInvoice({ ...live, lien_offer_ended_at: '2026-11-16T06:05:00Z' })).toBeNull()
  })
  it('writes the item as the offer or as none', () => {
    expect(lienOfferPatch(offer)).toEqual({ offer_pct: 10, offer_by: '2026-11-15' })
    expect(lienOfferPatch(null)).toEqual({ offer_pct: 0, offer_by: null })
  })
})

describe('lienPayOffer — the day', () => {
  it('defaults to 14 days after mailing, pulled in to a week before the affidavit', () => {
    expect(lienOfferDefaultDay('2026-11-01', '2026-12-15')).toBe('2026-11-15')
    expect(lienOfferDefaultDay('2026-11-01', null)).toBe('2026-11-15')
    expect(lienOfferDefaultDay('2026-11-01', '2026-11-18')).toBe('2026-11-11')
    expect(lienOfferLatestDay('2026-12-15')).toBe('2026-12-08')
    expect(lienOfferLatestDay(null)).toBeNull()
  })
  it('names the problem with a day, or none', () => {
    expect(lienOfferDayProblem('2026-11-15', '2026-11-01', '2026-12-15')).toBeNull()
    expect(lienOfferDayProblem('', '2026-11-01', null)).toBe('Pick a day.')
    expect(lienOfferDayProblem('2026-11-01', '2026-11-01', null)).toBe('The day has to be after today.')
    expect(lienOfferDayProblem('2026-12-10', '2026-11-01', '2026-12-15')).toBe('No later than Dec 8, a week before the affidavit must be filed.')
    expect(lienOfferDayProblem('2026-11-05', '2026-11-01', '2026-11-06')).toBe('The affidavit is due within a week, so there is no room for an offer.')
  })
})

describe('lienPayOffer — the arithmetic', () => {
  it('takes the percent off to the cent, and the credit in cents', () => {
    expect(lienOfferLowAmount(6240, 10)).toBe(5616)
    expect(lienOfferLowAmount(6165, 10)).toBe(5548.5)
    expect(lienOfferLowAmount(33.33, 15)).toBe(28.33)
    expect(lienOfferCreditCents(624000, 10)).toBe(62400)
    expect(lienOfferCreditCents(3333, 15)).toBe(500)
    expect(lienOfferCreditCents(-5, 10)).toBe(0)
  })
  it('sums what the offer gives up at most', () => {
    expect(lienOfferCost([6240, 6165, 5180], 10)).toBe(1758.5)
    expect(lienOfferCost([], 10)).toBe(0)
  })
})

describe('lienPayOffer — the words', () => {
  it('reads on the pay page, the row, the total and the rule line', () => {
    expect(lienOfferSentence(offer)).toBe('Pay any of these bills in full by November 15, 2026 and it is 10% less. The lower amount is on the page the code opens. Pay all of them and no lien is filed.')
    expect(lienOfferRowWords(6240, offer)).toBe('$5,616.00 if paid in full by November 15')
    expect(lienOfferTotalWords([6240, 6165, 5180], offer)).toBe('$15,826.50 if all three are paid in full by November 15')
    expect(lienOfferTotalWords([6240], offer)).toBe('$5,616.00 if it is paid in full by November 15')
    expect(lienOfferTotalWords([6240, 6165], offer)).toBe('$11,164.50 if both are paid in full by November 15')
    expect(lienOfferPayerLine('Brightwater Builders')).toBe('Whoever pays, you or Brightwater Builders, gets the same amount off.')
    expect(lienOfferPayerLine('')).toBe('Whoever pays gets the same amount off.')
  })
  it('reads on the desk, the bill and the pay link page', () => {
    expect(lienOfferChipWords(offer)).toBe('Offer 10% by Nov 15')
    expect(lienOfferApprovedWords(offer)).toBe('with a 10% offer, by Nov 15')
    expect(lienOfferWriteDownNote(offer, '2026-11-03')).toBe('Lien notice offer: 10% off, paid in full Nov 3 (by Nov 15)')
    expect(lienOfferPayLinkWords(offer, 'live')).toBe('10% off if paid in full by November 15. Today it is.')
    expect(lienOfferPayLinkWords(offer, 'ended')).toBe('The 10% offer ended November 15. This is the full amount owed.')
    expect(lienOfferPayLinkWords(offer, 'taken')).toBe('Paid in full with the 10% offer.')
  })
})
