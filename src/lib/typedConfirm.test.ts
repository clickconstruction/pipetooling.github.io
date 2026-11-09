import { describe, expect, it } from 'vitest'
import { countWord, payReportPeriodWord, typedConfirmMessage, typedConfirmMissWords, typedWordMatches } from './typedConfirm'
import { plainWordsFailures } from './plainWords'

describe('typedConfirm — the pause in front of a widened door (punch list #188 rows 72–79)', () => {
  it('matches the word whatever the case and the spaces around it', () => {
    expect(typedWordMatches('Ferguson Supply', 'ferguson supply')).toBe(true)
    expect(typedWordMatches('Ferguson Supply', '  Ferguson   Supply ')).toBe(true)
    expect(typedWordMatches('DELETE', 'delete')).toBe(true)
  })
  it('refuses the wrong word, a part of it and an empty word', () => {
    expect(typedWordMatches('Ferguson Supply', 'Ferguson')).toBe(false)
    expect(typedWordMatches('DELETE', 'DELET')).toBe(false)
    expect(typedWordMatches('DELETE', null)).toBe(false)
    expect(typedWordMatches('', '')).toBe(false)
  })
  it('names a pay report by its last day and a sweep by its count', () => {
    expect(payReportPeriodWord('2026-11-08')).toBe('11/8')
    expect(payReportPeriodWord('2026-01-05')).toBe('1/5')
    expect(countWord(12)).toBe('12')
    expect(countWord(-3)).toBe('0')
  })
  it('says it in plain words', () => {
    for (const s of [typedConfirmMessage('delete this report', 'DELETE'), typedConfirmMissWords('DELETE')]) {
      expect(plainWordsFailures(s), s).toEqual([])
    }
  })
})
