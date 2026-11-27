/**
 * What a paper prints of its site (punch list #439, piece 3, part 3e): the one rule the signer's function, the
 * signing and the signed PDF all read. Every address here is made up.
 */
import { describe, expect, it } from 'vitest'
import { SITE_PRINT_ADDRESS_MAX, SITE_PRINT_LABEL, answersSitePrint, printedSiteAddress, sitePrintLine, siteShownAtSigning, withSitePrintLine } from '../../../supabase/functions/_shared/paperSitePrint'

const QUARRY = '118 Old Quarry Trl, Sampleton, TX'
const COVE = '801 Magnolia Cove, Exampleville, TX'

describe('printedSiteAddress', () => {
  it('is the address only when the box is on and the row keeps one', () => {
    expect(printedSiteAddress({ site_address: QUARRY, site_prints_address: true })).toBe(QUARRY)
    expect(printedSiteAddress({ site_address: QUARRY, site_prints_address: false })).toBeNull()
    expect(printedSiteAddress({ site_address: null, site_prints_address: true })).toBeNull()
    expect(printedSiteAddress({ site_address: '   ', site_prints_address: true })).toBeNull()
  })

  it('prints nothing for a row read without the columns, or a box that is anything but true', () => {
    expect(printedSiteAddress({})).toBeNull()
    expect(printedSiteAddress(null)).toBeNull()
    expect(printedSiteAddress(undefined)).toBeNull()
    expect(printedSiteAddress({ site_address: QUARRY })).toBeNull()
    for (const on of ['true', 1, 't', null, {}]) expect(printedSiteAddress({ site_address: QUARRY, site_prints_address: on })).toBeNull()
    expect(printedSiteAddress({ site_address: 118, site_prints_address: true })).toBeNull()
  })

  it('cleans the address as the row keeps it: trimmed, one space, cut to its length', () => {
    expect(printedSiteAddress({ site_address: `  118  Old Quarry Trl,\n Sampleton, TX `, site_prints_address: true })).toBe(QUARRY)
    expect(printedSiteAddress({ site_address: 'a'.repeat(SITE_PRINT_ADDRESS_MAX + 40), site_prints_address: true })).toHaveLength(SITE_PRINT_ADDRESS_MAX)
  })
})

describe('siteShownAtSigning', () => {
  it('asks nothing of a paper that prints no address, whatever the page sent', () => {
    for (const row of [{}, null, { site_address: QUARRY, site_prints_address: false }, { site_address: null, site_prints_address: true }]) {
      expect(siteShownAtSigning(row, undefined)).toBe(true)
      expect(siteShownAtSigning(row, QUARRY)).toBe(true)
    }
  })

  it('takes a signature for a paper that prints one only from a page that showed that address', () => {
    const row = { site_address: QUARRY, site_prints_address: true }
    expect(siteShownAtSigning(row, QUARRY)).toBe(true)
    expect(siteShownAtSigning(row, `  ${QUARRY} `)).toBe(true)
    // A page that showed none, an older page among them, and a page that showed another address.
    expect(siteShownAtSigning(row, undefined)).toBe(false)
    expect(siteShownAtSigning(row, null)).toBe(false)
    expect(siteShownAtSigning(row, '')).toBe(false)
    expect(siteShownAtSigning(row, true)).toBe(false)
    expect(siteShownAtSigning(row, COVE)).toBe(false)
  })
})

describe('answersSitePrint', () => {
  it('is true for an answer with the key, as an address or as null', () => {
    expect(answersSitePrint({ id: 'p1', site_address: null })).toBe(true)
    expect(answersSitePrint({ id: 'p1', site_address: QUARRY })).toBe(true)
  })

  it('is false for an older function’s answer, and for anything that is no answer', () => {
    expect(answersSitePrint({ id: 'p1', document_name: 'Vendor NDA' })).toBe(false)
    for (const body of [null, undefined, 'site_address', 7, ['site_address']]) expect(answersSitePrint(body)).toBe(false)
  })
})

describe('the signed paper’s line', () => {
  it('says the label and the address, in the paper’s language', () => {
    expect(sitePrintLine(QUARRY)).toBe(`Site address: ${QUARRY}`)
    expect(sitePrintLine(QUARRY, 'es')).toBe(`Dirección de la obra: ${QUARRY}`)
    expect(SITE_PRINT_LABEL).toEqual({ en: 'Site address', es: 'Dirección de la obra' })
  })

  it('opens the words of a paper that prints its address, and leaves any other paper’s as they were', () => {
    const words = ['Between Sample Plumbing Co. and Tallgrass Supply Co.', '1. Keep it secret.']
    expect(withSitePrintLine(words, { site_address: QUARRY, site_prints_address: true })).toEqual([`Site address: ${QUARRY}`, ...words])
    expect(withSitePrintLine(words, { site_address: QUARRY, site_prints_address: false })).toBe(words)
    expect(withSitePrintLine(words, {})).toBe(words)
    expect(withSitePrintLine(words, null)).toBe(words)
  })

  it('follows the language the paper was signed in, and adds no line to a paper with no words', () => {
    const row = { site_address: QUARRY, site_prints_address: true }
    expect(withSitePrintLine(['1. Guarde el secreto.'], { ...row, clause_versions: { lang: 'es' } })[0]).toBe(`Dirección de la obra: ${QUARRY}`)
    expect(withSitePrintLine(['1. Keep it secret.'], { ...row, clause_versions: { lang: 'en' } })[0]).toBe(`Site address: ${QUARRY}`)
    expect(withSitePrintLine(['1. Keep it secret.'], { ...row, clause_versions: null })[0]).toBe(`Site address: ${QUARRY}`)
    expect(withSitePrintLine([], row)).toEqual([])
  })
})
