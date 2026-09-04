import { describe, expect, it } from 'vitest'
import {
  isSignedAgreementDefaultRole,
  parseAutoCreateFlag,
  parseSignedAgreementRecipients,
  serializeAutoCreateFlag,
  serializeSignedAgreementRecipients,
} from './signedAgreementsStream'

describe('signedAgreementsStream (v2.2743)', () => {
  it('default roles are the four job-capable roles', () => {
    for (const r of ['dev', 'master_technician', 'assistant', 'controller']) expect(isSignedAgreementDefaultRole(r)).toBe(true)
    for (const r of ['estimator', 'primary', 'superintendent', null, undefined]) expect(isSignedAgreementDefaultRole(r)).toBe(false)
  })
  it('recipients round-trip, dedupe, and tolerate junk', () => {
    expect(parseSignedAgreementRecipients('["a"," b ","a",3,""]')).toEqual(['a', 'b'])
    expect(parseSignedAgreementRecipients('not json')).toEqual([])
    expect(parseSignedAgreementRecipients(null)).toEqual([])
    expect(serializeSignedAgreementRecipients(['x', 'x', ' y'])).toBe('["x","y"]')
  })
  it('auto-create flag', () => {
    expect(parseAutoCreateFlag('1')).toBe(true)
    expect(parseAutoCreateFlag('TRUE')).toBe(true)
    expect(parseAutoCreateFlag('0')).toBe(false)
    expect(parseAutoCreateFlag(null)).toBe(false)
    expect(serializeAutoCreateFlag(true)).toBe('1')
    expect(serializeAutoCreateFlag(false)).toBe('0')
  })
})
