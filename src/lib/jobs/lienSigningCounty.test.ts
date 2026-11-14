import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import type { PhysicalInvoiceIssuer } from '../physicalInvoiceIssuer'
import { LIEN_SIGNING_COUNTY_PLACEHOLDER, signingCountyTip, signingCountyWords, withSigningCounty } from './lienSigningCounty'

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
  it('the empty box says who writes the lines, and the ? says what typing does, in plain words (v2.7209)', () => {
    expect(LIEN_SIGNING_COUNTY_PLACEHOLDER).toBe('the notary writes it')
    expect(signingCountyTip('')).toBe('Type the county where it is signed to print it on both county lines.')
    expect(signingCountyTip('  ')).toBe(signingCountyTip(null))
  })
  it('with a county in the box, typed or from Settings, the ? says what the paper will print', () => {
    expect(signingCountyTip('Alder')).toBe('Both county lines print Alder County. Signing somewhere else? Type that county for this print.')
    expect(signingCountyTip('Alder County')).toBe(signingCountyTip('Alder'))
    for (const s of [signingCountyTip('Alder'), signingCountyTip(''), LIEN_SIGNING_COUNTY_PLACEHOLDER]) expect(plainWordsFailures(s), s).toEqual([])
  })
})
