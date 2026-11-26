import { describe, expect, it } from 'vitest'
import { plainSentence } from '../valuesInPlace'
import { plainWordsFailures } from '../plainWords'
import { fundsConfirmedNow, fundsConfirmedWords, payoffFieldsPatch, payoffNote, readFundsConfirmed } from './lienPayoffFields'

// Every name and day here is made up.
const FUNDS = { by: 'u1', name: 'Alex Rivera', at: '2026-11-26T15:04:00Z', note: 'called the bank, the funds are good' }

describe('payoffNote', () => {
  it('reads the two facts off the affidavit row, and nothing from a row that holds none', () => {
    expect(payoffNote({ releaseAskedYmd: '2026-11-24', fundsConfirmed: FUNDS, other: 1 })).toEqual({ askedYmd: '2026-11-24', funds: FUNDS })
    expect(payoffNote({})).toEqual({ askedYmd: '', funds: null })
    expect(payoffNote(null)).toEqual({ askedYmd: '', funds: null })
    expect(payoffNote('fields')).toEqual({ askedYmd: '', funds: null })
  })

  it('drops a day that is not a day, and a confirmation with no time', () => {
    expect(payoffNote({ releaseAskedYmd: 'Nov 24', fundsConfirmed: { by: 'u1', name: 'Alex' } })).toEqual({ askedYmd: '', funds: null })
    expect(readFundsConfirmed({ at: '2026-11-26T15:04:00Z' })).toEqual({ by: '', name: '', at: '2026-11-26T15:04:00Z', note: '' })
  })
})

describe('payoffFieldsPatch', () => {
  it('puts the day and the confirmation on the row and keeps every other field', () => {
    const out = payoffFieldsPatch({ claimAmount: '7420', releasesFilingId: 'x' }, { askedYmd: '2026-11-24', funds: FUNDS })
    expect(out).toEqual({ claimAmount: '7420', releasesFilingId: 'x', releaseAskedYmd: '2026-11-24', fundsConfirmed: FUNDS })
  })

  it('takes a fact off with an empty day or a null confirmation, and leaves a fact out of the change alone', () => {
    const row = { releaseAskedYmd: '2026-11-24', fundsConfirmed: FUNDS }
    expect(payoffFieldsPatch(row, { askedYmd: '' })).toEqual({ fundsConfirmed: FUNDS })
    expect(payoffFieldsPatch(row, { funds: null })).toEqual({ releaseAskedYmd: '2026-11-24' })
    expect(payoffFieldsPatch(row, {})).toEqual(row)
    expect(payoffFieldsPatch(undefined, { askedYmd: '2026-11-24' })).toEqual({ releaseAskedYmd: '2026-11-24' })
  })

  it('keeps only the four parts of a confirmation', () => {
    const out = payoffFieldsPatch({}, { funds: { ...FUNDS, extra: 1 } as typeof FUNDS })
    expect(out.fundsConfirmed).toEqual(FUNDS)
  })
})

describe('the press and its words', () => {
  it('makes a confirmation from who pressed, what the bank said and when', () => {
    expect(fundsConfirmedNow({ id: 'u1', name: ' Alex Rivera ' }, '  the funds are good ', '2026-11-26T15:04:00Z')).toEqual({ by: 'u1', name: 'Alex Rivera', at: '2026-11-26T15:04:00Z', note: 'the funds are good' })
  })

  it('says who confirmed the funds and on what day, in plain words, with a fallback name', () => {
    const words = fundsConfirmedWords(FUNDS)
    expect(plainSentence(words)).toBe('Alex Rivera confirmed the funds Nov 26.')
    expect(plainSentence(fundsConfirmedWords({ ...FUNDS, name: '' }))).toBe('A leader confirmed the funds Nov 26.')
    expect(plainWordsFailures(plainSentence(words))).toEqual([])
  })
})
