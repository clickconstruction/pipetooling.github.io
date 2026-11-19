import { describe, expect, it } from 'vitest'
import { lienDocCheck, lienDocFiledWords, lienDocKnownFromFilings, lienDocNotSavedWords, lienDocNumberClean, lienDocShape, type LienDocKnown } from './lienDocNumber'

// Every county, job and number here is made up.
const known = (over: Partial<LienDocKnown> & { filingId: string; number: string }): LienDocKnown => ({ county: 'Alder', filedYmd: '2026-11-16', jobLabel: '9001 · Sample Job', ...over })
const ALDER = [known({ filingId: 'a', number: '20260229001' }), known({ filingId: 'b', number: '20260229002', jobLabel: '9002 · Sample Job' }), known({ filingId: 'c', number: '2026019003', county: 'Birch', jobLabel: '9003 · Sample Job' })]

describe('lienDocNumberClean', () => {
  it('trims and keeps one space where several were typed', () => {
    expect(lienDocNumberClean('  2026  0229 001 ')).toBe('2026 0229 001')
    expect(lienDocNumberClean('')).toBe('')
  })
})

describe('lienDocShape', () => {
  it('learns a county’s length and that its numbers start with the year filed', () => {
    expect(lienDocShape(ALDER, 'Alder')).toEqual({ digits: 11, year: true })
    expect(lienDocShape(ALDER, ' birch ')).toEqual({ digits: 10, year: true })
  })

  it('has nothing to say of a county with no number on record, or with none that is digits alone', () => {
    expect(lienDocShape(ALDER, 'Cedar')).toBeNull()
    expect(lienDocShape([known({ filingId: 'x', number: 'Vol 12 Pg 34' })], 'Alder')).toBeNull()
  })

  it('takes the commonest length, the longer on a tie, and drops the year when one number does not start with it', () => {
    expect(lienDocShape([...ALDER, known({ filingId: 'd', number: '2026022901' })], 'Alder')).toEqual({ digits: 11, year: true })
    expect(lienDocShape([known({ filingId: 'a', number: '20260229001' }), known({ filingId: 'd', number: '2026022901' })], 'Alder')).toEqual({ digits: 11, year: true })
    expect(lienDocShape([known({ filingId: 'a', number: '20260229001' }), known({ filingId: 'e', number: '00420229001' })], 'Alder')).toEqual({ digits: 11, year: false })
  })
})

describe('lienDocCheck', () => {
  const check = (number: string, over: Partial<Parameters<typeof lienDocCheck>[0]> = {}) => lienDocCheck({ number, county: 'Alder', filedYmd: '2026-11-18', known: ALDER, ...over })

  it('passes a number of the county’s shape', () => {
    expect(check('20260229004')).toEqual({ kind: 'ok' })
    expect(check('   ')).toEqual({ kind: 'empty' })
  })

  it('holds a number another lien in the county holds, and names that lien', () => {
    expect(check('2026 0229-002')).toEqual({ kind: 'twin', words: '9002 · Sample Job holds this number too. Two liens cannot share one. Check both stamps.' })
  })

  it('does not call a lien its own twin, and lets two counties share a number', () => {
    expect(check('20260229002', { selfId: 'b' })).toEqual({ kind: 'ok' })
    expect(check('2026019003', { county: 'Birch', selfId: 'c' })).toEqual({ kind: 'ok' })
    expect(check('2026019003').kind).toBe('odd')
  })

  it('asks about a number that is not the county’s length, in the county’s own figures', () => {
    expect(check('2026022900')).toEqual({ kind: 'odd', words: 'Alder County’s numbers on record have 11 digits and start with the year filed. This one has 10 digits. Check it against the stamp.' })
  })

  it('asks about a number that does not start with the year it was filed', () => {
    expect(check('20250229004')).toEqual({ kind: 'odd', words: 'Alder County’s numbers on record have 11 digits and start with the year filed. This one does not start with 2026. Check it against the stamp.' })
    // A lien filed the next January starts with the next year.
    expect(check('20270000012', { filedYmd: '2027-01-04' })).toEqual({ kind: 'ok' })
  })

  it('in a county with nothing on record, asks only about a very short number', () => {
    expect(check('Vol 12 Pg 3456', { county: 'Cedar' })).toEqual({ kind: 'ok' })
    expect(check('1234', { county: 'Cedar' })).toEqual({ kind: 'odd', words: 'That is short for a clerk’s number. Check it against the stamp.' })
  })
})

describe('the card’s words', () => {
  it('says the county and the day filed, leaving out what is not known', () => {
    expect(lienDocFiledWords({ county: 'Alder', filedYmd: '2026-11-16' })).toBe('Alder County · filed Nov 16')
    expect(lienDocFiledWords({ county: '', filedYmd: '2026-11-16' })).toBe('filed Nov 16')
    expect(lienDocFiledWords({})).toBe('')
  })

  it('says why a number did not save', () => {
    expect(lienDocNotSavedWords('the lien did not take it.')).toBe('Not saved: the lien did not take it. The box still holds what you typed.')
    expect(lienDocNotSavedWords('')).toBe('Not saved. The box still holds what you typed.')
  })
})

describe('lienDocKnownFromFilings', () => {
  it('lists live affidavits that hold a number, each under its job’s label', () => {
    const rows = lienDocKnownFromFilings(
      {
        j1: [
          { id: 'a', kind: 'affidavit', county: 'Alder', recording_number: ' 20260229001 ', filed_at: '2026-11-16' },
          { id: 'n', kind: 'notice_53_056', county: null, recording_number: null, filed_at: null },
        ],
        j2: [
          { id: 'v', kind: 'affidavit', county: 'Alder', recording_number: '20260229009', filed_at: '2026-11-16', voided_at: '2026-11-17T00:00:00Z' },
          { id: 'e', kind: 'affidavit', county: 'Alder', recording_number: '', filed_at: '2026-11-16' },
        ],
      },
      (id) => `label ${id}`,
    )
    expect(rows).toEqual([{ filingId: 'a', county: 'Alder', number: '20260229001', filedYmd: '2026-11-16', jobLabel: 'label j1' }])
  })
})
