import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EXCLUSIONS,
  DEFAULT_TERMS_AND_WARRANTY,
  buildCoverLetterHtml,
  buildCoverLetterText,
} from './coverLetter'
import { coverLetterOrgDefaultsFrom, effectiveCoverLetterWording, letterWording } from './coverLetterWording'

const BUILT_IN = 'Built-in wording.'

describe('effectiveCoverLetterWording', () => {
  it('the bid’s own entry wins over the org default and the built-in', () => {
    expect(effectiveCoverLetterWording({ perBid: 'Bid wording.', orgDefault: 'Org wording.', builtIn: BUILT_IN })).toBe('Bid wording.')
    expect(effectiveCoverLetterWording({ perBid: 'Bid wording.', orgDefault: null, builtIn: BUILT_IN })).toBe('Bid wording.')
  })

  it('returns the bid’s entry as typed — the caller trims', () => {
    expect(effectiveCoverLetterWording({ perBid: '  Bid wording.\n', orgDefault: null, builtIn: BUILT_IN })).toBe('  Bid wording.\n')
  })

  it('uses the org default when the bid has no entry', () => {
    expect(effectiveCoverLetterWording({ perBid: undefined, orgDefault: 'Org wording.', builtIn: BUILT_IN })).toBe('Org wording.')
  })

  it('uses the built-in when the bid has no entry and no org default is saved', () => {
    expect(effectiveCoverLetterWording({ perBid: undefined, orgDefault: null, builtIn: BUILT_IN })).toBe(BUILT_IN)
    expect(effectiveCoverLetterWording({ perBid: undefined, orgDefault: undefined, builtIn: BUILT_IN })).toBe(BUILT_IN)
  })

  it('uses the built-in when the org default is blank or whitespace only', () => {
    expect(effectiveCoverLetterWording({ perBid: undefined, orgDefault: '', builtIn: BUILT_IN })).toBe(BUILT_IN)
    expect(effectiveCoverLetterWording({ perBid: undefined, orgDefault: ' \n\t ', builtIn: BUILT_IN })).toBe(BUILT_IN)
  })

  it('an emptied box gets the built-in, not the org default — the entry exists, so the letter never reads the org default', () => {
    expect(effectiveCoverLetterWording({ perBid: '', orgDefault: 'Org wording.', builtIn: BUILT_IN })).toBe(BUILT_IN)
    expect(effectiveCoverLetterWording({ perBid: '   \n ', orgDefault: 'Org wording.', builtIn: BUILT_IN })).toBe(BUILT_IN)
    expect(effectiveCoverLetterWording({ perBid: '', orgDefault: null, builtIn: BUILT_IN })).toBe(BUILT_IN)
  })
})

/**
 * The point of the kernel: for every combination the Cover Letter tab can be in, the wording it
 * resolves is the wording the letter builders print when handed the tab's own raw text
 * (`perBid ?? orgDefault ?? ''`).
 */
describe('effectiveCoverLetterWording agrees with the printed letter', () => {
  const ORG_EXCLUSIONS = 'Org exclusion one.\nOrg exclusion two.'
  const ORG_TERMS = 'Org terms, good for sixty (60) days.'
  const BID_EXCLUSIONS = 'Bid exclusion one.'
  const BID_TERMS = 'Bid terms, good for fifteen (15) days.'

  const cases: { name: string; perBidExclusions: string | undefined; perBidTerms: string | undefined; orgExclusions: string | null; orgTerms: string | null }[] = [
    { name: 'no entry, no org default', perBidExclusions: undefined, perBidTerms: undefined, orgExclusions: null, orgTerms: null },
    { name: 'no entry, org default saved', perBidExclusions: undefined, perBidTerms: undefined, orgExclusions: ORG_EXCLUSIONS, orgTerms: ORG_TERMS },
    { name: 'entry typed, org default saved', perBidExclusions: BID_EXCLUSIONS, perBidTerms: BID_TERMS, orgExclusions: ORG_EXCLUSIONS, orgTerms: ORG_TERMS },
    { name: 'entry typed, no org default', perBidExclusions: BID_EXCLUSIONS, perBidTerms: BID_TERMS, orgExclusions: null, orgTerms: null },
    { name: 'box emptied, org default saved', perBidExclusions: '', perBidTerms: '', orgExclusions: ORG_EXCLUSIONS, orgTerms: ORG_TERMS },
    { name: 'box holds only spaces, no org default', perBidExclusions: '  \n ', perBidTerms: '   ', orgExclusions: null, orgTerms: null },
    { name: 'org default is an empty string', perBidExclusions: undefined, perBidTerms: undefined, orgExclusions: '', orgTerms: '' },
  ]

  /** Every distinct wording a case could print, so the test can prove the others are absent. */
  const ALL_EXCLUSIONS = [DEFAULT_EXCLUSIONS, ORG_EXCLUSIONS, BID_EXCLUSIONS]
  const ALL_TERMS = [DEFAULT_TERMS_AND_WARRANTY, ORG_TERMS, BID_TERMS]
  const firstLine = (s: string) => s.trim().split('\n')[0]!.trim()

  for (const c of cases) {
    it(c.name, () => {
      // What the tab and the Approval PDF hand the letter builders.
      const rawExclusions = letterWording(c.perBidExclusions, c.orgExclusions)
      const rawTerms = letterWording(c.perBidTerms, c.orgTerms)
      const args: Parameters<typeof buildCoverLetterText> = ['Acme GC', '1 Main St', 'Elm St Clinic', '1 Elm St', 'ONE THOUSAND 00/100 DOLLARS', '$1,000.00', [], '', rawExclusions, rawTerms, null, 'Plumbing']
      const text = buildCoverLetterText(...args)
      const html = buildCoverLetterHtml(...(args as Parameters<typeof buildCoverLetterHtml>))

      const exclusions = effectiveCoverLetterWording({ perBid: c.perBidExclusions, orgDefault: c.orgExclusions, builtIn: DEFAULT_EXCLUSIONS })
      const terms = effectiveCoverLetterWording({ perBid: c.perBidTerms, orgDefault: c.orgTerms, builtIn: DEFAULT_TERMS_AND_WARRANTY })

      expect(exclusions.trim()).not.toBe('')
      expect(terms.trim()).not.toBe('')
      for (const candidate of ALL_EXCLUSIONS) {
        const printed = text.includes(firstLine(candidate))
        expect(printed).toBe(candidate === exclusions)
        expect(html.includes(firstLine(candidate))).toBe(printed)
      }
      for (const candidate of ALL_TERMS) {
        const printed = text.includes(firstLine(candidate))
        expect(printed).toBe(candidate === terms)
        expect(html.includes(firstLine(candidate))).toBe(printed)
      }
    })
  }
})

describe('letterWording', () => {
  it('hands the builder the bid’s entry, else the org default, else nothing', () => {
    expect(letterWording('Bid wording.', 'Org wording.')).toBe('Bid wording.')
    expect(letterWording('', 'Org wording.')).toBe('') // an emptied box: the builder prints the built-in
    expect(letterWording(undefined, 'Org wording.')).toBe('Org wording.')
    expect(letterWording(undefined, null)).toBe('')
  })

  it('never hands the builder the built-in text: built-in Terms print as one paragraph, handed Terms get a bullet', () => {
    const args = (terms: string): Parameters<typeof buildCoverLetterText> => ['Acme GC', '1 Main St', 'Elm St Clinic', '1 Elm St', 'ONE THOUSAND 00/100 DOLLARS', '$1,000.00', [], '', '', terms, null, 'Plumbing']
    expect(buildCoverLetterText(...args(letterWording(undefined, null))).split('\n')).toContain(DEFAULT_TERMS_AND_WARRANTY)
    expect(buildCoverLetterText(...args(DEFAULT_TERMS_AND_WARRANTY)).split('\n')).toContain('• ' + DEFAULT_TERMS_AND_WARRANTY)
  })
})

describe('coverLetterOrgDefaultsFrom', () => {
  it('reads the three keys, trimmed, a blank value as none saved, and ignores other keys', () => {
    expect(coverLetterOrgDefaultsFrom([
      { key: 'bid_cover_letter_exclusions_default_v1', value_text: '  Org exclusion one.\nOrg exclusion two.\n' },
      { key: 'bid_cover_letter_terms_default_v1', value_text: ' \n ' },
      { key: 'bid_cover_letter_closing_v1', value_text: 'Org closing.' },
      { key: 'bid_board_value_rule_v1', value_text: 'active_star' },
    ])).toEqual({ exclusions: 'Org exclusion one.\nOrg exclusion two.', terms: null, closing: 'Org closing.' })
  })

  it('reads none saved from no rows or null values', () => {
    expect(coverLetterOrgDefaultsFrom([])).toEqual({ terms: null, exclusions: null, closing: null })
    expect(coverLetterOrgDefaultsFrom([{ key: 'bid_cover_letter_closing_v1', value_text: null }])).toEqual({ terms: null, exclusions: null, closing: null })
  })
})
