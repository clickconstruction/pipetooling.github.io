import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { CALL_ASIDE, CALL_WORDS, callDayHolds, callDayWords, callLineBody, callLogProblem, dialHref } from './callLog'
import { boxPlaceholder, canSend, countLine, goesOut, REPLY_KINDS, sentWords } from './compose'

describe('the Call kind (punch list #140 PR 7)', () => {
  it('is the fourth kind, saved rather than sent, and stays with the team', () => {
    expect(REPLY_KINDS.map((k) => k.kind)).toEqual(['text', 'email', 'note', 'call'])
    expect(REPLY_KINDS.find((k) => k.kind === 'call')).toEqual({ kind: 'call', label: 'Call', send: 'Save the call' })
    expect(goesOut('call')).toBe(false)
    expect(canSend('call', { name: 'Tom', number: null, numberOptedOut: false, email: null })).toBe(true)
    expect(boxPlaceholder('call', 'Tom Reyes')).toBe('What Tom Reyes said on the call…')
    expect(countLine('call', 'Thursday works').parts).toEqual(['2 words', 'only the team sees it'])
    expect(sentWords('call', { name: 'Click Construction' })).toBe('Call saved. Only the team sees it.')
  })

  it('saves nothing without their words', () => {
    expect(callLogProblem({ said: '' })).toBe(CALL_WORDS.needWords)
    expect(callLogProblem({ said: '   ' })).toBe(CALL_WORDS.needWords)
    expect(callLogProblem({ said: 'Thursday works' })).toBeNull()
  })

  it('writes the line as the function does', () => {
    expect(callLineBody('Priya', ' Thursday works ')).toBe('Called Priya. They said: Thursday works')
    expect(callLineBody('', 'no answer')).toBe('Called them. They said: no answer')
  })

  it('prints the day they gave as a date or as their words, and holds the row only on a date to come', () => {
    expect(callDayWords(null)).toBeNull()
    expect(callDayWords({ ymd: '2026-10-27', words: null })).toBe('Tue Oct 27')
    expect(callDayWords({ ymd: null, words: ' next week ' })).toBe('next week')
    expect(callDayHolds({ ymd: '2026-10-27', words: null }, '2026-10-21')).toBe(true)
    expect(callDayHolds({ ymd: '2026-10-21', words: null }, '2026-10-21')).toBe(true)
    expect(callDayHolds({ ymd: '2026-10-20', words: null }, '2026-10-21')).toBe(false)
    expect(callDayHolds({ ymd: null, words: 'next week' }, '2026-10-21')).toBe(false)
    expect(callDayHolds(null, '2026-10-21')).toBe(false)
  })

  it('dials the number as typed', () => {
    expect(dialHref('(830) 555-0133')).toBe('tel:8305550133')
    expect(dialHref('+1 830 555 0133')).toBe('tel:+18305550133')
  })

  it('keeps every sentence in plain words', () => {
    for (const words of Object.values(CALL_WORDS)) expect(plainWordsFailures(words), words).toEqual([])
    for (const part of CALL_ASIDE) expect(plainWordsFailures(part), part).toEqual([])
    expect(plainWordsFailures(callLineBody('Priya', 'Thursday works'))).toEqual([])
  })
})
