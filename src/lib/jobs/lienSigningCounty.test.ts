import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import type { PhysicalInvoiceIssuer } from '../physicalInvoiceIssuer'
import { signingCountyHint, signingCountyWords, withSigningCounty } from './lienSigningCounty'

// Every name and county here is made up.
const issuer: PhysicalInvoiceIssuer = { companyName: 'Sample Plumbing LLC', addressText: '100 Made Up Rd', phone: '', email: '', tagline: '', licenseLine: '', signingCounty: 'Alder' }

describe('the county a lien paper is signed in, for one print (punch list #314)', () => {
  it('nothing typed leaves the issuer as Settings hold it', () => {
    expect(withSigningCounty(issuer, null)).toBe(issuer)
    expect(withSigningCounty(issuer, undefined)).toBe(issuer)
    expect(withSigningCounty(null, null)).toBeNull()
  })
  it('a typed county goes on a copy of the issuer, and Settings’ own row is untouched', () => {
    const typed = withSigningCounty(issuer, '  Cedar ')
    expect(typed?.signingCounty).toBe('Cedar')
    expect(typed?.companyName).toBe('Sample Plumbing LLC')
    expect(issuer.signingCounty).toBe('Alder')
  })
  it('a box cleared prints no county, so the notary writes it by hand', () => {
    expect(withSigningCounty(issuer, '')?.signingCounty).toBe('')
    expect(withSigningCounty(null, '')).toBeNull()
    expect(withSigningCounty(null, 'Cedar')?.signingCounty).toBe('Cedar')
  })
  it('says the county once, however Settings hold it', () => {
    expect(signingCountyWords('Alder')).toBe('Alder County')
    expect(signingCountyWords('Alder County')).toBe('Alder County')
    expect(signingCountyWords('  ')).toBe('')
    expect(signingCountyWords(null)).toBe('')
  })
  it('the line under the box says what the paper will print, in plain words', () => {
    expect(signingCountyHint('Alder')).toBe('Both county lines print Alder County. Signing somewhere else? Type that county for this print.')
    expect(signingCountyHint('')).toBe('Left blank, the notary writes both county lines by hand. Type the county where it is signed to print it.')
    for (const s of [signingCountyHint('Alder'), signingCountyHint('')]) expect(plainWordsFailures(s), s).toEqual([])
  })
})
