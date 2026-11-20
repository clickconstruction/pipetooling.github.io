/** The summary, the level and the sample of a paper built from settings (punch list #389, step 2). Made-up words only. */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { parseSettingsDef, type SettingsDef } from './paperSettings'
import { LEVEL_MIX, SAMPLE_PARTY, SUMMARY_NOTE, levelLine, levelOf, levelWords, samplePress, sampleStamp, summaryLines } from './paperSummary'

const def = parseSettingsDef({
  settings: [
    { key: 'photos', label: 'Photos and video', labelEs: 'Fotos y video', choices: [
      { key: 'off', label: 'Off', says: 'Nothing is asked about photos.', out: true },
      { key: 'standard', label: 'Standard', labelEs: 'Estándar', says: 'A placeholder line for standard.', saysEs: 'Una línea de ejemplo.' },
      { key: 'strict', label: 'Strict', says: 'A placeholder line for strict.' },
    ] },
    { key: 'term', label: 'How long secrecy lasts', choices: [
      { key: 'short', label: 'Short', says: 'A placeholder line for short.' },
      { key: 'long', label: 'Long', says: 'A placeholder line for long.' },
    ] },
  ],
  fields: [],
  levels: [
    { key: 'standard', label: 'Standard', labelEs: 'Estándar', alignedWith: 'Aligned with regular businesses', alignedWithEs: 'Alineado con negocios comunes', picks: { photos: 'standard', term: 'short' } },
    { key: 'strict', label: 'Strict', alignedWith: 'Aligned with private research labs', picks: { photos: 'strict', term: 'long' } },
  ],
}) as SettingsDef

describe('the level', () => {
  it('is the named level whose every pick matches, else a mix of its own', () => {
    expect(levelOf(def, { photos: 'standard', term: 'short' })?.key).toBe('standard')
    expect(levelOf(def, { photos: 'strict', term: 'long' })?.key).toBe('strict')
    expect(levelOf(def, { photos: 'strict', term: 'short' })).toBeNull()
    expect(levelOf(def, { photos: 'standard' })).toBeNull()
  })

  it('reads as a name and the kind of place beside it, never a score', () => {
    expect(levelWords(def, { photos: 'standard', term: 'short' })).toEqual({ name: 'Standard', aligned: 'Aligned with regular businesses' })
    expect(levelLine(def, { photos: 'standard', term: 'short' })).toBe('Standard, aligned with regular businesses')
    expect(levelLine(def, { photos: 'strict', term: 'short' })).toBe(LEVEL_MIX.en)
    expect(levelLine(def, { photos: 'standard', term: 'short' }, 'es')).toBe('Estándar, alineado con negocios comunes')
    expect(levelLine(def, { photos: 'strict', term: 'long' }, 'es')).toBe('Strict, aligned with private research labs')
    expect(levelLine(def, { photos: 'off', term: 'short' }, 'es')).toBe(LEVEL_MIX.es)
  })
})

describe('the summary', () => {
  it('says each pick in the list’s own words, a line a setting', () => {
    expect(summaryLines(def, { photos: 'off', term: 'long' })).toEqual([
      { key: 'photos', label: 'Photos and video', choice: 'Off', says: 'Nothing is asked about photos.', out: true },
      { key: 'term', label: 'How long secrecy lasts', choice: 'Long', says: 'A placeholder line for long.', out: false },
    ])
  })

  it('shows the Spanish where it has one and the English where it has none', () => {
    expect(summaryLines(def, { photos: 'standard', term: 'short' }, 'es')).toEqual([
      { key: 'photos', label: 'Fotos y video', choice: 'Estándar', says: 'Una línea de ejemplo.', out: false },
      { key: 'term', label: 'How long secrecy lasts', choice: 'Short', says: 'A placeholder line for short.', out: false },
    ])
  })

  it('leaves out a setting with no pick of its own', () => {
    expect(summaryLines(def, { photos: 'loud', term: 'short' }).map((l) => l.key)).toEqual(['term'])
  })

  it('carries a note that passes the plain-words rules', () => {
    expect(plainWordsFailures(SUMMARY_NOTE.en)).toEqual([])
  })
})

describe('the sample', () => {
  it('names nobody real', () => {
    expect(SAMPLE_PARTY).toEqual({ company: 'Sample Sub LLC', signer: 'Jordan Sample', job: 'Job J0000, a sample' })
  })

  it('is stamped as a sample, with its level and its revision', () => {
    expect(sampleStamp(def, { photos: 'standard', term: 'short' }, 4)).toBe('SAMPLE, not for signature. Standard, aligned with regular businesses. Revision 4.')
    expect(sampleStamp(def, { photos: 'off', term: 'short' }, 4, 'es')).toBe('MUESTRA, no es para firmar. Una combinación propia. Revisión 4.')
  })

  it('has no print for a paper that cannot go', () => {
    expect(samplePress(null)).toEqual({ label: 'Print the sample', dead: false, why: null })
    expect(samplePress('Photos and video has no wording for Strict.')).toEqual({ label: 'Print the sample', dead: true, why: 'Photos and video has no wording for Strict.' })
  })
})
