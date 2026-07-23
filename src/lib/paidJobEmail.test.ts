import { describe, expect, it } from 'vitest'
import {
  paidEmailVariantForRole,
  parsePaidJobEmailRecipients,
  serializePaidJobEmailRecipients,
} from './paidJobEmail'

const A = '11111111-2222-3333-4444-555555555555'
const B = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

describe('parsePaidJobEmailRecipients', () => {
  it('parses a JSON array of uuid strings', () => {
    expect(parsePaidJobEmailRecipients(JSON.stringify([A, B]))).toEqual([A, B])
  })

  it('drops non-uuid entries and non-strings', () => {
    expect(parsePaidJobEmailRecipients(JSON.stringify([A, 'nope', 42, null]))).toEqual([A])
  })

  it('dedupes and trims', () => {
    expect(parsePaidJobEmailRecipients(JSON.stringify([` ${A} `, A]))).toEqual([A])
  })

  it('invalid JSON / wrong shape / missing ⇒ []', () => {
    expect(parsePaidJobEmailRecipients('not json')).toEqual([])
    expect(parsePaidJobEmailRecipients('{"a":1}')).toEqual([])
    expect(parsePaidJobEmailRecipients('')).toEqual([])
    expect(parsePaidJobEmailRecipients(null)).toEqual([])
    expect(parsePaidJobEmailRecipients(undefined)).toEqual([])
  })
})

describe('serializePaidJobEmailRecipients', () => {
  it('round-trips through the parser', () => {
    expect(parsePaidJobEmailRecipients(serializePaidJobEmailRecipients([A, B]))).toEqual([A, B])
    expect(serializePaidJobEmailRecipients([])).toBe('[]')
  })
})

describe('paidEmailVariantForRole', () => {
  it('devs and masters get the detailed variant', () => {
    expect(paidEmailVariantForRole('dev')).toBe('detailed')
    expect(paidEmailVariantForRole('master_technician')).toBe('detailed')
  })

  it('everyone else (and unknown/missing roles) gets the sterilized summary', () => {
    expect(paidEmailVariantForRole('assistant')).toBe('summary')
    expect(paidEmailVariantForRole('technician')).toBe('summary')
    expect(paidEmailVariantForRole('controller')).toBe('summary')
    expect(paidEmailVariantForRole(null)).toBe('summary')
    expect(paidEmailVariantForRole(undefined)).toBe('summary')
  })
})
