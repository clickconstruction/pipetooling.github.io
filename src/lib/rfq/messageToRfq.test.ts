import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { rfqForMessage, rfqLineFacts, type RfqMessage, type RfqRow, type RfqSender } from './messageToRfq'

// Ferguson's reply to RFQ 2210, the integrations mockups' card 10. Made-up rows.
const FERGUSON: RfqSender = { name: 'Ferguson', record: { table: 'supply_houses', id: 'sh-ferguson' } }
/** A second rep at the house: another contact on the same record. */
const KIM: RfqSender = { name: 'Kim Alvarez', company: 'Ferguson', record: { table: 'supply_houses', id: 'sh-ferguson' } }
const WINSUPPLY: RfqSender = { name: 'Winsupply', record: { table: 'supply_houses', id: 'sh-winsupply' } }
const DANA: RfqSender = { name: 'Dana Whitfield', record: { table: 'customers', id: 'cust-dana' } }

const TOKEN_F = '0f9e8d7c6b5a49382716f5e4d3c2b1a0'
const TOKEN_W = 'aa11bb22cc33dd44ee55ff6677889900'

const rfq = (id: string, set: Partial<RfqRow>): RfqRow => ({
  id,
  token: null,
  status: 'sent',
  supplyHouseId: 'sh-ferguson',
  houseName: 'Ferguson',
  bidNumber: '2210',
  sentAt: '2026-10-05T14:00:00.000Z',
  ...set,
})

const F2210 = rfq('rfq-2210-f', { token: TOKEN_F })
const W2210 = rfq('rfq-2210-w', { token: TOKEN_W, supplyHouseId: 'sh-winsupply', houseName: 'Winsupply' })
const F2198 = rfq('rfq-2198-f', { status: 'quoted', bidNumber: '2198', sentAt: '2026-10-01T14:00:00.000Z' })
const F2150 = rfq('rfq-2150-f', { status: 'closed', bidNumber: '2150', sentAt: '2026-09-20T14:00:00.000Z' })
const F2240 = rfq('rfq-2240-f', { bidNumber: '2240', sentAt: '2026-10-08T14:00:00.000Z' })
const RFQS = [F2210, W2210, F2198, F2150]

const email = (subject: string, body = 'Pricing attached. Thanks, Kim'): RfqMessage => ({ channel: 'email', direction: 'in', subject, body })
const REPLY = email('RE: Price request · 2210 · Oakridge sewer line · 14 items')

describe('rfqForMessage', () => {
  it('lands Ferguson’s reply on RFQ 2210 by the number in the subject', () => {
    expect(rfqForMessage(REPLY, FERGUSON, RFQS)).toEqual({ rfqId: 'rfq-2210-f', how: 'number' })
  })

  it('lands a second rep at the house the same way', () => {
    expect(rfqForMessage(REPLY, KIM, RFQS)).toEqual({ rfqId: 'rfq-2210-f', how: 'number' })
  })

  it('takes the token from our link quoted back, before any number', () => {
    const quoted = email('Pricing', `See attached.\n> Open your request: https://pipetooling.example/q/${TOKEN_F.toUpperCase()}\n> Price request · 2198`)
    expect(rfqForMessage(quoted, FERGUSON, RFQS)).toEqual({ rfqId: 'rfq-2210-f', how: 'token' })
  })

  it('refuses a token that belongs to another house, since a forwarded link lands a wrong price', () => {
    const forwarded = email('FW: Price request', `Here is our number.\n> https://pipetooling.example/q/${TOKEN_F}`)
    expect(rfqForMessage(forwarded, WINSUPPLY, RFQS)).toEqual({
      rfqId: null,
      why: 'other_house',
      reason: 'The link is Ferguson’s, the email is from Winsupply.',
    })
  })

  it('lands on the house’s one open request when the email names none', () => {
    expect(rfqForMessage(email('Your pricing'), FERGUSON, RFQS)).toEqual({ rfqId: 'rfq-2210-f', how: 'newest' })
  })

  it('names no request when the house has two open and the email names neither', () => {
    expect(rfqForMessage(email('Your pricing'), FERGUSON, [...RFQS, F2240])).toEqual({
      rfqId: null,
      why: 'several_open',
      reason: 'Ferguson has 2 open price requests, and the email names none of them.',
    })
  })

  it('reads the body when the subject names nothing, and a whole number only', () => {
    const open = [...RFQS, F2240]
    expect(rfqForMessage(email('Pricing', 'Here is 2240 as asked.'), FERGUSON, open)).toEqual({ rfqId: 'rfq-2240-f', how: 'number' })
    for (const body of ['Total $2210 delivered.', 'Total 2,210.00 with tax.', 'Part 22100 is out.', 'Lead time 2210.5 days.'])
      expect(rfqForMessage(email('Pricing', body), FERGUSON, open)).toMatchObject({ rfqId: null, why: 'several_open' })
  })

  it('lands a number on a request answered on its page, never on a closed one', () => {
    expect(rfqForMessage(email('Revised price, 2198'), FERGUSON, RFQS)).toEqual({ rfqId: 'rfq-2198-f', how: 'number' })
    expect(rfqForMessage(email('About 2150'), FERGUSON, RFQS)).toEqual({ rfqId: 'rfq-2210-f', how: 'newest' })
  })

  it('names no request when the email names two', () => {
    expect(rfqForMessage(email('2210 and 2198 together'), FERGUSON, RFQS)).toEqual({
      rfqId: null,
      why: 'several_named',
      reason: 'The email names 2 of the price requests to Ferguson.',
    })
  })

  it('leaves a plain line for a text, our own email, a customer and a house with nothing open', () => {
    expect(rfqForMessage({ ...REPLY, channel: 'text' }, FERGUSON, RFQS)).toMatchObject({ rfqId: null, why: 'not_an_email_in' })
    expect(rfqForMessage({ ...REPLY, direction: 'out' }, FERGUSON, RFQS)).toMatchObject({ rfqId: null, why: 'not_an_email_in' })
    expect(rfqForMessage(REPLY, DANA, RFQS)).toMatchObject({ rfqId: null, why: 'not_a_supply_house' })
    expect(rfqForMessage(email('Pricing'), FERGUSON, [F2150])).toEqual({ rfqId: null, why: 'none_open', reason: 'No price request to Ferguson is open.' })
  })

  it('words every reason by the plain words rules', () => {
    const reasons = [
      rfqForMessage(email('FW', `> /q/${TOKEN_F}`), WINSUPPLY, RFQS),
      rfqForMessage(email('Your pricing'), FERGUSON, [...RFQS, F2240]),
      rfqForMessage(email('2210 and 2198'), FERGUSON, RFQS),
      rfqForMessage(email('Pricing'), FERGUSON, [F2150]),
      rfqForMessage(REPLY, DANA, RFQS),
    ].flatMap((m) => (m.rfqId === null ? [m.reason] : []))
    expect(reasons).toHaveLength(5)
    expect(reasons.flatMap(plainWordsFailures)).toEqual([])
  })
})

describe('rfqLineFacts', () => {
  it('says what it answered, the pricing and its lines when they are known', () => {
    expect(rfqLineFacts(REPLY, F2210, { attachments: 1, lines: 14 })).toEqual(['answered RFQ 2210', 'pricing attached', '14 lines'])
    expect(rfqLineFacts(REPLY, F2210, { attachments: 2 })).toEqual(['answered RFQ 2210', 'pricing attached'])
    expect(rfqLineFacts(REPLY, F2210, { lines: 1 })).toEqual(['answered RFQ 2210', '1 line'])
  })

  it('puts the subject in their place when nothing is counted', () => {
    expect(rfqLineFacts(REPLY, F2210)).toEqual(['answered RFQ 2210', 'RE: Price request · 2210 · Oakridge sewer line · 14 items'])
    expect(rfqLineFacts({ subject: '  ' }, { bidNumber: null })).toEqual(['answered the price request'])
  })

  it('words its own facts by the plain words rules', () => {
    expect(rfqLineFacts(REPLY, F2210, { attachments: 1, lines: 14 }).flatMap(plainWordsFailures)).toEqual([])
  })
})
