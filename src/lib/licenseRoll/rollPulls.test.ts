import { describe, expect, it } from 'vitest'
import { plainSentence } from '../valuesInPlace'
import { countWords, countyWords, FILES_TO_PULL, pullChangeWords, pullLines, pullStopped, pullTroubleWords, pullWasClean, ROLL_TILES, type PullRow } from './rollPulls'

function pull(over: Partial<PullRow> = {}): PullRow {
  return { id: 'p1', file: 'JP', started_at: '2026-11-23T12:40:00Z', finished_at: '2026-11-23T12:40:03Z', rows_seen: 26474, rows_kept: 4010, added: 4, changed: 31, gone: 9, error: '', ...over }
}

describe('pullLines', () => {
  it('lists the four weekly files in order, each never pulled when the ledger is empty', () => {
    const lines = pullLines([])
    expect(lines.map((l) => l.file)).toEqual(['RMP', 'MP', 'JP', 'TP'])
    expect(lines.map((l) => l.says)).toEqual(['Plumbing · responsible master', 'Plumbing · master', 'Plumbing · journeyman', 'Plumbing · tradesman'])
    expect(lines.every((l) => l.last === null && l.lastGood === null)).toBe(true)
    expect(FILES_TO_PULL).toEqual(['RMP', 'MP', 'JP', 'TP'])
  })
  it('takes the newest pull of a file, and the newest clean one apart from it', () => {
    const good = pull({ id: 'good', started_at: '2026-11-16T12:40:00Z' })
    const bad = pull({ id: 'bad', started_at: '2026-11-23T12:40:00Z', error: 'The board answered 503 for its JP file.' })
    const other = pull({ id: 'tp', file: 'TP', started_at: '2026-11-23T12:45:00Z' })
    const jp = pullLines([good, other, bad]).find((l) => l.file === 'JP')!
    expect(jp.last?.id).toBe('bad')
    expect(jp.lastGood?.id).toBe('good')
    expect(pullLines([good, other, bad]).find((l) => l.file === 'TP')!.last?.id).toBe('tp')
  })
})

describe('a pull, read', () => {
  it('is clean when it finished with no reason kept', () => {
    expect(pullWasClean(pull())).toBe(true)
    expect(pullWasClean(pull({ error: 'x' }))).toBe(false)
    expect(pullWasClean(pull({ finished_at: null }))).toBe(false)
  })
  it('is stopped when it was logged and never finished', () => {
    expect(pullStopped(pull({ finished_at: null }))).toBe(true)
    expect(pullStopped(pull())).toBe(false)
  })
  it('says what changed, each count a value', () => {
    expect(plainSentence(pullChangeWords(pull()))).toBe('4 new · 31 changed · 9 gone')
    expect(plainSentence(pullChangeWords(pull({ added: 4010, changed: 0, gone: 0 })))).toBe('4,010 new')
    expect(pullChangeWords(pull({ added: 0, changed: 0, gone: 0 }))).toBe('Nothing changed')
  })
  it('gives the reason under a file whose newest pull failed, and nothing under a clean one', () => {
    const [, , jp] = pullLines([pull({ error: 'The board answered 503 for its JP file.' })])
    expect(pullTroubleWords(jp!)).toBe('The board answered 503 for its JP file.')
    expect(pullTroubleWords(pullLines([pull()])[2]!)).toBeNull()
    expect(pullTroubleWords(pullLines([])[2]!)).toBeNull()
    expect(pullTroubleWords(pullLines([pull({ finished_at: null })])[2]!)).toBe('The last pull stopped before it finished. Nothing was changed by it.')
  })
})

describe('the words around the counts', () => {
  it('writes a count with its comma', () => {
    expect(countWords(6507)).toBe('6,507')
    expect(countWords(0)).toBe('0')
  })
  it('counts a responsible master among the masters', () => {
    expect(ROLL_TILES.find((t) => t.key === 'master')!.classes).toEqual(['master', 'responsible_master'])
    expect(ROLL_TILES.map((t) => t.label)).toEqual(['journeymen', 'masters', 'tradesmen'])
  })
  it('names the counties as a person would', () => {
    expect(countyWords(['TRAVIS', 'BEXAR', 'HAYS', 'COMAL', 'GUADALUPE'])).toBe('Bexar, Comal, Guadalupe, Hays and Travis')
    expect(countyWords(['VAL VERDE', 'BEXAR'])).toBe('Bexar and Val Verde')
    expect(countyWords(['BEXAR'])).toBe('Bexar')
    expect(countyWords([])).toBe('')
  })
})
