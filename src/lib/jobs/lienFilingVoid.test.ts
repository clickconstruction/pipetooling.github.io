import { describe, expect, it } from 'vitest'
import { LIEN_TAKE_BACK_WORDS, lienNotTakenBackWords, lienTakenBackWords, lienVoidPaperOutcome, lienVoidPaperStuck, lienVoidPaperWords, type LienVoidPaperRow } from './lienFilingVoid'
import { plainWordsFailures } from '../plainWords'

const paper = (id: string, status: string, voided = false): LienVoidPaperRow => ({ id, status, voided_at: voided ? '2026-11-19T10:00:00Z' : null })

describe('lienVoidPaperOutcome: what the void did to the lien’s paper', () => {
  it('a paper that carried an approval is approved again', () => {
    expect(lienVoidPaperOutcome(['p1'], [paper('p1', 'approved')])).toBe('approved')
  })

  it('a paper nobody had approved is the office’s draft again', () => {
    expect(lienVoidPaperOutcome(['p1'], [paper('p1', 'drafted')])).toBe('drafted')
  })

  it('a paper set aside for a newer one says so', () => {
    expect(lienVoidPaperOutcome(['p1'], [paper('p1', 'sent', true)])).toBe('set_aside')
  })

  it('a paper still sent is the gap this version closes: the database did not move it', () => {
    expect(lienVoidPaperOutcome(['p1'], [paper('p1', 'sent')])).toBe('still_sent')
    // One stuck paper is said, whatever happened to another.
    expect(lienVoidPaperOutcome(['p1', 'p2'], [paper('p1', 'approved'), paper('p2', 'sent')])).toBe('still_sent')
  })

  it('no paper tied to the filing, or a read that came back empty, says nothing about a paper', () => {
    expect(lienVoidPaperOutcome([], [paper('p1', 'sent')])).toBe('none')
    expect(lienVoidPaperOutcome(['p1'], [])).toBe('none')
    // A paper that was not tied to this filing is not this void's to speak of.
    expect(lienVoidPaperOutcome(['p1'], [paper('p9', 'sent')])).toBe('none')
  })
})

describe('the words', () => {
  it('the Lien window says where the paper went', () => {
    expect(lienVoidPaperWords('approved')).toBe('Record voided. The lien’s paper is approved again and back on the Lien desk.')
    expect(lienVoidPaperWords('drafted')).toBe('Record voided. The lien’s paper is back on the Lien desk as a draft.')
    expect(lienVoidPaperWords('set_aside')).toBe('Record voided. A newer paper for this lien is on the Lien desk, so the old one is set aside.')
    expect(lienVoidPaperWords('still_sent')).toBe('Record voided. Its paper still reads as filed on the Lien desk. Tell your lead.')
    expect(lienVoidPaperWords('none')).toBe('Record voided.')
  })

  it('only a paper that did not move is a warning', () => {
    expect((['approved', 'drafted', 'set_aside', 'still_sent', 'none'] as const).filter(lienVoidPaperStuck)).toEqual(['still_sent'])
  })

  it('Back from the clerk says the lien is in Ready to file again, or what happened instead', () => {
    expect(lienTakenBackWords('approved')).toBe('Taken back. The filing is voided and the lien is in Ready to file again.')
    expect(lienTakenBackWords('drafted')).toBe('Taken back. The filing is voided. The lien’s paper is back on the Lien desk as a draft.')
    expect(lienTakenBackWords('none')).toBe('Taken back. The filing is voided.')
    expect(lienNotTakenBackWords('the network dropped.')).toBe('Not taken back: the network dropped. The lien is still on record as filed.')
  })

  it('every sentence a person reads here is plain', () => {
    const said = [
      ...(['approved', 'drafted', 'set_aside', 'still_sent', 'none'] as const).flatMap((o) => [lienVoidPaperWords(o), lienTakenBackWords(o)]),
      LIEN_TAKE_BACK_WORDS.hint,
    ]
    for (const words of said) expect([words, plainWordsFailures(words)]).toEqual([words, []])
  })
})
