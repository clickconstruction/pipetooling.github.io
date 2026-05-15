import { describe, expect, it } from 'vitest'
import {
  anyLineSegmentsStartWithLowercase,
  firstLetterLooksLowercase,
  invoiceDescriptionsNeedLowercaseLeadingHint,
} from './invoiceLineDescriptionLeadingLowercase'

describe('firstLetterLooksLowercase', () => {
  it('false for empty or whitespace', () => {
    expect(firstLetterLooksLowercase('')).toBe(false)
    expect(firstLetterLooksLowercase('   ')).toBe(false)
  })

  it('true when first letter is ascii lowercase', () => {
    expect(firstLetterLooksLowercase('install hot water')).toBe(true)
    expect(firstLetterLooksLowercase('install')).toBe(true)
  })

  it('false when first letter is ascii uppercase', () => {
    expect(firstLetterLooksLowercase('Install hot water')).toBe(false)
    expect(firstLetterLooksLowercase('API hookup')).toBe(false)
  })

  it('skips non-letters until first letter', () => {
    expect(firstLetterLooksLowercase('• install')).toBe(true)
    expect(firstLetterLooksLowercase('1. Foo')).toBe(false)
    expect(firstLetterLooksLowercase('• Install')).toBe(false)
    expect(firstLetterLooksLowercase('123 install')).toBe(true)
  })

  it('accented lowercase ll', () => {
    expect(firstLetterLooksLowercase('été repipe')).toBe(true)
    expect(firstLetterLooksLowercase('Électric rough-in')).toBe(false)
  })
})

describe('anyLineSegmentsStartWithLowercase', () => {
  it('false when no segment has lowercase lead', () => {
    expect(anyLineSegmentsStartWithLowercase('Line one\nLine two')).toBe(false)
    expect(anyLineSegmentsStartWithLowercase('Hello')).toBe(false)
  })

  it('true when any segment has lowercase lead', () => {
    expect(anyLineSegmentsStartWithLowercase('Hello\ninstall second line')).toBe(true)
    expect(anyLineSegmentsStartWithLowercase('\n  bad start\n')).toBe(true)
  })
})

describe('invoiceDescriptionsNeedLowercaseLeadingHint', () => {
  it('false for empty list or all clean', () => {
    expect(invoiceDescriptionsNeedLowercaseLeadingHint([])).toBe(false)
    expect(invoiceDescriptionsNeedLowercaseLeadingHint(['  ', 'Good Line'])).toBe(false)
  })

  it('true if any description needs hint', () => {
    expect(invoiceDescriptionsNeedLowercaseLeadingHint(['Good', 'lowercase bad'])).toBe(true)
  })
})
