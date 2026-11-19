import { describe, expect, it } from 'vitest'
import { oneClosingPeriod } from './nameClosesSentence'

describe('oneClosingPeriod: a name that ends in a period takes no second one (v2.7957)', () => {
  it('drops the period a sentence adds after the name, each time', () => {
    const text = 'We work under Acme & Assoc.. Acme & Assoc. has not paid us. Do not pay Acme & Assoc..'
    expect(oneClosingPeriod(text, ['Acme & Assoc.'])).toBe('We work under Acme & Assoc. Acme & Assoc. has not paid us. Do not pay Acme & Assoc.')
  })

  it('a name with no period at its end changes nothing', () => {
    const text = 'We work under Acme Builders. Pay only Example Plumbing.'
    expect(oneClosingPeriod(text, ['Acme Builders', 'Example Plumbing'])).toBe(text)
    expect(oneClosingPeriod(text, ['', null, undefined])).toBe(text)
  })

  it('handles both names, the possessive, and a name with marks a pattern would read', () => {
    expect(oneClosingPeriod('Without Acme & Assoc.’s okay, pay only Example Plumbing Co.. Thank you.', ['Acme & Assoc.', 'Example Plumbing Co.'])).toBe(
      'Without Acme & Assoc.’s okay, pay only Example Plumbing Co. Thank you.',
    )
    expect(oneClosingPeriod('A copy goes to J. (Jo) Example Inc..', ['J. (Jo) Example Inc.'])).toBe('A copy goes to J. (Jo) Example Inc.')
    // A dollar sign in a name is not read as a replacement pattern.
    expect(oneClosingPeriod('Paid by Sav$& Co..', ['Sav$& Co.'])).toBe('Paid by Sav$& Co.')
  })

  it('leaves an ellipsis after the name as typed', () => {
    expect(oneClosingPeriod('And then Acme & Assoc....', ['Acme & Assoc.'])).toBe('And then Acme & Assoc....')
  })
})
