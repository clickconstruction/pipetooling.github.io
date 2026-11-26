import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { plainSentence } from '../valuesInPlace'
import { LIEN_PRINT_STANDS_WORDS, lienPrintStandsByWords, lienPrintStandsFor, lienPrintStoodWords, type LienPrintStandsRow } from './lienPrintStands'

const row = (over: Partial<LienPrintStandsRow> = {}): LienPrintStandsRow => ({ id: 's1', jobId: 'j1', paper: 'affidavit', changeKey: 'affidavit:1:abc', changes: [], sentDocumentId: null, stoodBy: 'u1', stoodAt: '2026-11-25T20:00:00Z', ...over })

describe('lienPrintStandsFor', () => {
  it('finds the answer for this paper and this difference alone', () => {
    const rows = [row(), row({ id: 's2', jobId: 'j2' }), row({ id: 's3', paper: 'notice', changeKey: 'notice:1:abc' })]
    expect(lienPrintStandsFor(rows, 'affidavit', 'j1', 'affidavit:1:abc')?.id).toBe('s1')
    expect(lienPrintStandsFor(rows, 'affidavit', 'j1', 'affidavit:1:other')).toBeNull()
    expect(lienPrintStandsFor(rows, 'notice', 'j1', 'affidavit:1:abc')).toBeNull()
    expect(lienPrintStandsFor(rows, 'affidavit', 'j9', 'affidavit:1:abc')).toBeNull()
    // No difference has no key: nothing stands through it.
    expect(lienPrintStandsFor([row({ changeKey: '' })], 'affidavit', 'j1', '')).toBeNull()
  })
})

describe('the words', () => {
  it('says who said it stands and when', () => {
    expect(plainSentence(lienPrintStandsByWords(row(), () => 'ZZ Rosa', 'Nov 25, 2:00 PM'))).toBe('Stands as printed, by ZZ Rosa on Nov 25, 2:00 PM.')
    expect(plainSentence(lienPrintStandsByWords(row(), () => null, ''))).toBe('Stands as printed, by someone in the office.')
  })

  it('counts the affidavits that do not print again', () => {
    expect(lienPrintStoodWords(0)).toBe('')
    expect(plainSentence(lienPrintStoodWords(1))).toBe('1 affidavit stands as printed. It does not print again here.')
    expect(plainSentence(lienPrintStoodWords(2))).toBe('2 affidavits stand as printed. They do not print again here.')
  })

  it('names each press by its act, in plain words', () => {
    expect(LIEN_PRINT_STANDS_WORDS).toMatchObject({ reprint: 'Reprint this one', stands: 'It stands as printed', takeOut: 'Take it out of the run', takeBack: 'Take back' })
    for (const w of [LIEN_PRINT_STANDS_WORDS.stoodLead, LIEN_PRINT_STANDS_WORDS.notStood, LIEN_PRINT_STANDS_WORDS.notTakenBack, plainSentence(lienPrintStoodWords(2))]) for (const sentence of w.split(/(?<=\.)\s+/)) expect(plainWordsFailures(sentence), sentence).toEqual([])
  })
})
