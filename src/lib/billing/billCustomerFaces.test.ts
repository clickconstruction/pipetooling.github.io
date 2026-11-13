import { describe, expect, it } from 'vitest'
import { BILLED_LINE } from '../tellCustomer/billedLine'
import { BILL_FACE_WORDS, SAMPLE_BILL_PAY_LINK, billEmailFace, billTextFace, type BillTextFaceRead } from './billCustomerFaces'

describe('billEmailFace · the email as the send will build it (punch list #343, PR 2)', () => {
  const input = { payerName: 'Dana Whitfield', toEmail: 'dana@example.com', jobAddress: '100 Sample St, Kyle, TX', invoiceNumber: '1042-2611131019', amountDueCents: 185000, dueYmd: '2026-11-27', canReply: true }

  it('carries the subject, the amount, the due day and the Pay now button of the real send', () => {
    const face = billEmailFace(input)
    expect(face).not.toBeNull()
    expect(face?.subject).toBe('Invoice #1042-2611131019 from Click Plumbing and Electrical')
    expect(face?.to).toBe('dana@example.com')
    expect(face?.from).toContain('Click Plumbing and Electrical')
    expect(face?.html).toContain('Hello Dana Whitfield')
    expect(face?.html).toContain('$1,850.00')
    expect(face?.html).toContain('Nov 27, 2026')
    expect(face?.html).toContain('Pay now')
    expect(face?.html).toContain('100 Sample St, Kyle, TX')
  })

  it('before Stripe has numbered the bill the subject names the company alone', () => {
    expect(billEmailFace({ ...input, invoiceNumber: '' })?.subject).toBe('Invoice from Click Plumbing and Electrical')
    expect(billEmailFace({ ...input, invoiceNumber: undefined })?.subject).toBe('Invoice from Click Plumbing and Electrical')
  })

  it('points Pay now at a sample: the real pay page is made with the bill', () => {
    expect(billEmailFace(input)?.html).toContain(SAMPLE_BILL_PAY_LINK)
  })

  it('draws nothing while the bill has no amount', () => {
    expect(billEmailFace({ ...input, amountDueCents: 0 })).toBeNull()
    expect(billEmailFace({ ...input, amountDueCents: Number.NaN })).toBeNull()
  })

  it('a missing or malformed due day leaves the day out and still draws', () => {
    expect(billEmailFace({ ...input, dueYmd: '' })?.html).toContain('$1,850.00')
    expect(billEmailFace({ ...input, dueYmd: 'soon' })?.html).not.toContain('Invalid')
  })
})

describe('billTextFace · the text the next screen would open on', () => {
  const read = (over: Partial<BillTextFaceRead> = {}): BillTextFaceRead => ({
    job: { customerId: 'cust-1', customerName: 'Dana Whitfield', jobName: 'Water heater', jobAddress: '100 Sample St', lang: 'en' },
    lines: [],
    textsOn: true,
    me: 'Rosa Alvarez',
    contact: { numbers: [{ channelId: 'ch-1', value: '5125550142', stopped: false }], lines: [] },
    ...over,
  })
  const base = { amountLabel: '$1,850.00', userId: 'user-1', office: true, nowIso: '2026-11-13T18:00:00Z' }

  it('fills the app’s own Billed line with this bill, a sample link last, to their number', () => {
    const face = billTextFace({ read: read(), ...base })
    expect(face).toEqual({
      kind: 'text',
      to: '(512) 555-0142',
      words: `Hi Dana, this is Rosa with Click Plumbing. Your bill for Water heater is ready, $1,850.00. Text me here with any question. Pay it here: ${SAMPLE_BILL_PAY_LINK}`,
      note: BILL_FACE_WORDS.appLine,
    })
    // The same words the sheet starts from: the Billed line with nothing left in braces.
    expect(BILLED_LINE.text).toContain('{bill}')
    expect(face.kind === 'text' && face.words).not.toMatch(/\{\w+\}/)
  })

  it('no number on file: the sheet’s own reason, by first name', () => {
    expect(billTextFace({ read: read({ contact: { numbers: [], lines: [] } }), ...base })).toEqual({ kind: 'hold', words: 'No text: Dana has no phone number on file. Add one on the customer.' })
  })

  it('a number that sent STOP holds the text', () => {
    const face = billTextFace({ read: read({ contact: { numbers: [{ channelId: 'ch-1', value: '5125550142', stopped: true }], lines: [] } }), ...base })
    expect(face.kind).toBe('hold')
  })

  it('texts off, no customer and a reader outside the office each read their own reason', () => {
    expect(billTextFace({ read: read({ textsOn: false }), ...base })).toEqual({ kind: 'hold', words: 'No text: texts are off. The owner or a dev turns them on in Settings → Phone and texts.' })
    expect(billTextFace({ read: read({ job: { customerId: null, customerName: null, jobName: 'Water heater', jobAddress: null, lang: 'en' }, contact: null }), ...base })).toEqual({ kind: 'hold', words: 'No text: this job has no customer yet. Add one on the job first.' })
    expect(billTextFace({ read: read(), ...base, office: false })).toEqual({ kind: 'hold', words: 'No text: only the office team texts a customer from here.' })
  })

  it('a customer with no contact yet: the words show and the number is left for the next screen', () => {
    const face = billTextFace({ read: read({ contact: null }), ...base })
    expect(face.kind).toBe('text')
    expect(face.kind === 'text' && face.to).toBeNull()
    expect(BILL_FACE_WORDS.textTo(null)).toBe('Their number is read on the next screen.')
  })

  it('the usual number wins over the first on file', () => {
    const face = billTextFace({
      read: read({ contact: { numbers: [{ channelId: 'ch-1', value: '5125550142', stopped: false }, { channelId: 'ch-2', value: '5125550199', stopped: false, usualAt: '2026-11-01T00:00:00Z' }], lines: [] } }),
      ...base,
    })
    expect(face.kind === 'text' && face.to).toBe('(512) 555-0199')
  })
})
