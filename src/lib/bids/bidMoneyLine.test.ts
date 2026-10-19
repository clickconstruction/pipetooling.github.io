import { describe, expect, it } from 'vitest'
import { bidMoneyLine, bidMoneyLinesByBid, bidMoneyWords, canSendPayPage, parseBidMoneyStrip, payPageKind, type BidMoneyStripEntry } from './bidMoneyLine'

const PAY_ID = '11111111-1111-4111-8111-111111111111'

function entry(over: Partial<BidMoneyStripEntry> = {}, job: Partial<BidMoneyStripEntry['job']> = {}): BidMoneyStripEntry {
  return {
    bidId: 'b512',
    job: {
      id: 'j1032',
      status: 'billed',
      revenue: 4200,
      payments_made: 0,
      collections_at: null,
      uncollectible_at: null,
      job_name: 'Whitfield repipe',
      hcp_number: '1032',
      click_number: null,
      billing_only: false,
      customer_id: 'c-dana',
      customer_name: 'Dana Whitfield',
      customer_phone: '210-555-0100',
      customer_email: 'dana@example.com',
      created_at: '2026-09-12T15:00:00Z',
      ...job,
    },
    invoices: [{ id: PAY_ID, job_id: 'j1032', status: 'billed', amount: 4200, sequence_order: 0, billed_at: '2026-09-30T15:00:00Z', created_at: '2026-09-30T15:00:00Z', stripe_invoice_id: 'in_1' }],
    payments: [],
    promises: [],
    ...over,
  }
}

const promise = (ymd: string, over: Record<string, unknown> = {}) => ({ id: 'p1', jobId: 'j1032', customerId: 'c-dana', promisedYmd: ymd, saidBy: 'Dana', heardByName: 'Theo', channel: 'text', source: 'office', note: null, createdAt: '2026-10-14T20:12:00Z', ...over })

describe('bidMoneyLine', () => {
  it('a billed job with no word: the open amount after the payment rule, the pay page, amber', () => {
    const line = bidMoneyLine(entry({ payments: [{ invoice_id: PAY_ID, job_id: 'j1032', amount: 1200, paid_on: '2026-10-02', sequence_order: 0 }] }), '2026-10-19')
    expect(line.stage).toBe('Billed Sep 30')
    expect(line.open).toBe(3000)
    expect(line.payUrl).toContain(PAY_ID)
    expect(line.promise).toBeNull()
    expect(line.tone).toBe('amber')
    expect(bidMoneyWords(line)).toEqual({ stage: 'Billed Sep 30', money: '$3,000 open', word: 'no word yet', by: null })
  })
  it('a word that is still ahead reads They said, quiet', () => {
    const line = bidMoneyLine(entry({ promises: [promise('2026-10-25')] }), '2026-10-19')
    expect(line.tone).toBe('quiet')
    expect(line.pastDays).toBeNull()
    expect(bidMoneyWords(line)).toMatchObject({ word: 'They said Oct 25', by: 'Dana · by text · heard by Theo' })
  })
  it('a word the day is past reads Said and the days, red', () => {
    const line = bidMoneyLine(entry({ promises: [promise('2026-10-25')] }), '2026-10-29')
    expect(line.pastDays).toBe(4)
    expect(line.tone).toBe('red')
    expect(bidMoneyWords(line).word).toBe('Said Oct 25 · 4 days past')
    expect(bidMoneyWords(bidMoneyLine(entry({ promises: [promise('2026-10-25')] }), '2026-10-26')).word).toBe('Said Oct 25 · 1 day past')
  })
  it('the newest live word wins', () => {
    const line = bidMoneyLine(entry({ promises: [promise('2026-10-18', { id: 'old', createdAt: '2026-10-10T10:00:00Z' }), promise('2026-10-25')] }), '2026-10-19')
    expect(line.promise?.promisedYmd).toBe('2026-10-25')
  })
  it('not billed yet: no money, no word, quiet, no pay page', () => {
    const line = bidMoneyLine(entry({ invoices: [] }, { status: 'working' }), '2026-10-19')
    expect(line).toMatchObject({ stage: 'Working', open: null, payUrl: null, tone: 'quiet' })
    expect(bidMoneyWords(line)).toEqual({ stage: 'Working', money: 'not billed yet', word: null, by: null })
    expect(canSendPayPage(line)).toBe(false)
  })
  it('paid: green, no word even with one on record, no pay page', () => {
    const line = bidMoneyLine(entry({ payments: [{ invoice_id: PAY_ID, job_id: 'j1032', amount: 4200, paid_on: '2026-10-23', sequence_order: 0 }], promises: [promise('2026-10-25')] }, { status: 'paid', payments_made: 4200 }), '2026-10-29')
    expect(line.open).toBe(0)
    expect(line.tone).toBe('green')
    expect(line.pastDays).toBeNull()
    expect(bidMoneyWords(line)).toMatchObject({ stage: 'Paid Sep 30', money: 'paid', word: null })
    expect(line.payUrl).toBeNull()
  })
  it('a bill outside Stripe has no pay page, so the page is not offered', () => {
    const line = bidMoneyLine(entry({ invoices: [{ id: PAY_ID, job_id: 'j1032', status: 'billed', amount: 4200, sequence_order: 0, billed_at: '2026-09-30T15:00:00Z', created_at: null, stripe_invoice_id: null }] }), '2026-10-19')
    expect(line.open).toBe(4200)
    expect(line.payUrl).toBeNull()
    expect(canSendPayPage(line)).toBe(false)
  })
  it('the pay page goes by text when they have a number, else by email, and never to nobody', () => {
    const line = bidMoneyLine(entry(), '2026-10-19')
    expect(canSendPayPage(line)).toBe(true)
    expect(payPageKind(line)).toBe('text')
    expect(payPageKind(bidMoneyLine(entry({}, { customer_phone: null }), '2026-10-19'))).toBe('email')
    expect(canSendPayPage(bidMoneyLine(entry({}, { customer_phone: null, customer_email: '' }), '2026-10-19'))).toBe(false)
    expect(canSendPayPage(bidMoneyLine(entry({}, { customer_id: null }), '2026-10-19'))).toBe(false)
  })
  it('the job as the door needs it', () => {
    const line = bidMoneyLine(entry(), '2026-10-19')
    expect(line.job).toEqual({ id: 'j1032', number: '1032', name: 'Whitfield repipe', status: 'billed', customerId: 'c-dana', customerName: 'Dana Whitfield', customerPhone: '210-555-0100', customerEmail: 'dana@example.com', createdAt: '2026-09-12T15:00:00Z' })
  })
})

describe('parseBidMoneyStrip', () => {
  it('keeps an entry with a bid and a job, reads missing lists as empty, drops the rest', () => {
    const got = parseBidMoneyStrip([entry(), { bidId: 'b2', job: { id: 'j2', status: 'working' } }, { bidId: 'b3' }, 'x', null])
    expect(got.map((e) => e.bidId)).toEqual(['b512', 'b2'])
    expect(got[1]).toMatchObject({ invoices: [], payments: [] })
    expect(parseBidMoneyStrip(null)).toEqual([])
    expect(parseBidMoneyStrip({})).toEqual([])
  })
  it('the lines by bid', () => {
    const by = bidMoneyLinesByBid(parseBidMoneyStrip([entry()]), '2026-10-19')
    expect(by.get('b512')?.open).toBe(4200)
  })
})
