import { describe, expect, it } from 'vitest'
import { buildOwnerPacket } from './ownerRecords'
import { OWNER_RECORDS_NO_ADDRESS, ownerAcknowledgmentHtml, ownerAcknowledgmentLines, ownerCoverNoteLines, ownerPacketHtml, ownerPaymentWhen, type OwnerRecordsDocFacts, type OwnerRecordsDocFormat } from './ownerRecordsDocs'

const fmt: OwnerRecordsDocFormat = { day: (ymd) => `D(${ymd})`, dateTime: (iso) => `T(${iso.slice(0, 16)})`, money: (n) => `$${n.toFixed(2)}` }
const facts: OwnerRecordsDocFacts = { company: 'Click Plumbing and Electrical', owner: 'Khan Umar & Bangash Shazmeena', address: '9703 Lenox Hl, San Antonio', asOfYmd: '2026-10-05', requestedOnYmd: '2026-10-03' }

describe('the words', () => {
  it('the cover note says they asked, as of when, what is inside, and that we keep our rights', () => {
    expect(ownerCoverNoteLines(facts, fmt)).toEqual([
      'You asked us in writing on D(2026-10-03) for our records on 9703 Lenox Hl, San Antonio. They are enclosed.',
      'This statement comes from our business records as of D(2026-10-05).',
      'It lists each job at this property, each bill, and each payment we received on those bills.',
      'It is not legal advice, and it says nothing about anyone else.',
      'Click Plumbing and Electrical keeps every right it has, including its lien rights.',
    ])
    expect(ownerCoverNoteLines({ ...facts, requestedOnYmd: null }, fmt)[0]).toBe('You asked us in writing for our records on 9703 Lenox Hl, San Antonio. They are enclosed.')
  })

  it('the acknowledgment is six plain statements', () => {
    const lines = ownerAcknowledgmentLines(facts, fmt)
    expect(lines).toHaveLength(6)
    expect(lines[1]).toBe('I asked Click Plumbing and Electrical in writing for its records on work at this property.')
    expect(lines[4]).toBe('Click Plumbing and Electrical gives up none of its rights by giving me these records, including its lien rights.')
    expect(lines[5]).toBe('I will not hold Click Plumbing and Electrical responsible for how I use these records.')
  })

  it('a job with no address reads "this property", never "the property at ." (v2.4866)', () => {
    // The portal passes the request's blank address; the window passes its own fallback.
    for (const address of ['', '  ', OWNER_RECORDS_NO_ADDRESS]) {
      expect(ownerAcknowledgmentLines({ ...facts, address }, fmt)[0]).toBe('I am an owner of this property.')
      expect(ownerCoverNoteLines({ ...facts, address }, fmt)[0]).toBe('You asked us in writing on D(2026-10-03) for our records on this property. They are enclosed.')
    }
    expect(ownerAcknowledgmentLines(facts, fmt)[0]).toBe('I am an owner of the property at 9703 Lenox Hl, San Antonio.')
  })

  it('a payment says the day it was paid, when it was recorded and how', () => {
    expect(ownerPaymentWhen({ id: 'p', amount: 5000, paidOn: '2026-08-14', recordedAt: '2026-08-15T14:00:00Z', type: 'Check', reference: '1042' }, fmt)).toBe('D(2026-08-14) · recorded T(2026-08-15T14:00) · Check 1042')
    expect(ownerPaymentWhen({ id: 'p', amount: 1, paidOn: null, recordedAt: null, type: '', reference: '' }, fmt)).toBe('no paid date')
  })
})

describe('the papers', () => {
  const packet = buildOwnerPacket([
    {
      id: 'j273',
      number: '273',
      name: 'Dudley <Lennox>',
      address: '9703 Lenox Hl',
      gcName: 'RMC- Dudley Mason',
      total: 20000,
      bills: [{ id: 'b1', amount: 12000, status: 'billed', billedAt: '2026-08-03T15:00:00Z', order: 0 }],
      payments: [
        { id: 'p1', billId: 'b1', amount: 5000, paidOn: '2026-08-14', recordedAt: '2026-08-15T14:00:00Z', type: 'Check', reference: '1042' },
        { id: 'p2', billId: null, amount: 415, paidOn: '2026-09-10', recordedAt: null, type: null, reference: null },
      ],
    },
  ])

  it('the packet is the cover note, the summary and each job with its bills and payments; what a person typed is escaped', () => {
    const html = ownerPacketHtml(packet, { ...facts, owner: 'Khan & <Co>' }, fmt)
    expect(html).toContain('Khan &amp; &lt;Co&gt;')
    expect(html).toContain('Dudley &lt;Lennox&gt;')
    expect(html).not.toContain('<Lennox>')
    expect(html).toContain('Statement for 9703 Lenox Hl, San Antonio')
    expect(html).toContain('You asked us in writing on D(2026-10-03)')
    expect(html).toContain('Bill 1 · billed D(2026-08-03)')
    expect(html).toContain('Payment · D(2026-08-14) · recorded T(2026-08-15T14:00) · Check 1042')
    expect(html).toContain('Payments on the job that name no bill')
    expect(html).not.toContain('not billed')
    expect(html).toContain('Paid on this job')
    expect(html).not.toContain('>Billed<')
    expect(html).toContain('Still owed on this job')
    expect(html).toContain('$14585.00')
  })

  it('the acknowledgment has its six statements and the lines to sign', () => {
    const html = ownerAcknowledgmentHtml(facts, fmt)
    expect(html).toContain('Acknowledgment of a records request')
    expect((html.match(/<li>/g) ?? []).length).toBe(6)
    for (const label of ['Signature', 'Date', 'Printed name']) expect(html).toContain(`>${label}<`)
  })
})
