import { describe, expect, it } from 'vitest'
import { plainSentence } from '../valuesInPlace'
import { plainWordsFailures } from '../plainWords'
import {
  LIEN_LEAVE_OUT_REASONS,
  LIEN_LEFT_OUT_WORDS,
  lienAskedAgainWords,
  lienLeaveOutCheck,
  lienLeaveOutReasonWords,
  lienLeftOutByWords,
  lienLeftOutStandings,
  lienPaperKey,
  type LienLeftOutRow,
} from './lienLeftOut'

let n = 0
function row(over: Partial<LienLeftOutRow> = {}): LienLeftOutRow {
  n += 1
  return { id: `r${n}`, jobId: 'j1', paper: 'affidavit', runDay: '2026-11-16', reason: 'customer_paying', note: '', leftOutBy: 'u-rosa', leftOutAt: '2026-11-15T16:00:00Z', putBackBy: null, putBackAt: null, ...over }
}
const names = (id: string) => ({ 'u-rosa': 'Rosa', 'u-sam': 'Sam' })[id] ?? null

describe('lienLeftOutStandings: where a paper stands against this run', () => {
  it('a paper nobody left out has no standing', () => {
    expect(lienLeftOutStandings([], '2026-11-16').size).toBe(0)
  })

  it('a row for this run leaves the paper out of it', () => {
    const r = row()
    expect(lienLeftOutStandings([r], '2026-11-16').get('affidavit:j1')).toEqual({ state: 'left_out', row: r })
  })

  it('a row for an earlier run is asked about again: it is not carried in and not left out', () => {
    const r = row({ runDay: '2026-11-16' })
    expect(lienLeftOutStandings([r], '2026-12-15').get('affidavit:j1')).toEqual({ state: 'asked_again', row: r })
  })

  it('a row for a later run still leaves the paper out when the tile’s day moves back', () => {
    // A paper due sooner arrived and the tile now counts to the 18th: the leave-out made for the 20th stands.
    const r = row({ runDay: '2026-11-20' })
    expect(lienLeftOutStandings([r], '2026-11-18').get('affidavit:j1')?.state).toBe('left_out')
  })

  it('a row put back counts for nothing', () => {
    expect(lienLeftOutStandings([row({ putBackAt: '2026-11-15T18:00:00Z', putBackBy: 'u-sam' })], '2026-11-16').size).toBe(0)
  })

  it('left out again in this run: this run’s row wins over the earlier one', () => {
    const old = row({ runDay: '2026-11-16', reason: 'other', note: 'The owner is away.' })
    const again = row({ runDay: '2026-12-15', leftOutBy: 'u-sam', leftOutAt: '2026-12-10T15:00:00Z' })
    expect(lienLeftOutStandings([old, again], '2026-12-15').get('affidavit:j1')).toEqual({ state: 'left_out', row: again })
  })

  it('two earlier runs: the run asks again with the later one', () => {
    const first = row({ runDay: '2026-10-15' })
    const second = row({ runDay: '2026-11-16', leftOutAt: '2026-11-14T15:00:00Z' })
    expect(lienLeftOutStandings([second, first], '2026-12-15').get('affidavit:j1')).toEqual({ state: 'asked_again', row: second })
  })

  it('a job’s notice and its affidavit are two papers', () => {
    const map = lienLeftOutStandings([row({ paper: 'notice' })], '2026-11-16')
    expect(map.has(lienPaperKey('notice', 'j1'))).toBe(true)
    expect(map.has(lienPaperKey('affidavit', 'j1'))).toBe(false)
  })

  it('with no run nothing stands', () => {
    expect(lienLeftOutStandings([row()], null).size).toBe(0)
  })
})

describe('the form and the words', () => {
  it('a leave-out needs a reason, and another reason needs its words', () => {
    expect(lienLeaveOutCheck(null, '')).toBe('Pick a reason first.')
    expect(lienLeaveOutCheck('other', '   ')).toBe('Say why in a few words.')
    expect(lienLeaveOutCheck('other', 'The owner is away.')).toBeNull()
    expect(lienLeaveOutCheck('customer_paying', '')).toBeNull()
  })

  it('the reasons are the ones the table takes, with another reason last', () => {
    expect(LIEN_LEAVE_OUT_REASONS.map((r) => r.key)).toEqual(['fact_not_in_time', 'leader_not_in_time', 'customer_paying', 'ask_attorney', 'other'])
  })

  it('the reason reads as picked, then the person’s words', () => {
    expect(lienLeaveOutReasonWords({ reason: 'customer_paying', note: '' })).toBe('The customer is paying')
    expect(lienLeaveOutReasonWords({ reason: 'customer_paying', note: 'A check is promised for Friday.' })).toBe('The customer is paying. A check is promised for Friday.')
    expect(lienLeaveOutReasonWords({ reason: 'other', note: ' The owner is away. ' })).toBe('The owner is away.')
  })

  it('who and when, with the values marked', () => {
    const words = lienLeftOutByWords(row(), names)
    expect(plainSentence(words)).toBe('Left out by Rosa on Nov 15')
    expect(words).toContain('⟪who|Rosa⟫')
    expect(words).toContain('⟪day|Nov 15⟫')
    expect(plainSentence(lienLeftOutByWords(row({ leftOutBy: 'u-gone' }), names))).toBe('Left out by someone in the office on Nov 15')
  })

  it('asked again names the run it was left out of', () => {
    expect(plainSentence(lienAskedAgainWords(row(), names))).toBe('Left out of the run for Nov 16 by Rosa on Nov 15')
  })

  it('every word a person reads is plain', () => {
    const words = [...LIEN_LEAVE_OUT_REASONS.map((r) => r.words), ...Object.values(LIEN_LEFT_OUT_WORDS), 'Pick a reason first.', 'Say why in a few words.']
    expect(words.flatMap((w) => plainWordsFailures(w))).toEqual([])
  })
})
