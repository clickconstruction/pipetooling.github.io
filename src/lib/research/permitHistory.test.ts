import { describe, expect, it } from 'vitest'
import type { ResearchPermitRow } from './permitResearch'
import { cardHistory, earlierWords, historyReason, historyVerb, historyWords, keepFromPassedReason, mayKeepFromClosed, type HistoryEvent } from './permitHistory'

// Every name here is made up.
function ev(over: Partial<HistoryEvent> = {}): HistoryEvent {
  return { id: 'e1', verdict: 'not_for_us', reason: 'Passed on the skim.', reason_code: null, decided_at: '2026-11-09T18:00:00Z', by_name: 'Sam', for_name: null, ...over }
}

describe('one line of a permit history (punch list #302)', () => {
  it('says who moved it, where to, when, and why', () => {
    expect(historyWords(ev())).toBe('Sam passed, Nov 9')
    expect(historyWords(ev({ reason: 'Passed on the skim: too far.', reason_code: 'too_far' }))).toBe('Sam passed, Nov 9: too far')
    expect(historyWords(ev({ verdict: 'look', reason: 'Marked to investigate on the skim.' }))).toBe('Sam chose to investigate, Nov 9')
    expect(historyWords(ev({ verdict: 'look', reason: 'Kept on the skim.', for_name: 'Kim' }))).toBe('Sam chose to investigate for Kim, Nov 9')
    expect(historyWords(ev({ verdict: 'look', reason: 'Marked to investigate on a second look, after Sam passed.', by_name: 'Eve' }))).toBe('Eve chose to investigate on a second look, Nov 9')
    expect(historyWords(ev({ verdict: 'look', reason: 'Marked to investigate from Passed, after Sam passed.', by_name: 'Eve' }))).toBe('Eve chose to investigate from Passed, Nov 9')
    expect(historyWords(ev({ verdict: 'look', reason: 'Handed to Kim.', for_name: 'Kim' }))).toBe('Sam handed it to Kim, Nov 9')
    expect(historyWords(ev({ verdict: 'look', reason: 'Handed to nobody yet.' }))).toBe('Sam handed it to nobody yet, Nov 9')
    expect(historyWords(ev({ reason: 'Passed on a second look: not our work.', reason_code: 'sl_not_our_work', by_name: 'Eve' }))).toBe('Eve passed again, Nov 9: not our work')
    expect(historyWords(ev({ reason: 'Not pursuing: could not reach anyone.', reason_code: 'np_no_answer' }))).toBe('Sam stopped pursuing it, Nov 9: could not reach anyone')
    expect(historyWords(ev({ verdict: 'approach', reason: 'Pursued for this job.' }))).toBe('Sam pursued it, Nov 9')
    expect(historyWords(ev({ verdict: 'taken', reason: 'The sign on the fence names a plumber.' }))).toBe('Sam said a plumber has it, Nov 9: The sign on the fence names a plumber')
    expect(historyWords(ev({ verdict: 'back', reason: 'Put back on the skim.' }))).toBe('Sam put it back on the skim, Nov 9')
    expect(historyWords(ev({ by_name: null, reason: 'A parking lot, no building.' }))).toBe('Someone passed, Nov 9: A parking lot, no building')
  })

  it('an answer stored before the rename (Kept) reads the same as one stored since', () => {
    expect(historyWords(ev({ verdict: 'look', reason: 'Kept on the skim.' }))).toBe('Sam chose to investigate, Nov 9')
    expect(historyWords(ev({ verdict: 'look', reason: 'Kept on a second look, after Sam passed.', by_name: 'Eve' }))).toBe('Eve chose to investigate on a second look, Nov 9')
    expect(historyWords(ev({ verdict: 'look', reason: 'Kept from Passed, after Sam passed.', by_name: 'Eve' }))).toBe('Eve chose to investigate from Passed, Nov 9')
  })

  it('reads the day on the company calendar, not the UTC one', () => {
    // 03:00 UTC on the 10th is still the 9th in San Antonio.
    expect(historyWords(ev({ decided_at: '2026-11-10T03:00:00Z' }))).toBe('Sam passed, Nov 9')
  })

  it('keeps a typed reason whole and drops the stock words', () => {
    expect(historyReason(ev({ reason: '  Owner builds   their own.  ' }))).toBe('Owner builds their own')
    expect(historyReason(ev({ reason: 'Marked to investigate on the skim.' }))).toBeNull()
    expect(historyReason(ev({ reason: '' }))).toBeNull()
    expect(historyVerb(ev({ verdict: 'something_new' }))).toBe('something_new')
  })
})

describe('what a card shows of it', () => {
  const three = [ev({ id: 'a', decided_at: '2026-11-07T15:00:00Z', verdict: 'look', reason: 'Marked to investigate on the skim.' }), ev({ id: 'c', decided_at: '2026-11-09T15:00:00Z', by_name: 'Eve' }), ev({ id: 'b', decided_at: '2026-11-08T15:00:00Z', verdict: 'back', reason: 'Put back on the skim.' })]

  it('the newest two lines, and how many older ones the sheet holds', () => {
    expect(cardHistory(three)).toEqual({ lines: [{ id: 'c', words: 'Eve passed, Nov 9' }, { id: 'b', words: 'Sam put it back on the skim, Nov 8' }], earlier: 1 })
    expect(cardHistory([])).toEqual({ lines: [], earlier: 0 })
    expect(earlierWords(1)).toBe('and 1 earlier')
    expect(earlierWords(0)).toBeNull()
  })

  it('a second-look card skips the pass its amber line already says', () => {
    expect(cardHistory(three, 2, 1)).toEqual({ lines: [{ id: 'b', words: 'Sam put it back on the skim, Nov 8' }, { id: 'a', words: 'Sam chose to investigate, Nov 7' }], earlier: 0 })
    expect(cardHistory([ev()], 2, 1)).toEqual({ lines: [], earlier: 0 })
  })
})

describe('a keep from the Passed list', () => {
  const row = (over: Partial<ResearchPermitRow>) => ({ verdict: 'not_for_us', verdict_reason_code: null, plumber: null, plumber_permit_on: null, verdict_by_name: 'Sam', ...over }) as ResearchPermitRow

  it('anyone may keep any pass or drop, their own and one passed twice, until a plumber has it', () => {
    expect(mayKeepFromClosed(row({}))).toBe(true)
    expect(mayKeepFromClosed(row({ verdict_reason_code: 'sl_none' }))).toBe(true)
    expect(mayKeepFromClosed(row({ verdict_reason_code: 'np_no_answer' }))).toBe(true)
    expect(mayKeepFromClosed(row({ plumber_permit_on: '2026-11-08' }))).toBe(false)
    expect(mayKeepFromClosed(row({ verdict: 'taken' }))).toBe(false)
    expect(mayKeepFromClosed(row({ verdict: 'look' }))).toBe(false)
    expect(mayKeepFromClosed(row({ verdict: null }))).toBe(false)
  })

  it('is stored with whose pass it overturned', () => {
    expect(keepFromPassedReason(row({}))).toBe('Marked to investigate from Passed, after Sam passed.')
    expect(keepFromPassedReason(row({ verdict_by_name: null }))).toBe('Marked to investigate from Passed, after someone passed.')
    expect(keepFromPassedReason(row({ verdict_reason_code: 'np_no_answer' }))).toBe('Marked to investigate from Passed, after Sam stopped pursuing it.')
  })
})
