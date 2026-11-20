import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { plainSentence } from '../valuesInPlace'
import { PACE_READING_WORDS, paceReading, paceSetWords, paceStillNote, type PaceReadingInput } from './paceReading'

/** A made-up job: a 160 hour budget and a crew that spends 24 hours a day. */
const base: PaceReadingInput = {
  pctDone: 40,
  hoursUsed: 104,
  hoursBudget: 160,
  crewHoursPerDay: 24,
  values: [{ ymd: '2026-11-19', pct: 40 }],
  laborDays: [
    { ymd: '2026-11-16', hours: 48 },
    { ymd: '2026-11-17', hours: 32 },
    { ymd: '2026-11-19', hours: 24 },
  ],
  todayYmd: '2026-11-20',
}
const plain = (lines: string[]) => lines.map(plainSentence)

describe('paceReading: hours used against work done, in hours', () => {
  it('hours ahead of the work on a fresh percent is red, with the gap in hours and both presses asked for', () => {
    const r = paceReading(base)
    expect(r.state).toBe('over')
    expect(r.tone).toBe('red')
    expect(r.headline).toBe('Hours are ahead of the work.')
    expect(plain(r.lines)).toEqual(['The gap is about 40 hours.', 'At this rate the hours run out before the work does.'])
    expect(plainSentence(r.setPctAsk ?? '')).toBe('More than 40% done?')
    expect(r.finishAsk).toBe('If not, say when you will finish.')
    expect(r.stillPct).toBeNull()
    expect(plainSentence(r.leftLine ?? '')).toBe('56 hours left in the budget. About 2 days for this crew.')
  })

  it('draws the two bars on one scale: the work, the hours it accounts for, and the gap', () => {
    const bars = paceReading(base).bars!
    expect(bars).toMatchObject({ hoursPct: 65, workPct: 40, hoursFill: 40, gapFrom: 40, gapWidth: 25, hoursWords: '104 of 160 hours', workWords: 'set yesterday', workOld: false })
  })

  it('asks before it warns: hours gone in since the percent was set make it amber, with Still 40%', () => {
    const r = paceReading({ ...base, values: [{ ymd: '2026-10-23', pct: 40 }], laborDays: [{ ymd: '2026-10-20', hours: 86 }, { ymd: '2026-11-11', hours: 18 }] })
    expect(r.state).toBe('old')
    expect(r.tone).toBe('amber')
    expect(r.headline).toBe('Is 40% still right?')
    expect(plain(r.lines)).toEqual(['The work was last set on Fri, Oct 23. The crew has put in 18 hours since.'])
    expect(r.stillPct).toBe(40)
    expect(r.setPctAsk).toBe('')
    expect(r.finishAsk).toBeNull()
    expect(r.bars).toMatchObject({ workWords: 'set 28 days ago', workOld: true })
  })

  it('under a person-day of hours since the percent is not old, and a percent said in this sitting is fresh', () => {
    expect(paceReading({ ...base, values: [{ ymd: '2026-11-17', pct: 40 }], laborDays: [{ ymd: '2026-11-16', hours: 97 }, { ymd: '2026-11-19', hours: 7 }] }).state).toBe('over')
    const said = paceReading({ ...base, values: [{ ymd: '2026-10-23', pct: 40 }], saidToday: true })
    expect(said.state).toBe('over')
    expect(said.bars?.workWords).toBe('set today')
  })

  it('a percent with no day on record cannot be called old', () => {
    expect(paceReading({ ...base, values: [] }).state).toBe('over')
    expect(paceReading({ ...base, values: [] }).bars?.workWords).toBe('')
  })

  it('on track is calm and asks for nothing', () => {
    const r = paceReading({ ...base, pctDone: 52, hoursUsed: 80 })
    expect(r).toMatchObject({ state: 'track', tone: 'calm', headline: 'On track.', setPctAsk: null, stillPct: null, finishAsk: null })
    expect(r.lines).toEqual(['Hours and work are moving together.'])
    expect(r.bars).toMatchObject({ hoursPct: 50, workPct: 52, hoursFill: 50, gapWidth: 0 })
  })

  it('work ahead of the hours is green, in hours under', () => {
    const r = paceReading({ ...base, pctDone: 62, hoursUsed: 80 })
    expect(r).toMatchObject({ state: 'under', tone: 'green', headline: 'The work is ahead of the hours.' })
    expect(plain(r.lines)).toEqual(['About 19 hours under so far.'])
  })

  it('counts the subs’ sheet hours into the hours used, as the line does', () => {
    expect(paceReading({ ...base, hoursUsed: 64, subHours: 40 }).bars?.hoursWords).toBe('104 of 160 hours')
    expect(paceReading({ ...base, hoursUsed: null, subHours: 104 }).state).toBe('over')
  })

  it('past the budget says the budget is used up, and the bar stops at its end', () => {
    const r = paceReading({ ...base, pctDone: 80, hoursUsed: 172 })
    expect(r.state).toBe('over')
    expect(plain(r.lines)).toEqual(['The gap is about 44 hours.', 'The hours budget is used up. The job is 12 hours past it.'])
    expect(r.bars).toMatchObject({ hoursPct: 108, hoursFill: 80, gapFrom: 80, gapWidth: 20 })
    expect(r.leftLine).toBeNull()
  })

  it('no percent, no budget and too early each say which, and whose move it is', () => {
    expect(paceReading({ ...base, pctDone: null })).toMatchObject({ state: 'no-percent', tone: 'calm', headline: 'Nobody has set the work percent yet.', setPctAsk: '', bars: null })
    const none = paceReading({ ...base, hoursBudget: 0 })
    expect(none).toMatchObject({ state: 'no-budget', headline: 'This job has no hours budget yet.', bars: null, leftLine: null })
    expect(none.lines).toEqual(['The office sets it. There is nothing for you to do.'])
    expect(paceReading({ ...base, hoursUsed: 6 })).toMatchObject({ state: 'early', headline: 'Too early to tell.', bars: null })
    expect(paceReading({ ...base, hoursUsed: null })).toMatchObject({ state: 'early' })
  })

  it('money never makes the headline: it is one calm line, and silent when the hours already say it', () => {
    const calm = paceReading({ ...base, pctDone: 52, hoursUsed: 80, money: { leads: true, wrong: false } })
    expect(calm).toMatchObject({ state: 'track', tone: 'calm', headline: 'On track.', moneyLine: 'Money spent is ahead of the work. The office watches that.' })
    expect(paceReading({ ...base, pctDone: 52, hoursUsed: 80, money: { leads: true, wrong: true } }).moneyLine).toBe('The office’s money budget for this job looks wrong. There is nothing for you to do.')
    expect(paceReading({ ...base, money: { leads: true, wrong: false } }).moneyLine).toBeNull()
    expect(paceReading({ ...base, pctDone: 52, hoursUsed: 80, money: { leads: false, wrong: false } }).moneyLine).toBeNull()
  })

  it('a short budget left is said without the days', () => {
    expect(plainSentence(paceReading({ ...base, pctDone: 90, hoursUsed: 150 }).leftLine ?? '')).toBe('10 hours left in the budget.')
  })
})

describe('paceSetWords', () => {
  it('says today, yesterday, then the days', () => {
    expect(paceSetWords('2026-11-20', '2026-11-20')).toBe('set today')
    expect(paceSetWords('2026-11-19', '2026-11-20')).toBe('set yesterday')
    expect(paceSetWords('2026-10-23', '2026-11-20')).toBe('set 28 days ago')
    expect(paceSetWords(null, '2026-11-20')).toBe('')
  })
})

describe('the words a first-timer reads keep the plain-words rules', () => {
  it('every sentence the card can say', () => {
    const W = PACE_READING_WORDS
    const said = [
      W.over, W.gap('40 hours'), W.overWhy, W.usedUp, W.usedUpBy('12 hours'), W.moreDone('40%'), W.finishAsk,
      W.stillRight('40%'), W.oldWhy('Fri, Oct 23', '18 hours'), W.stillSaved(40), W.stillFailed,
      W.track, W.trackWhy, W.under, W.underBy('19 hours'),
      W.noPercent, W.noPercentNext, W.noBudget, W.noBudgetNext, W.early, W.earlyWhy,
      W.left('56 hours', '2 days'), W.leftShort('10 hours'), W.moneyLeads, W.moneyWrong, W.gapKey,
      ...W.whatLines, paceStillNote(40),
    ].map(plainSentence)
    expect(said.flatMap(plainWordsFailures)).toEqual([])
  })

  it('never says points', () => {
    expect(JSON.stringify(PACE_READING_WORDS)).not.toMatch(/point/i)
  })
})
