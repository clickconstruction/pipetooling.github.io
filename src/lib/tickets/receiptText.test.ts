/**
 * The receipt text's rules and words (punch list #299, PR 2): the switch's shape, which charges are asked, why a text
 * cannot go, the fold, the reminder's evening, both texts, the Team queue's line and the Settings card's state. Every
 * name and number is made up.
 */
import { describe, expect, it } from 'vitest'
import {
  RECEIPT_TEXTS_OFF,
  RECEIPT_TEXTS_WORDS,
  foldReceiptCharges,
  parseReceiptTextsSetting,
  receiptChargeAsks,
  receiptCompanyHour,
  receiptHolderInTrial,
  receiptLineWords,
  receiptLinkUrl,
  receiptNoTextWhy,
  receiptReminderBody,
  receiptReminderDue,
  receiptSweepFloor,
  receiptTextBody,
  receiptTextsOnWords,
  receiptTextsValue,
  type ReceiptRequestState,
} from './receiptText'

const JORDAN = '00000000-0000-0000-0000-0000000000b1'
const SAM = '00000000-0000-0000-0000-0000000000b2'
const SINCE = '2026-11-04T12:00:00.000Z'
// Wed Nov 4, 2:30 PM on the company's clock.
const NOW = Date.parse('2026-11-04T20:30:00.000Z')
const HOUR = 60 * 60 * 1000

describe('the switch as stored', () => {
  it('reads off for anything that does not read as on: a doubt never sends a text', () => {
    for (const stored of [null, undefined, '', 'true', 'false', 'not json', '[]', '"on"', '{"on":false}', '{"on":"true","since":"2026-11-04T12:00:00.000Z"}', '{"on":true}', '{"on":true,"since":"someday"}', '{"on":1,"since":"2026-11-04T12:00:00.000Z"}']) {
      expect(parseReceiptTextsSetting(stored).on, String(stored)).toBe(false)
    }
    expect(parseReceiptTextsSetting(null)).toEqual(RECEIPT_TEXTS_OFF)
  })

  it('reads on for everyone, or for the people a trial names', () => {
    expect(parseReceiptTextsSetting(JSON.stringify({ on: true, since: SINCE }))).toEqual({ on: true, since: SINCE, only: [] })
    expect(parseReceiptTextsSetting(JSON.stringify({ on: true, since: SINCE, only: [] }))).toEqual({ on: true, since: SINCE, only: [] })
    expect(parseReceiptTextsSetting(JSON.stringify({ on: true, since: SINCE, only: [JORDAN.toUpperCase(), JORDAN] }))).toEqual({ on: true, since: SINCE, only: [JORDAN] })
  })

  it('a trial list that does not read is off, never everyone', () => {
    for (const only of ['all', ['jordan'], [JORDAN, 'not-an-id'], [7], {}, [null]]) {
      expect(parseReceiptTextsSetting(JSON.stringify({ on: true, since: SINCE, only })).on, JSON.stringify(only)).toBe(false)
    }
  })

  it('a press writes on with now and its people, or off and nothing else', () => {
    expect(JSON.parse(receiptTextsValue({ on: true }, SINCE))).toEqual({ on: true, since: SINCE, only: [] })
    expect(JSON.parse(receiptTextsValue({ on: true, only: [JORDAN, JORDAN] }, SINCE))).toEqual({ on: true, since: SINCE, only: [JORDAN] })
    expect(JSON.parse(receiptTextsValue({ on: false, only: [JORDAN] }, SINCE))).toEqual({ on: false })
    expect(parseReceiptTextsSetting(receiptTextsValue({ on: true, only: [JORDAN] }, SINCE))).toEqual({ on: true, since: SINCE, only: [JORDAN] })
  })

  it('the floor is the later of the day it went on and 48 hours back; off has no floor', () => {
    expect(receiptSweepFloor(RECEIPT_TEXTS_OFF, NOW)).toBeNull()
    expect(receiptSweepFloor({ on: true, since: SINCE, only: [] }, NOW)).toBe(SINCE)
    expect(receiptSweepFloor({ on: true, since: '2026-10-01T00:00:00.000Z', only: [] }, NOW)).toBe('2026-11-02T20:30:00.000Z')
    // A day stamped ahead of now texts nothing until it comes.
    expect(receiptSweepFloor({ on: true, since: '2026-11-05T00:00:00.000Z', only: [] }, NOW)).toBe('2026-11-05T00:00:00.000Z')
  })

  it('a trial texts its people and nobody else; off texts nobody', () => {
    const everyone = { on: true, since: SINCE, only: [] }
    const trial = { on: true, since: SINCE, only: [JORDAN] }
    expect(receiptHolderInTrial(everyone, JORDAN)).toBe(true)
    expect(receiptHolderInTrial(everyone, null)).toBe(true)
    expect(receiptHolderInTrial(trial, JORDAN.toUpperCase())).toBe(true)
    expect(receiptHolderInTrial(trial, SAM)).toBe(false)
    expect(receiptHolderInTrial(trial, null)).toBe(false)
    expect(receiptHolderInTrial(RECEIPT_TEXTS_OFF, JORDAN)).toBe(false)
  })
})

describe('which charges are asked', () => {
  const charge = { id: 'c1', kind: 'debitCardTransaction', amount: -228.58, status: 'sent', posted_at: '2026-11-04T19:00:00.000Z', duplicate_of_transaction_id: null }

  it('a card purchase that has posted and stands', () => {
    expect(receiptChargeAsks(charge)).toBe(true)
    expect(receiptChargeAsks({ ...charge, kind: 'creditCardTransaction', status: null })).toBe(true)
  })

  it('never a pending one, money back, a dead one, a duplicate, or anything that is not a card charge', () => {
    expect(receiptChargeAsks({ ...charge, posted_at: null })).toBe(false)
    expect(receiptChargeAsks({ ...charge, posted_at: 'soon' })).toBe(false)
    expect(receiptChargeAsks({ ...charge, amount: 41.17 })).toBe(false)
    expect(receiptChargeAsks({ ...charge, amount: 0 })).toBe(false)
    for (const status of ['failed', 'Cancelled', 'canceled', 'REVERSED']) expect(receiptChargeAsks({ ...charge, status }), status).toBe(false)
    expect(receiptChargeAsks({ ...charge, duplicate_of_transaction_id: 'c0' })).toBe(false)
    expect(receiptChargeAsks({ ...charge, kind: 'outgoingPayment' })).toBe(false)
    expect(receiptChargeAsks({ ...charge, kind: null })).toBe(false)
  })

  it('why no text can go, the first reason that holds', () => {
    expect(receiptNoTextWhy({ holderUserId: null, archived: true, cell: null, optedOut: true })).toBe('no_person')
    expect(receiptNoTextWhy({ holderUserId: JORDAN, archived: true, cell: null, optedOut: true })).toBe('archived')
    expect(receiptNoTextWhy({ holderUserId: JORDAN, archived: false, cell: null, optedOut: true })).toBe('no_cell')
    expect(receiptNoTextWhy({ holderUserId: JORDAN, archived: false, cell: '+15125550100', optedOut: true })).toBe('opted_out')
    expect(receiptNoTextWhy({ holderUserId: JORDAN, archived: false, cell: '+15125550100', optedOut: false })).toBeNull()
  })
})

describe('one text for the charges of one hour', () => {
  const at = (requestId: string, holderUserId: string, minutes: number) => ({ requestId, holderUserId, postedAtMs: NOW + minutes * 60 * 1000 })

  it('cuts each holder’s charges into runs that post inside one hour of the run’s first', () => {
    const runs = foldReceiptCharges([at('d', JORDAN, 61), at('a', JORDAN, 0), at('c', JORDAN, 60), at('b', JORDAN, 30), at('e', JORDAN, 130)])
    expect(runs.map((r) => r.map((w) => w.requestId))).toEqual([['a', 'b', 'c'], ['d'], ['e']])
  })

  it('never folds two holders together, and sends the oldest run first', () => {
    const runs = foldReceiptCharges([at('s1', SAM, 5), at('j1', JORDAN, 0), at('s2', SAM, 6), at('j2', JORDAN, 1)])
    expect(runs.map((r) => r.map((w) => w.requestId))).toEqual([['j1', 'j2'], ['s1', 's2']])
  })

  it('names at most ten charges in one text', () => {
    const runs = foldReceiptCharges(Array.from({ length: 23 }, (_, i) => at(`r${String(i).padStart(2, '0')}`, JORDAN, i)))
    expect(runs.map((r) => r.length)).toEqual([10, 10, 3])
  })
})

describe('the one reminder', () => {
  const r = { texted_at: '2026-11-04T00:14:00.000Z', reminded_at: null, answered_at: null, closed_at: null, closes_at: '2026-11-18T00:14:00.000Z' }
  // Wed Nov 4, 6:30 PM on the company's clock.
  const EVENING = Date.parse('2026-11-05T00:30:00.000Z')

  it('the company’s hour follows its clock through both halves of the year', () => {
    expect(receiptCompanyHour(Date.parse('2026-11-05T00:30:00.000Z'))).toBe(18)
    expect(receiptCompanyHour(Date.parse('2026-07-08T23:30:00.000Z'))).toBe(18)
    expect(receiptCompanyHour(Date.parse('2026-11-04T06:00:00.000Z'))).toBe(0)
  })

  it('goes between six and nine in the evening, at least twelve hours after the text', () => {
    expect(receiptReminderDue(r, EVENING)).toBe(true)
    expect(receiptReminderDue(r, Date.parse('2026-11-05T02:59:00.000Z'))).toBe(true)
    // Nine o'clock, noon, and midnight are not its hours.
    expect(receiptReminderDue(r, Date.parse('2026-11-05T03:00:00.000Z'))).toBe(false)
    expect(receiptReminderDue(r, Date.parse('2026-11-04T18:00:00.000Z'))).toBe(false)
    expect(receiptReminderDue(r, Date.parse('2026-11-05T06:00:00.000Z'))).toBe(false)
    // A text at 6:14 PM is reminded the next evening, not that one.
    expect(receiptReminderDue({ ...r, texted_at: '2026-11-05T00:14:00.000Z' }, EVENING)).toBe(false)
    expect(receiptReminderDue({ ...r, texted_at: '2026-11-05T00:14:00.000Z' }, EVENING + 24 * HOUR)).toBe(true)
    // In summer the same evening is an hour earlier on the world's clock.
    expect(receiptReminderDue({ ...r, texted_at: '2026-07-08T05:00:00.000Z', closes_at: '2026-07-22T05:00:00.000Z' }, Date.parse('2026-07-08T23:30:00.000Z'))).toBe(true)
  })

  it('never goes twice, without a first text, after the receipt, on a closed request or past the link’s day', () => {
    expect(receiptReminderDue({ ...r, reminded_at: '2026-11-05T00:20:00.000Z' }, EVENING)).toBe(false)
    expect(receiptReminderDue({ ...r, texted_at: null }, EVENING)).toBe(false)
    expect(receiptReminderDue({ ...r, answered_at: '2026-11-04T15:00:00.000Z' }, EVENING)).toBe(false)
    expect(receiptReminderDue({ ...r, closed_at: '2026-11-04T15:00:00.000Z' }, EVENING)).toBe(false)
    expect(receiptReminderDue({ ...r, closes_at: '2026-11-05T00:00:00.000Z' }, EVENING)).toBe(false)
  })
})

describe('the words of the two texts', () => {
  const url = 'https://clicktooling.com/r/k7m2p9xq4d'
  const ridgeway = { amount: -228.58, store: 'Ridgeway Supply', posted_at: '2026-11-04T19:00:00.000Z' }
  const cedar = { amount: -41.17, store: 'Cedar Bend Hardware', posted_at: '2026-11-04T19:40:00.000Z' }
  const fuel = { amount: -42.17, store: ' ', posted_at: '2026-11-04T20:00:00.000Z' }

  it('a first text names the person and the company; a later one is the one line', () => {
    expect(receiptTextBody({ first: true, firstName: 'Jordan', company: 'Click Plumbing', charges: [ridgeway], url, nowMs: NOW })).toBe(`Hi Jordan, this is Click Plumbing. $228.58 at Ridgeway Supply posted to your card today. Snap the receipt here: ${url}`)
    expect(receiptTextBody({ first: false, firstName: 'Jordan', company: 'Click Plumbing', charges: [ridgeway], url, nowMs: NOW })).toBe(`$228.58 at Ridgeway Supply posted to your card today. Snap the receipt here: ${url}`)
    expect(receiptTextBody({ first: true, firstName: '', company: 'Click Plumbing', charges: [ridgeway], url, nowMs: NOW })).toMatch(/^This is Click Plumbing\. /)
    expect(receiptTextBody({ first: true, firstName: 'Jordan', company: '', charges: [ridgeway], url, nowMs: NOW })).toMatch(/^\$228\.58 at /)
  })

  it('two charges are both named, three or more are counted with their total', () => {
    expect(receiptTextBody({ first: false, firstName: 'Jordan', company: 'Click Plumbing', charges: [ridgeway, cedar], url, nowMs: NOW })).toBe(`$228.58 at Ridgeway Supply and $41.17 at Cedar Bend Hardware posted to your card today. Snap the receipts here: ${url}`)
    expect(receiptTextBody({ first: false, firstName: 'Jordan', company: 'Click Plumbing', charges: [ridgeway, cedar, fuel], url, nowMs: NOW })).toBe(`3 charges posted to your card today, $311.92 in all. Snap the receipts here: ${url}`)
  })

  it('a charge with no store is its amount, and a thousand reads with its comma', () => {
    expect(receiptTextBody({ first: false, firstName: '', company: '', charges: [{ amount: -1234.5, store: null, posted_at: ridgeway.posted_at }], url, nowMs: NOW })).toBe(`$1,234.50 posted to your card today. Snap the receipt here: ${url}`)
  })

  it('says the day when the charge posted on an earlier company day', () => {
    const tuesday = { ...ridgeway, posted_at: '2026-11-03T21:00:00.000Z' }
    const monday = { ...cedar, posted_at: '2026-11-02T21:00:00.000Z' }
    expect(receiptTextBody({ first: false, firstName: '', company: '', charges: [tuesday], url, nowMs: NOW })).toContain('posted to your card on Tuesday.')
    expect(receiptTextBody({ first: false, firstName: '', company: '', charges: [tuesday, monday], url, nowMs: NOW })).toContain('posted to your card this week.')
    // 1:30 AM Wednesday on the world's clock is still Tuesday evening on the company's.
    expect(receiptTextBody({ first: false, firstName: '', company: '', charges: [{ ...ridgeway, posted_at: '2026-11-04T01:30:00.000Z' }], url, nowMs: NOW })).toContain('on Tuesday.')
  })

  it('the reminder in its three sizes', () => {
    expect(receiptReminderBody({ charges: [ridgeway], url })).toBe(`Still no receipt for $228.58 at Ridgeway Supply. Snap it here: ${url}`)
    expect(receiptReminderBody({ charges: [ridgeway, cedar], url })).toBe(`Still no receipt for $228.58 at Ridgeway Supply and $41.17 at Cedar Bend Hardware. Snap them here: ${url}`)
    expect(receiptReminderBody({ charges: [ridgeway, cedar, fuel], url })).toBe(`Still no receipt for 3 charges on your card, $311.92 in all. Snap them here: ${url}`)
  })

  it('a first text with one charge is at most 160 characters before the carriers’ line', () => {
    const body = receiptTextBody({ first: true, firstName: 'Jordan', company: 'Click Plumbing', charges: [ridgeway], url, nowMs: NOW })
    expect(body.length).toBeLessThanOrEqual(160)
  })

  it('a link is the app’s own address until the short host forwards', () => {
    expect(receiptLinkUrl(' K7M2P9XQ4D ')).toBe('https://clicktooling.com/r/k7m2p9xq4d')
    expect(receiptLinkUrl('k7m2p9xq4d', 'https://my.example.com/')).toBe('https://my.example.com/r/k7m2p9xq4d')
  })
})

describe('the charge’s line in the Team queue', () => {
  const base: ReceiptRequestState = { holder_name: 'Jordan Vance', no_text_why: null, texted_at: null, reminded_at: null, answered_at: null, closed_at: null, text_tries: 0 }

  it('says nothing for a request nobody texted, one that got its receipt, or a closed one', () => {
    expect(receiptLineWords(base, NOW)).toBeNull()
    expect(receiptLineWords({ ...base, texted_at: '2026-11-04T00:14:00.000Z', answered_at: '2026-11-04T15:00:00.000Z' }, NOW)).toBeNull()
    expect(receiptLineWords({ ...base, no_text_why: 'no_cell', closed_at: '2026-11-04T15:00:00.000Z' }, NOW)).toBeNull()
  })

  it('texted, then reminded, on the company’s clock, with the day when it is not today', () => {
    expect(receiptLineWords({ ...base, texted_at: '2026-11-04T19:14:00.000Z' }, NOW)).toEqual({ chip: 'Texted 1:14 PM', words: 'No receipt yet.', tone: 'waiting', next: null })
    expect(receiptLineWords({ ...base, texted_at: '2026-11-04T00:14:00.000Z', reminded_at: '2026-11-05T00:00:00.000Z' }, Date.parse('2026-11-05T20:30:00.000Z'))).toEqual({ chip: 'Texted Tue 6:14 PM', words: 'Reminded Wed 6:00 PM. No receipt yet.', tone: 'waiting', next: null })
  })

  it('each reason no text went, with the press that mends it', () => {
    expect(receiptLineWords({ ...base, holder_name: '', no_text_why: 'no_person' }, NOW)).toEqual({ chip: 'No text', words: 'The card is tied to no one.', tone: 'held', next: 'Tie the card on Banking, and its next charge texts the holder.' })
    expect(receiptLineWords({ ...base, no_text_why: 'no_cell' }, NOW)).toMatchObject({ chip: 'No text', words: 'Jordan has no cell on file.', tone: 'held', next: 'Add the cell on People, and the next charge texts them.' })
    expect(receiptLineWords({ ...base, no_text_why: 'archived' }, NOW)).toMatchObject({ words: 'Jordan has left.', next: 'Tie the card to who holds it now on Banking.' })
    expect(receiptLineWords({ ...base, no_text_why: 'opted_out' }, NOW)).toMatchObject({ words: 'Jordan replied STOP.', tone: 'held' })
    expect(receiptLineWords({ ...base, holder_name: '', no_text_why: 'no_cell' }, NOW)).toMatchObject({ words: 'The holder has no cell on file.' })
  })

  it('a text turned away three times says it did not go, and what to do', () => {
    expect(receiptLineWords({ ...base, text_tries: 2 }, NOW)).toBeNull()
    expect(receiptLineWords({ ...base, text_tries: 3 }, NOW)).toEqual({ chip: 'No text', words: 'The text did not go.', tone: 'held', next: 'Copy the receipt link and send it yourself.' })
  })
})

describe('the Settings card’s words', () => {
  it('says who it texts and since when, on the company’s clock', () => {
    expect(receiptTextsOnWords(RECEIPT_TEXTS_OFF, JORDAN)).toBeNull()
    expect(receiptTextsOnWords({ on: true, since: '2026-11-13T20:04:00.000Z', only: [] }, JORDAN)).toBe('On for everyone with a card since Nov 13, 2:04 PM. A charge that posted before then gets no text.')
    expect(receiptTextsOnWords({ on: true, since: '2026-11-13T20:04:00.000Z', only: [JORDAN] }, JORDAN.toUpperCase())).toMatch(/^On for you alone since /)
    expect(receiptTextsOnWords({ on: true, since: '2026-11-13T20:04:00.000Z', only: [JORDAN] }, SAM)).toMatch(/^On for 1 person since /)
    expect(receiptTextsOnWords({ on: true, since: '2026-11-13T20:04:00.000Z', only: [JORDAN, SAM] }, null)).toMatch(/^On for 2 people since /)
  })

  it('each confirm names its act', () => {
    expect(RECEIPT_TEXTS_WORDS.confirm.confirmLabel).toBe('Turn it on')
    expect(RECEIPT_TEXTS_WORDS.confirmTrial.confirmLabel).toBe('Turn it on for me')
  })
})
