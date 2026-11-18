import { describe, expect, it } from 'vitest'
import { FINISH_CALL_WORDS, boardSaysWords, finishAsk, finishChoices, finishDayOk, latestFinishCall, latestFinishCallsByPerson, saidRow, workingDayFrom, type FinishCall } from './finishCall'
import { plainWordsFailures } from '../plainWords'

const call = (c: Partial<FinishCall>): FinishCall => ({ userId: 'sam', userName: 'Sam Reyes', finishOn: '2026-11-20', planWas: '2026-11-20', why: null, createdAt: '2026-11-17T15:00:00Z', ...c })

describe('workingDayFrom', () => {
  it('steps over the weekend both ways', () => {
    expect(workingDayFrom('2026-11-20', 1)).toBe('2026-11-23') // Friday to Monday
    expect(workingDayFrom('2026-11-23', -1)).toBe('2026-11-20') // Monday to Friday
    expect(workingDayFrom('2026-11-18', 1)).toBe('2026-11-19')
    expect(workingDayFrom('2026-11-21', 1)).toBe('2026-11-23') // from a Saturday
  })
})

describe('whose word', () => {
  it('reads a person’s newest saying', () => {
    const rows = [call({ finishOn: '2026-11-20', createdAt: '2026-11-16T15:00:00Z' }), call({ finishOn: '2026-11-23', createdAt: '2026-11-18T15:00:00Z' }), call({ userId: 'lee', finishOn: '2026-11-30', createdAt: '2026-11-19T15:00:00Z' })]
    expect(latestFinishCall(rows, 'sam')?.finishOn).toBe('2026-11-23')
    expect(latestFinishCall(rows, 'nobody')).toBeNull()
    expect(latestFinishCall(rows, null)).toBeNull()
  })

  it('gives the office each person’s newest saying, newest first', () => {
    const rows = [call({ finishOn: '2026-11-20', createdAt: '2026-11-16T15:00:00Z' }), call({ finishOn: '2026-11-23', createdAt: '2026-11-18T15:00:00Z' }), call({ userId: 'lee', userName: 'Lee Park', finishOn: '2026-11-30', createdAt: '2026-11-19T15:00:00Z' })]
    expect(latestFinishCallsByPerson(rows).map((r) => [r.userId, r.finishOn])).toEqual([['lee', '2026-11-30'], ['sam', '2026-11-23']])
  })
})

describe('finishChoices', () => {
  it('offers the working day before the plan, the plan, and the working day after', () => {
    expect(finishChoices({ plannedYmd: '2026-11-20', saidYmd: null, todayYmd: '2026-11-18' })).toEqual([
      { ymd: '2026-11-19', words: 'Thu, Nov 19', isPlan: false },
      { ymd: '2026-11-20', words: 'Fri, Nov 20, the plan', isPlan: true },
      { ymd: '2026-11-23', words: 'Mon, Nov 23', isPlan: false },
    ])
  })

  it('centres on his own last word, and keeps the plan in reach while it is still ahead', () => {
    const picks = finishChoices({ plannedYmd: '2026-11-20', saidYmd: '2026-11-25', todayYmd: '2026-11-18' })
    expect(picks.map((p) => p.ymd)).toEqual(['2026-11-20', '2026-11-24', '2026-11-25', '2026-11-26'])
    expect(picks.find((p) => p.isPlan)?.words).toBe('Fri, Nov 20, the plan')
  })

  it('leaves out a day already gone, and offers none with no day in force', () => {
    expect(finishChoices({ plannedYmd: '2026-11-20', saidYmd: null, todayYmd: '2026-11-20' }).map((p) => p.ymd)).toEqual(['2026-11-20', '2026-11-23'])
    expect(finishChoices({ plannedYmd: '2026-11-13', saidYmd: null, todayYmd: '2026-11-18' })).toEqual([])
    expect(finishChoices({ plannedYmd: null, saidYmd: null, todayYmd: '2026-11-18' })).toEqual([])
  })
})

describe('finishAsk', () => {
  const base = { plannedYmd: '2026-11-20', mine: null, saidTodayYmd: null, behind: false }

  it('says nothing while the day is more than two days off and the job is not behind', () => {
    expect(finishAsk({ ...base, todayYmd: '2026-11-17' })).toBeNull()
  })

  it('asks two days out, about the plan’s day', () => {
    expect(finishAsk({ ...base, todayYmd: '2026-11-18' })).toEqual({ ymd: '2026-11-20', past: false, words: 'Still finishing Fri, Nov 20?' })
    expect(finishAsk({ ...base, todayYmd: '2026-11-20' })?.words).toBe('Still finishing Fri, Nov 20?')
  })

  it('asks about his own day once he has said one', () => {
    const mine = call({ finishOn: '2026-11-25', createdAt: '2026-11-18T15:00:00Z' })
    expect(finishAsk({ ...base, mine, todayYmd: '2026-11-19' })).toBeNull()
    expect(finishAsk({ ...base, mine, todayYmd: '2026-11-23' })).toEqual({ ymd: '2026-11-25', past: false, words: 'Still finishing Wed, Nov 25?' })
  })

  it('asks when the job is behind and he has never said a day, and not again once he has', () => {
    expect(finishAsk({ ...base, behind: true, todayYmd: '2026-11-10' })?.words).toBe('Still finishing Fri, Nov 20?')
    expect(finishAsk({ ...base, behind: true, mine: call({ finishOn: '2026-11-27', createdAt: '2026-11-10T15:00:00Z' }), todayYmd: '2026-11-11' })).toBeNull()
  })

  it('does not ask twice in a day', () => {
    expect(finishAsk({ ...base, mine: call({ createdAt: '2026-11-19T14:00:00Z' }), saidTodayYmd: '2026-11-19', todayYmd: '2026-11-19' })).toBeNull()
    // The next morning it may ask again.
    expect(finishAsk({ ...base, mine: call({ createdAt: '2026-11-19T14:00:00Z' }), saidTodayYmd: '2026-11-19', todayYmd: '2026-11-20' })?.words).toBe('Still finishing Fri, Nov 20?')
  })

  it('says the day has passed, and asks nothing with no day in force', () => {
    expect(finishAsk({ ...base, todayYmd: '2026-11-23' })).toEqual({ ymd: '2026-11-20', past: true, words: 'Fri, Nov 20 has passed. When does it finish?' })
    expect(finishAsk({ ...base, plannedYmd: null, behind: true, todayYmd: '2026-11-18' })).toBeNull()
  })
})

describe('the words', () => {
  it('puts his word on the rail, with what is in the way', () => {
    expect(saidRow(null)).toBeNull()
    expect(saidRow(call({ finishOn: '2026-11-23', why: ' Waiting on the inspector ' }))).toEqual({ day: 'Mon, Nov 23', why: 'Waiting on the inspector' })
    expect(saidRow(call({ why: '  ' }))).toEqual({ day: 'Fri, Nov 20', why: null })
  })

  it('tells the office who says what', () => {
    expect(boardSaysWords(call({ finishOn: '2026-11-23', why: 'waiting on the inspector' }))).toBe('Sam says Mon, Nov 23: waiting on the inspector')
    expect(boardSaysWords(call({ userName: null }))).toBe('The crew says Fri, Nov 20.')
  })

  it('takes a real day that is not gone', () => {
    expect(finishDayOk('2026-11-20', '2026-11-18')).toBe(true)
    expect(finishDayOk('2026-11-18', '2026-11-18')).toBe(true)
    expect(finishDayOk('2026-11-17', '2026-11-18')).toBe(false)
    expect(finishDayOk('', '2026-11-18')).toBe(false)
    expect(finishDayOk(null, '2026-11-18')).toBe(false)
  })

  it('keeps every sentence inside the plain words rules', () => {
    for (const words of [FINISH_CALL_WORDS.title, FINISH_CALL_WORDS.saved('Mon, Nov 23'), FINISH_CALL_WORDS.ask('Fri, Nov 20'), FINISH_CALL_WORDS.askPast('Fri, Nov 20')]) expect(plainWordsFailures(words), words).toEqual([])
  })
})
