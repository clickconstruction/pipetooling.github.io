import { describe, expect, it } from 'vitest'
import { canHandThePhone, handPhoneDoorText, handPhoneState, inPersonSigningUrl } from './jobContractInPerson'

describe('jobContractInPerson', () => {
  it('the roles that speak for the company on site may hand the phone; subs, helpers and the office may not', () => {
    for (const r of ['dev', 'master_technician', 'primary', 'superintendent', 'estimator']) expect(canHandThePhone(r)).toBe(true)
    for (const r of ['subcontractor', 'helpers', 'assistant', 'controller', null, undefined, '']) expect(canHandThePhone(r)).toBe(false)
  })
  it('adds the in-person flag to the signing link, whatever it already carries', () => {
    expect(inPersonSigningUrl('https://clicktooling.com/contract/sign?t=abc')).toBe('https://clicktooling.com/contract/sign?t=abc&inperson=1')
    expect(inPersonSigningUrl('https://clicktooling.com/contract/sign?t=abc&inperson=1')).toBe('https://clicktooling.com/contract/sign?t=abc&inperson=1')
    expect(inPersonSigningUrl('/contract/sign?t=abc')).toBe('/contract/sign?t=abc&inperson=1')
  })
  it('reads the job’s rows: a signed agreement hides the door, a live one is reused, voided rows do not count', () => {
    expect(handPhoneState([])).toBe('none')
    expect(handPhoneState([{ status: 'signed', voided_at: null }])).toBe('signed')
    expect(handPhoneState([{ status: 'signed', voided_at: '2026-09-01T00:00:00Z' }, { status: 'draft', voided_at: null }])).toBe('draft')
    expect(handPhoneState([{ status: 'sent', voided_at: null }, { status: 'draft', voided_at: null }])).toBe('sent')
    expect(handPhoneDoorText('signed')).toBeNull()
    expect(handPhoneDoorText('none')?.label).toBe('Hand the phone to the customer to sign')
    expect(handPhoneDoorText('sent')?.title).toContain('already out')
  })
})
