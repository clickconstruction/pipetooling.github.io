import { describe, expect, it } from 'vitest'
import { SEND_EMAIL_RE, estimateRecipientEmail, estimateSendPlan, type EstimateSendPlanInput } from './estimateSendPlan'

const base: EstimateSendPlanInput = { customerEmail: 'owner@customer.test', override: '', isChangeOrder: false, totalCents: 125_00, role: 'assistant' }

describe('estimateRecipientEmail', () => {
  it('takes the customer’s own email over a typed one', () => {
    expect(estimateRecipientEmail('owner@customer.test', 'other@customer.test')).toBe('owner@customer.test')
  })

  it('falls back to the typed address, trimmed', () => {
    expect(estimateRecipientEmail('', '  other@customer.test ')).toBe('other@customer.test')
    expect(estimateRecipientEmail('   ', 'other@customer.test')).toBe('other@customer.test')
    expect(estimateRecipientEmail(null, 'other@customer.test')).toBe('other@customer.test')
  })

  it('is empty when there is neither', () => {
    expect(estimateRecipientEmail('', '   ')).toBe('')
    expect(estimateRecipientEmail(undefined, undefined)).toBe('')
  })
})

describe('SEND_EMAIL_RE', () => {
  it('wants something, an at sign, something, a dot, something', () => {
    expect(SEND_EMAIL_RE.test('a@b.co')).toBe(true)
    expect(SEND_EMAIL_RE.test('a@b')).toBe(false)
    expect(SEND_EMAIL_RE.test('a b@c.co')).toBe(false)
    expect(SEND_EMAIL_RE.test('@b.co')).toBe(false)
  })
})

describe('estimateSendPlan', () => {
  it('stops with no address anywhere', () => {
    expect(estimateSendPlan({ ...base, customerEmail: '', override: '  ' })).toEqual({ kind: 'refuse', why: 'This customer has no email on file. Enter a send-to email below.' })
  })

  it('stops on an address that is not one', () => {
    expect(estimateSendPlan({ ...base, customerEmail: '', override: 'not-an-email' })).toEqual({ kind: 'refuse', why: 'Enter a valid email address.' })
  })

  it('opens Tell the customer for a normal estimate above $0 sent by the office', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'estimator'] as const) {
      expect(estimateSendPlan({ ...base, role })).toEqual({ kind: 'sheet', email: 'owner@customer.test' })
    }
  })

  it('sends the sheet the typed address when the customer has none', () => {
    expect(estimateSendPlan({ ...base, customerEmail: '', override: 'typed@customer.test' })).toEqual({ kind: 'sheet', email: 'typed@customer.test' })
  })

  it('asks a role outside the office to confirm, naming the recipient', () => {
    for (const role of ['primary', 'superintendent', 'subcontractor', null, undefined] as const) {
      expect(estimateSendPlan({ ...base, role })).toEqual({
        kind: 'confirm',
        email: 'owner@customer.test',
        title: 'Send to customer?',
        message: 'Send to owner@customer.test?',
        confirmLabel: 'Send',
      })
    }
  })

  it('asks before a change order goes for signature, whatever the role', () => {
    expect(estimateSendPlan({ ...base, isChangeOrder: true })).toEqual({
      kind: 'confirm',
      email: 'owner@customer.test',
      title: 'Send for signature?',
      message: 'Send to owner@customer.test?',
      confirmLabel: 'Send',
    })
  })

  it('never sends $0 silently: the ask says the total and the press says Send anyway', () => {
    expect(estimateSendPlan({ ...base, totalCents: 0 })).toEqual({
      kind: 'confirm',
      email: 'owner@customer.test',
      title: 'Send to customer?',
      message: 'Send to owner@customer.test? The total is $0.00.',
      confirmLabel: 'Send anyway',
    })
    expect(estimateSendPlan({ ...base, totalCents: 0, isChangeOrder: true })).toMatchObject({
      kind: 'confirm',
      message: 'Send to owner@customer.test? The net change to contract is $0.00.',
      confirmLabel: 'Send anyway',
    })
  })

  it('keeps a credit change order on the confirm, with no $0 note', () => {
    expect(estimateSendPlan({ ...base, isChangeOrder: true, totalCents: -50_00 })).toMatchObject({ kind: 'confirm', message: 'Send to owner@customer.test?', confirmLabel: 'Send' })
  })
})
