import { describe, expect, it } from 'vitest'
import { lienOfferCreditCents, lienOfferCreditMemo, lienOfferExpired, lienOfferForPayLink, lienOfferState, lienOfferWriteDown, type LienOfferRow } from './lienPayOfferShared'

const live: LienOfferRow = { lien_offer_pct: 10, lien_offer_by: '2026-11-15', lien_offer_credit_note_id: 'cn_1', lien_offer_credit_cents: 62400, lien_offer_taken_at: null, lien_offer_ended_at: null }

describe('lienPayOffer (shared) — the state of a bill’s offer', () => {
  it('none without a credit on the bill; live until the day; ended after it, swept or not; taken once paid with it', () => {
    expect(lienOfferState(null, '2026-11-03')).toBe('none')
    expect(lienOfferState({ ...live, lien_offer_credit_note_id: null }, '2026-11-03')).toBe('none')
    expect(lienOfferState({ ...live, lien_offer_pct: 0 }, '2026-11-03')).toBe('none')
    expect(lienOfferState(live, '2026-11-03')).toBe('live')
    expect(lienOfferState(live, '2026-11-15')).toBe('live')
    expect(lienOfferState(live, '2026-11-16')).toBe('ended')
    expect(lienOfferState({ ...live, lien_offer_ended_at: '2026-11-16T06:05:00Z' }, '2026-11-03')).toBe('ended')
    expect(lienOfferState({ ...live, lien_offer_taken_at: '2026-11-03T15:00:00Z' }, '2026-11-20')).toBe('taken')
  })
  it('the page reads the full amount beside the lower one only while live', () => {
    expect(lienOfferForPayLink(live, 561600, '2026-11-03')).toEqual({ pct: 10, by: '2026-11-15', state: 'live', fullCents: 624000 })
    expect(lienOfferForPayLink(live, null, '2026-11-03')).toEqual({ pct: 10, by: '2026-11-15', state: 'live', fullCents: null })
    expect(lienOfferForPayLink(live, 624000, '2026-11-20')).toEqual({ pct: 10, by: '2026-11-15', state: 'ended', fullCents: null })
    expect(lienOfferForPayLink({ ...live, lien_offer_taken_at: '2026-11-03T15:00:00Z' }, 0, '2026-11-20')).toMatchObject({ state: 'taken' })
    expect(lienOfferForPayLink(null, 100, '2026-11-03')).toBeNull()
  })
})

describe('lienPayOffer (shared) — the money', () => {
  it('the credit is the percent of what the bill asks for, in whole cents', () => {
    expect(lienOfferCreditCents(624000, 10)).toBe(62400)
    expect(lienOfferCreditCents(3333, 15)).toBe(500)
    expect(lienOfferCreditMemo(10, '2026-11-15')).toBe('10% off if paid in full by Nov 15 — lien notice offer')
  })
  it('the write-down is the ledger amount less the credit, with the note; never twice, never after the sweep', () => {
    expect(lienOfferWriteDown(live, 6240, '2026-11-03')).toEqual({ newAmount: 5616, note: 'Lien notice offer: 10% off, paid in full Nov 3 (by Nov 15)' })
    expect(lienOfferWriteDown({ ...live, lien_offer_taken_at: '2026-11-03T15:00:00Z' }, 6240, '2026-11-03')).toBeNull()
    expect(lienOfferWriteDown({ ...live, lien_offer_ended_at: '2026-11-16T06:05:00Z' }, 6240, '2026-11-20')).toBeNull()
    expect(lienOfferWriteDown({ ...live, lien_offer_credit_cents: 624000 }, 6240, '2026-11-03')).toBeNull()
    expect(lienOfferWriteDown(null, 6240, '2026-11-03')).toBeNull()
  })
  it('the sweep takes back a live credit whose day has passed, and nothing else', () => {
    expect(lienOfferExpired(live, '2026-11-15')).toBe(false)
    expect(lienOfferExpired(live, '2026-11-16')).toBe(true)
    expect(lienOfferExpired({ ...live, lien_offer_taken_at: '2026-11-03T15:00:00Z' }, '2026-11-16')).toBe(false)
    expect(lienOfferExpired({ ...live, lien_offer_ended_at: '2026-11-16T06:05:00Z' }, '2026-11-17')).toBe(false)
    expect(lienOfferExpired({ ...live, lien_offer_credit_note_id: '' }, '2026-11-16')).toBe(false)
  })
})
