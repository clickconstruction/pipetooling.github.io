/**
 * The receipt's state on a card charge (punch list #299, PR 3): what a table cell says, and which of a table's rows are
 * worth asking about. Every name and number is made up.
 */
import { describe, expect, it } from 'vitest'
import { RECEIPT_STATE_MAX, receiptStateChargeIds, receiptStateOf, receiptStatesOf, type ReceiptStateFacts } from './receiptState'
import type { ReceiptRequestState } from './receiptText'

// Wed Nov 4, 2:30 PM on the company's clock.
const NOW = Date.parse('2026-11-04T20:30:00.000Z')
const DAY = 24 * 60 * 60 * 1000
const request = (over: Partial<ReceiptRequestState> = {}): ReceiptRequestState => ({ holder_name: 'Jordan Vance', no_text_why: null, texted_at: null, reminded_at: null, answered_at: null, closed_at: null, text_tries: 0, ...over })

describe('what the cell says', () => {
  it('a charge with its paper says which door the paper came by, whatever its request says', () => {
    expect(receiptStateOf({ ticket: { source: 'link' }, request: request({ texted_at: '2026-11-04T19:14:00.000Z' }) }, NOW)).toEqual({ chip: 'Receipt from the link', tone: 'has', title: 'A photo sent through the receipt link is on this charge.' })
    expect(receiptStateOf({ ticket: { source: 'camera' }, request: null }, NOW)).toEqual({ chip: 'Ticket', tone: 'has', title: 'A photo taken at the counter is on this charge.' })
    expect(receiptStateOf({ ticket: { source: 'office' }, request: null }, NOW)).toMatchObject({ chip: 'Ticket', title: 'A paper handed in at the desk is on this charge.' })
    expect(receiptStateOf({ ticket: { source: 'file' }, request: null }, NOW)).toMatchObject({ title: 'A photo or a PDF from the phone is on this charge.' })
    expect(receiptStateOf({ ticket: { source: null }, request: null }, NOW)).toMatchObject({ chip: 'Ticket', title: 'A ticket is on this charge.' })
  })

  it('a charge the app texted about says when, and one it reminded says that too', () => {
    expect(receiptStateOf({ ticket: null, request: request({ texted_at: '2026-11-04T19:14:00.000Z' }) }, NOW)).toEqual({ chip: 'Texted 1:14 PM', tone: 'waiting', title: 'No receipt yet.' })
    expect(receiptStateOf({ ticket: null, request: request({ texted_at: '2026-11-03T00:14:00.000Z', reminded_at: '2026-11-04T00:00:00.000Z' }) }, NOW)).toEqual({ chip: 'Texted Mon 6:14 PM', tone: 'waiting', title: 'Reminded Tue 6:00 PM. No receipt yet.' })
  })

  it('a charge it could not text says why and what mends it', () => {
    expect(receiptStateOf({ ticket: null, request: request({ no_text_why: 'no_cell' }) }, NOW)).toEqual({ chip: 'No text', tone: 'held', title: 'Jordan has no cell on file. Add the cell on People, and the next charge texts them.' })
    expect(receiptStateOf({ ticket: null, request: request({ text_tries: 3 }) }, NOW)).toMatchObject({ chip: 'No text', tone: 'held' })
  })

  it('says nothing for a charge with no ticket and nothing to say, or with no facts at all', () => {
    expect(receiptStateOf(null, NOW)).toBeNull()
    expect(receiptStateOf({ ticket: null, request: null }, NOW)).toBeNull()
    // A request the office made by hand, never texted.
    expect(receiptStateOf({ ticket: null, request: request() }, NOW)).toBeNull()
    expect(receiptStateOf({ ticket: null, request: request({ no_text_why: 'no_cell', closed_at: '2026-11-04T12:00:00.000Z' }) }, NOW)).toBeNull()
  })

  it('many at once leaves out the charges with nothing to say', () => {
    const facts = new Map<string, ReceiptStateFacts>([
      ['c1', { ticket: { source: 'camera' }, request: null }],
      ['c2', { ticket: null, request: request() }],
      ['c3', { ticket: null, request: request({ no_text_why: 'opted_out' }) }],
    ])
    expect([...receiptStatesOf(facts, NOW).keys()]).toEqual(['c1', 'c3'])
  })
})

describe('which rows a table asks about', () => {
  const row = (id: string, daysAgo: number, over: Record<string, unknown> = {}) => ({ id, kind: 'debitCardTransaction', amount: -20, at: new Date(NOW - daysAgo * DAY).toISOString(), ...over })

  it('card purchases of the last 60 days, the newest first, each once', () => {
    expect(receiptStateChargeIds([row('old', 61), row('b', 30), row('a', 1), row('a', 1), row('edge', 59)], NOW)).toEqual(['a', 'b', 'edge'])
  })

  it('never money back, a payment that is not a card charge, or a row with no day', () => {
    expect(receiptStateChargeIds([row('refund', 1, { amount: 12 }), row('zero', 1, { amount: 0 }), row('check', 1, { kind: 'outgoingPayment' }), row('undated', 1, { at: null }), row('odd', 1, { at: 'soon' }), row('', 1), row('credit', 2, { kind: 'creditCardTransaction', amount: '-5.00' })], NOW)).toEqual(['credit'])
  })

  it('a row that names no kind or amount is taken as a card charge: Job Summary’s lines are', () => {
    expect(receiptStateChargeIds([{ id: 'x', at: new Date(NOW - DAY).toISOString() }], NOW)).toEqual(['x'])
  })

  it('a long ledger asks about its newest 600', () => {
    const many = Array.from({ length: 2000 }, (_, i) => row(`c${String(i).padStart(4, '0')}`, i / 100))
    const ids = receiptStateChargeIds(many, NOW)
    expect(ids).toHaveLength(RECEIPT_STATE_MAX)
    expect(ids[0]).toBe('c0000')
    expect(ids[RECEIPT_STATE_MAX - 1]).toBe('c0599')
  })
})
