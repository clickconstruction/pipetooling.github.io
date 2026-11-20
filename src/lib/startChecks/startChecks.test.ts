/**
 * Before we start, the rules (punch list #382, PR 2). The tests are the card's list: a yes by word, by photo and
 * seen, a bullet that asks for a photo, a bullet read from the app, the percent, the day to decide across a month
 * end, the days they moved, every row of the standing table, the ask across two stages, and what the GC's page may
 * show with each switch off. Every site, person, day and figure here is made up.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { plainSentence, sentenceParts } from '../valuesInPlace'
import {
  CHANGEABLE_VALUES,
  KNOW_WORDS,
  answersOwed,
  askText,
  bulletIsYes,
  bulletLine,
  byTrouble,
  crewConfirmed,
  daySpan,
  goNoGoDay,
  holdText,
  inDaysWords,
  lastCheckDay,
  movedDays,
  openOnThem,
  openOnUs,
  readiness,
  readyMarks,
  saidNo,
  settledWords,
  sharedBullets,
  siteBanner,
  siteMovedDays,
  stageStanding,
  stagesToAsk,
  standingInWords,
  startClash,
  startsShown,
  theirDay,
  toLookAt,
  waitsOnPhoto,
  type Bullet,
  type Site,
  type Stage,
  type ThemBullet,
  type UsBullet,
  type ValueKind,
  type Yes,
} from './startChecks'

const TODAY = '2026-11-17'
const SITE: Site = { noticeDays: 10, contact: 'Ray' }

let seq = 0
const them = (words: string, o: Partial<ThemBullet> = {}): ThemBullet => ({ id: `t${++seq}`, on: 'them', words, wantsPhoto: false, eye: true, yes: null, asks: [], byDay: null, ...o })
const us = (words: string, ok: boolean, o: Partial<UsBullet> = {}): UsBullet => ({ id: `u${++seq}`, on: 'us', words, reads: 'order_log', ok, fact: ok ? 'Two lines land Nov 25, six days ahead' : 'Three lines are not ordered', door: 'Open the order log', ...o })
const stage = (o: Partial<Stage> = {}): Stage => ({ id: `s${++seq}`, part: 'Lodge', job: 'J2101', name: 'Top Out', window: ['2026-12-08', '2026-12-12'], trip: null, finished: false, theirDays: [], bullets: [], decision: null, arrival: null, ...o })
const yes = (know: Yes['know'], o: Partial<Yes> = {}): Yes => ({ know, who: know === 'saw' ? 'Luis' : 'Ray', how: know === 'saw' ? 'on site' : know === 'photo' ? 'on his page' : 'by phone', day: '2026-11-14', ...o })
const kinds = (sentence: string) => sentenceParts<ValueKind>(sentence).flatMap((p) => (typeof p === 'string' ? [] : [p.kind]))

describe('a yes on a bullet', () => {
  it('stands on their word, on their photo, and when one of ours saw it', () => {
    expect(bulletIsYes(them('Power is on for our tools.', { yes: yes('word') }))).toBe(true)
    expect(bulletIsYes(them('Power is on for our tools.', { yes: yes('photo') }))).toBe(true)
    expect(bulletIsYes(them('Power is on for our tools.', { yes: yes('saw') }))).toBe(true)
    expect(bulletIsYes(them('Power is on for our tools.'))).toBe(false)
    expect(KNOW_WORDS).toEqual({ word: 'their word', photo: 'their photo', saw: 'we saw it' })
  })

  it('a bullet that asks for a photo is not a yes on their word alone', () => {
    const word = them('Framing is done and the roof is dried in.', { wantsPhoto: true, yes: yes('word') })
    expect(bulletIsYes(word)).toBe(false)
    expect(waitsOnPhoto(word)).toBe(true)
    expect(plainSentence(bulletLine(word))).toBe('Ray, by phone, Nov 14. Still needs a photo.')
    for (const know of ['photo', 'saw'] as const) {
      const settled = them('Framing is done and the roof is dried in.', { wantsPhoto: true, yes: yes(know) })
      expect(bulletIsYes(settled)).toBe(true)
      expect(waitsOnPhoto(settled)).toBe(false)
    }
    // With no answer at all it is open, and it is not waiting on a photo yet.
    expect(waitsOnPhoto(them('Forms are set where our pipe passes.', { wantsPhoto: true }))).toBe(false)
  })

  it('a bullet on us is read from the app, and nobody ticks it', () => {
    const landed = us('Our material lands before day one.', true)
    const notYet = us('Our material lands before day one.', false)
    expect(bulletIsYes(landed)).toBe(true)
    expect(bulletIsYes(notYet)).toBe(false)
    expect(waitsOnPhoto(notYet)).toBe(false)
    expect(bulletLine(landed)).toBe('Two lines land Nov 25, six days ahead')
    expect(bulletLine(notYet)).toBe('Three lines are not ordered')
  })

  it('the line under a bullet says how we know, or when we asked and the day they gave', () => {
    const settled = them('The trench to the building is open.', { yes: yes('photo', { day: '2026-11-10' }) })
    expect(plainSentence(bulletLine(settled))).toBe('Ray, on his page, Nov 10.')
    expect(kinds(bulletLine(settled))).toEqual(['who', 'how', 'day'])
    expect(bulletLine(them('Water is on site.'))).toBe('Not asked yet.')
    const asked = them('The framing inspection has passed.', { asks: [{ day: '2026-11-10', how: 'email' }, { day: '2026-11-14', how: 'text' }], byDay: '2026-11-26' })
    expect(plainSentence(bulletLine(asked))).toBe('Asked Nov 14 by text. No answer yet. They say by Nov 26.')
    expect(kinds(bulletLine(asked))).toEqual(['day', 'by'])
  })
})

describe('the percent', () => {
  const list = (yesCount: number, total: number): Bullet[] => Array.from({ length: total }, (_, i) => them(`Bullet ${i + 1}.`, { yes: i < yesCount ? yes('word') : null }))

  it('counts every bullet the same, rounds down, and reads 100 only when every bullet has a yes', () => {
    expect(readiness(list(0, 4))).toEqual({ yes: 0, total: 4, pct: 0 })
    expect(readiness(list(5, 6))).toEqual({ yes: 5, total: 6, pct: 83 })
    expect(readiness(list(199, 200))).toEqual({ yes: 199, total: 200, pct: 99 })
    expect(readiness(list(200, 200))).toEqual({ yes: 200, total: 200, pct: 100 })
    expect(readiness(list(4, 4)).pct).toBe(100)
    expect(readiness([])).toEqual({ yes: 0, total: 0, pct: 0 })
  })

  it('counts a bullet of ours and a bullet that still needs a photo the same as any other', () => {
    const bullets = [them('A.', { yes: yes('word') }), them('B.', { wantsPhoto: true, yes: yes('word') }), us('C.', true), us('D.', false)]
    expect(readiness(bullets)).toEqual({ yes: 2, total: 4, pct: 50 })
  })

  it('draws the ready bar ready first, then a No, then the open ones', () => {
    const a = them('A.')
    const b = them('B.', { yes: yes('saw') })
    const c = them('C.')
    const d = us('D.', true)
    const s = stage({ bullets: [a, b, c, d], arrival: { day: TODAY, by: 'Luis', notAsTold: [c.id] } })
    expect(readyMarks(s)).toEqual(['yes', 'yes', 'no', 'open'])
    expect(saidNo(s, c)).toBe(true)
    expect(saidNo(s, a)).toBe(false)
    // A yes given after the No clears the cross.
    const fixed = stage({ bullets: [a, b, { ...c, yes: yes('photo') }, d], arrival: { day: TODAY, by: 'Luis', notAsTold: [c.id] } })
    expect(readyMarks(fixed)).toEqual(['yes', 'yes', 'yes', 'open'])
    expect(readyMarks(stage())).toEqual([])
  })
})

describe('the days', () => {
  it('the day to decide is our first day less the notice, across a month end and a year end', () => {
    expect(goNoGoDay(stage({ window: ['2026-12-08', '2026-12-12'] }), SITE)).toBe('2026-11-28')
    expect(goNoGoDay(stage({ window: ['2026-12-01', '2026-12-12'] }), { ...SITE, noticeDays: 2 })).toBe('2026-11-29')
    expect(goNoGoDay(stage({ window: ['2027-01-05', '2027-01-09'] }), SITE)).toBe('2026-12-26')
    expect(goNoGoDay(stage({ window: ['2028-03-05', '2028-03-09'] }), SITE)).toBe('2028-02-24')
    expect(goNoGoDay(stage({ window: ['2026-12-08', '2026-12-12'] }), { ...SITE, noticeDays: 0 })).toBe('2026-12-08')
  })

  it('the last check is the day before the crew leaves: the trip’s first day when there is one', () => {
    expect(lastCheckDay(stage({ window: ['2026-12-01', '2026-12-12'] }))).toBe('2026-11-30')
    expect(lastCheckDay(stage({ window: ['2026-12-01', '2026-12-12'], trip: ['2026-11-30', '2026-12-13'] }))).toBe('2026-11-29')
  })

  it('adds up the days they moved, from the first day they gave to the newest', () => {
    const day = (d: string, said: string) => ({ day: d, said, who: 'Ray', how: 'email' })
    const one = stage({ theirDays: [day('2026-11-24', '2026-11-03')] })
    const two = stage({ theirDays: [day('2026-11-24', '2026-11-03'), day('2026-11-28', '2026-11-12')] })
    const three = stage({ theirDays: [day('2026-11-24', '2026-11-03'), day('2026-11-28', '2026-11-12'), day('2026-12-05', '2026-11-16')] })
    const earlier = stage({ theirDays: [day('2026-11-24', '2026-11-03'), day('2026-11-20', '2026-11-12')] })
    expect([one, two, three, earlier, stage()].map(movedDays)).toEqual([0, 4, 11, 0, 0])
    expect(theirDay(three)?.day).toBe('2026-12-05')
    expect(theirDay(stage())).toBeNull()
    expect(siteMovedDays([one, two, three, stage({ finished: true, theirDays: three.theirDays })])).toBe(15)
  })

  it('their day clashes only when it is after our first day', () => {
    const on = (d: string) => stage({ window: ['2026-12-08', '2026-12-12'], theirDays: [{ day: d, said: TODAY, who: 'Ray', how: 'phone' }] })
    expect(startClash(on('2026-12-09'))).toBe(true)
    expect(startClash(on('2026-12-08'))).toBe(false)
    expect(startClash(on('2026-12-01'))).toBe(false)
    expect(startClash(stage())).toBe(false)
  })

  it('says a span, and how far off a day is', () => {
    expect(daySpan('2026-12-01', '2026-12-12')).toBe('Dec 1 to 12')
    expect(daySpan('2026-11-30', '2026-12-13')).toBe('Nov 30 to Dec 13')
    expect(daySpan('2026-12-28', '2027-12-30')).toBe('Dec 28 to Dec 30')
    expect([inDaysWords(TODAY, TODAY), inDaysWords(TODAY, '2026-11-18'), inDaysWords(TODAY, '2026-11-21'), inDaysWords(TODAY, '2026-11-16'), inDaysWords(TODAY, '2026-11-14')]).toEqual(['today', 'in 1 day', 'in 4 days', '1 day ago', '3 days ago'])
  })
})

describe('where a stage stands: every row of the table', () => {
  const read = (s: Stage, today = TODAY, site = SITE) => {
    const st = stageStanding(s, site, today)
    return { light: st.light, sentence: plainSentence(st.sentence), next: st.next, nextLabel: st.nextLabel }
  }

  it('no list written: grey, Write the list', () => {
    expect(read(stage())).toEqual({ light: 'grey', sentence: 'Nobody has written what must be true before this stage.', next: 'write', nextLabel: 'Write the list' })
  })

  it('the crew said No on arrival: red, Open the stage, even after a Go', () => {
    const b = them('The trench to the building is open.')
    const s = stage({ bullets: [b, them('Water is on site.', { yes: yes('saw') })], decision: { kind: 'go', by: 'Dana', day: '2026-11-12', openThen: [] }, arrival: { day: TODAY, by: 'Luis', notAsTold: [b.id] } })
    expect(read(s)).toEqual({ light: 'red', sentence: 'Luis got there Nov 17 and it was not as told: The trench to the building is open.', next: 'look', nextLabel: 'Open the stage' })
    // An arrival with every bullet as told is not this row.
    expect(read({ ...s, arrival: { day: TODAY, by: 'Luis', notAsTold: [] }, bullets: s.bullets.map((x) => (x.on === 'them' ? { ...x, yes: yes('saw') } : x)) }).light).toBe('green')
  })

  it('Go, nothing open: green, no press', () => {
    const s = stage({ bullets: [them('The gas company has set the meter.', { yes: yes('saw') }), us('The permit is in hand.', true)], decision: { kind: 'go', by: 'Dana', day: '2026-11-12', openThen: [] } })
    expect(read(s)).toEqual({ light: 'green', sentence: 'Crew confirmed for Tue Dec 8. Dana pressed Go Nov 12.', next: 'none', nextLabel: null })
  })

  it('Go with something open: amber, a go on a promise, and the press is the ask or our door', () => {
    const go = { kind: 'go' as const, by: 'Dana', day: '2026-11-21', openThen: ['The framing inspection has passed.'] }
    const onThem = stage({ window: ['2026-12-01', '2026-12-12'], trip: ['2026-11-30', '2026-12-13'], bullets: [them('The framing inspection has passed.'), us('Our material lands before day one.', true)], decision: go })
    expect(read(onThem, '2026-11-22')).toEqual({ light: 'amber', sentence: 'Dana pressed Go Nov 21 with 1 thing open. Last check Sun Nov 29.', next: 'ask', nextLabel: 'Ask Ray' })
    const onUs = stage({ window: ['2026-12-01', '2026-12-12'], bullets: [them('The framing inspection has passed.', { yes: yes('word') }), us('Our material lands before day one.', false), us('The crew and the trip are set.', false, { door: 'Open the trip' })], decision: go })
    expect(read(onUs, '2026-11-22')).toEqual({ light: 'amber', sentence: 'Dana pressed Go Nov 21 with 2 things open. Last check Mon Nov 30.', next: 'ours', nextLabel: 'Open the order log' })
  })

  it('their day is after ours: red, Move our start', () => {
    const s = stage({ bullets: [them('Water is on site.')], theirDays: [{ day: '2026-12-01', said: '2026-10-28', who: 'Ray', how: 'phone' }, { day: '2026-12-12', said: '2026-11-16', who: 'Ray', how: 'phone' }] })
    expect(read(s)).toEqual({ light: 'red', sentence: 'Ray says ready Dec 12. We planned to start Tue Dec 8.', next: 'move', nextLabel: 'Move our start' })
  })

  it('nothing open, no decision: green, Go', () => {
    const s = stage({ window: ['2026-12-01', '2026-12-12'], bullets: [them('Power is on for our tools.', { yes: yes('saw') }), us('Our material lands before day one.', true)] })
    expect(read(s)).toEqual({ light: 'green', sentence: 'Nothing is open. Press Go to confirm the crew for Tue Dec 1.', next: 'go', nextLabel: 'Go' })
  })

  it('only ours is open: amber with our door, then red and Go or hold once the day to decide comes', () => {
    const s = stage({ bullets: [them('Water is on site.', { yes: yes('word') }), us('Our material lands before day one.', false)] })
    expect(read(s)).toEqual({ light: 'amber', sentence: 'Ray is done. 1 thing of ours is not ready. We decide by Sat Nov 28, in 11 days.', next: 'ours', nextLabel: 'Open the order log' })
    expect(read(s, '2026-11-28')).toEqual({ light: 'red', sentence: 'Ray is done. 1 thing of ours is not ready. We decide today.', next: 'decide', nextLabel: 'Go or hold' })
    const two = stage({ bullets: [us('Our material lands before day one.', false), us('The permit is in hand.', false, { door: 'Open the permit' })] })
    expect(read(two).sentence).toBe('Ray is done. 2 things of ours are not ready. We decide by Sat Nov 28, in 11 days.')
  })

  it('theirs is open and the day has come: red, Go or hold', () => {
    const s = stage({ bullets: [them('Forms are set where our pipe passes.'), them('Water is on site.')] })
    expect(read(s, '2026-11-28')).toEqual({ light: 'red', sentence: 'Waiting on Ray for 2 things. We decide today.', next: 'decide', nextLabel: 'Go or hold' })
    expect(read(s, '2026-12-01')).toEqual({ light: 'red', sentence: 'Waiting on Ray for 2 things. We should have decided Sat Nov 28.', next: 'decide', nextLabel: 'Go or hold' })
  })

  it('theirs is open inside 14 days: amber and Ask, or Go or hold once every bullet was asked in the last two days', () => {
    const open = them('The framing inspection has passed.')
    const s = stage({ window: ['2026-12-01', '2026-12-12'], bullets: [open, us('Our material lands before day one.', false)] })
    expect(read(s)).toEqual({ light: 'amber', sentence: 'Waiting on Ray for 1 thing, and 1 of ours. We decide by Sat Nov 21, in 4 days.', next: 'ask', nextLabel: 'Ask Ray' })
    const asked = (day: string) => stage({ window: ['2026-12-01', '2026-12-12'], bullets: [{ ...open, asks: [{ day, how: 'text' }] }] })
    expect(read(asked('2026-11-15'))).toMatchObject({ light: 'amber', next: 'decide', nextLabel: 'Go or hold' })
    expect(read(asked('2026-11-14'))).toMatchObject({ light: 'amber', next: 'ask', nextLabel: 'Ask Ray' })
    // One bullet asked and one not: the ask is still the next press.
    const mixed = stage({ window: ['2026-12-01', '2026-12-12'], bullets: [{ ...open, asks: [{ day: TODAY, how: 'text' }] }, them('Power is on for our tools.')] })
    expect(read(mixed)).toMatchObject({ next: 'ask', sentence: 'Waiting on Ray for 2 things. We decide by Sat Nov 21, in 4 days.' })
  })

  it('theirs is open and further out: grey, nothing to do until two weeks before the day to decide', () => {
    const s = stage({ window: ['2027-01-12', '2027-01-23'], bullets: [them('The slab is poured and cured enough to walk.'), them('Framing is done where we run pipe.'), them('Power is on for our tools.'), us('Our material lands before day one.', false)] })
    expect(read(s)).toEqual({ light: 'grey', sentence: '4 things open. Nothing to do until Dec 19.', next: 'none', nextLabel: null })
    // Exactly 14 days out it is time to ask.
    expect(read(s, '2026-12-19')).toMatchObject({ light: 'amber', next: 'ask' })
    expect(read(s, '2026-12-18').light).toBe('grey')
  })

  it('a stage with a list and no days of ours: grey, Plan our days, and it asks nobody', () => {
    const s = stage({ window: null, bullets: [them('Water is on site.')] })
    expect(read(s)).toEqual({ light: 'grey', sentence: 'We have not planned our days for this stage.', next: 'plan', nextLabel: 'Plan our days' })
    expect(read(stage({ window: null })).next).toBe('write')
    expect(goNoGoDay(s, SITE)).toBeNull()
    expect(lastCheckDay(s)).toBeNull()
    expect(startClash({ ...s, theirDays: [{ day: '2026-12-12', said: TODAY, who: 'Ray', how: 'phone' }] })).toBe(false)
    expect(stagesToAsk([s], SITE, TODAY)).toEqual([])
    expect(plainWordsFailures(standingInWords(s, SITE, TODAY))).toEqual([])
    // The office can still write to them about it: the ask names the stage with no days.
    expect(askText(SITE, [s]).split('\n')[2]).toBe('Lodge top out:')
    expect(holdText(SITE, s, '2026-12-15').split('\n')[0]).toBe('Ray, we are holding our start on the Lodge top out.')
  })

  it('a finished stage is done, and a held stage says since when', () => {
    expect(read(stage({ finished: true, bullets: [them('Water is on site.')] }))).toEqual({ light: 'grey', sentence: 'This stage is finished.', next: 'none', nextLabel: null })
    const held = stage({ bullets: [them('Water is on site.')], decision: { kind: 'hold', by: 'Dana', day: '2026-11-16', openThen: ['Water is on site.'] } })
    expect(read(held).sentence).toBe('On hold since Nov 16. Waiting on Ray for 1 thing. We decide by Sat Nov 28, in 11 days.')
  })

  it('marks its values: four kinds can be changed where they stand, the rest are worked out', () => {
    expect([...CHANGEABLE_VALUES].sort()).toEqual(['contact', 'notice', 'start', 'their'])
    const waiting = stage({ window: ['2026-12-01', '2026-12-12'], bullets: [them('The framing inspection has passed.')] })
    expect(kinds(stageStanding(waiting, SITE, TODAY).sentence)).toEqual(['contact', 'count', 'decide'])
    const clash = stage({ bullets: [them('Water is on site.')], theirDays: [{ day: '2026-12-12', said: TODAY, who: 'Ray', how: 'phone' }] })
    expect(kinds(stageStanding(clash, SITE, TODAY).sentence)).toEqual(['who', 'their', 'start'])
    expect(standingInWords(clash, SITE, TODAY)).toBe('Ray says ready Dec 12. We planned to start Tue Dec 8.')
  })

  it('says every sentence in plain words', () => {
    const b = them('Water is on site.')
    const cases: Array<[Stage, string]> = [
      [stage(), TODAY],
      [stage({ finished: true }), TODAY],
      [stage({ bullets: [them('A.', { yes: yes('saw') })], decision: { kind: 'go', by: 'Dana', day: '2026-11-12', openThen: [] } }), TODAY],
      [stage({ bullets: [b], decision: { kind: 'go', by: 'Dana', day: '2026-11-12', openThen: ['Water is on site.'] } }), TODAY],
      [stage({ bullets: [b], theirDays: [{ day: '2026-12-12', said: TODAY, who: 'Ray', how: 'phone' }] }), TODAY],
      [stage({ bullets: [them('A.', { yes: yes('saw') })] }), TODAY],
      [stage({ bullets: [us('Our material lands before day one.', false)] }), TODAY],
      [stage({ bullets: [b, us('Our material lands before day one.', false)], decision: { kind: 'hold', by: 'Dana', day: '2026-11-16', openThen: [] } }), TODAY],
      [stage({ bullets: [b] }), '2026-11-28'],
      [stage({ bullets: [b] }), '2026-12-02'],
      [stage({ window: ['2027-01-12', '2027-01-23'], bullets: [b] }), TODAY],
    ]
    for (const [s, today] of cases) expect(plainWordsFailures(standingInWords(s, SITE, today))).toEqual([])
    // The No row quotes the bullet, which is the office's own words: its fixed part is held.
    expect(plainWordsFailures('Luis got there Nov 17 and it was not as told:')).toEqual([])
    for (const line of ['Not asked yet.', 'Asked Nov 14 by text. No answer yet. They say by Nov 26.', 'Ray, by phone, Nov 14. Still needs a photo.']) expect(plainWordsFailures(line)).toEqual([])
  })
})

describe('the site', () => {
  const lodge = stage({ id: 'lodge', part: 'Lodge', name: 'Top Out', window: ['2026-12-01', '2026-12-12'], bullets: [them('The framing inspection has passed.'), them('Power is on for our tools.', { yes: yes('saw') })] })
  const bunk = stage({ id: 'bunk', part: 'Bunkhouse', name: 'Underground', window: ['2026-12-08', '2026-12-12'], bullets: [them('Forms are set where our pipe passes.', { wantsPhoto: true }), them('Water is on site.'), us('Our material lands before day one.', false)] })
  const far = stage({ id: 'far', part: 'Bunkhouse', name: 'Rough In', window: ['2027-01-12', '2027-01-23'], bullets: [them('The slab is poured and cured enough to walk.')] })
  const done = stage({ id: 'done', finished: true, bullets: [them('Water is on site.')] })
  const all = [far, bunk, done, lodge]

  it('asks about the stages whose day to decide is near, and counts what they owe', () => {
    expect(stagesToAsk(all, SITE, TODAY).map((s) => s.id)).toEqual(['bunk', 'lodge'])
    expect(answersOwed(all, SITE, TODAY)).toBe(3)
    const banner = siteBanner(all, SITE, TODAY)
    expect(plainSentence(banner.sentence)).toBe('Ray owes us 3 answers on 2 stages.')
    expect(banner.askLabel).toBe('Ask Ray about all 3')
    expect(siteBanner([lodge], SITE, TODAY)).toMatchObject({ askLabel: 'Ask Ray about 1' })
    expect(plainSentence(siteBanner([lodge], SITE, TODAY).sentence)).toBe('Ray owes us 1 answer on 1 stage.')
    const quiet = siteBanner([far, done], SITE, TODAY)
    expect(plainSentence(quiet.sentence)).toBe('Nothing to ask Ray right now.')
    expect(quiet.askLabel).toBeNull()
  })

  it('sorts the stages ahead by trouble, then by first day', () => {
    const clash = stage({ id: 'clash', window: ['2026-12-20', '2026-12-22'], bullets: [them('Water is on site.')], theirDays: [{ day: '2026-12-24', said: TODAY, who: 'Ray', how: 'phone' }] })
    const go = stage({ id: 'go', window: ['2026-11-20', '2026-11-21'], bullets: [them('A.', { yes: yes('saw') })], decision: { kind: 'go', by: 'Dana', day: '2026-11-12', openThen: [] } })
    const late = stage({ id: 'late', window: ['2026-11-25', '2026-11-26'], bullets: [them('Water is on site.')] })
    // red (late, then clash by first day), amber (lodge, then bunk), green, grey. The finished stage is not ahead.
    expect(byTrouble([far, go, bunk, done, clash, lodge, late], SITE, TODAY).map((s) => s.id)).toEqual(['late', 'clash', 'lodge', 'bunk', 'go', 'far'])
    // Inside grey, a stage with no days comes after the ones that have them.
    const noDays = stage({ id: 'a-no-days', window: null, bullets: [them('Water is on site.')] })
    expect(byTrouble([noDays, far], SITE, TODAY).map((s) => s.id)).toEqual(['far', 'a-no-days'])
  })

  it('writes one ask across two stages, and a bullet that asks for a photo says so', () => {
    expect(askText(SITE, [lodge, bunk])).toBe(
      [
        'Ray, a few things before we lock in our crew.',
        '',
        'Lodge top out, we plan Tue Dec 1 and decide by Sat Nov 21:',
        '1. The framing inspection has passed.',
        '',
        'Bunkhouse underground, we plan Tue Dec 8 and decide by Sat Nov 28:',
        '1. Forms are set where our pipe passes. A photo would settle it.',
        '2. Water is on site.',
        '',
        'A yes or a not yet on each is all we need.',
      ].join('\n'),
    )
  })

  it('leaves a stage with nothing open on them out of the ask, and never names a bullet of ours', () => {
    const settled = stage({ part: 'Site', name: 'Gas line tie-in', bullets: [them('The gas company has set the meter.', { yes: yes('saw') }), us('The permit is in hand.', false)] })
    const text = askText(SITE, [settled, lodge])
    expect(text).not.toContain('Gas line')
    expect(text).not.toContain('permit')
    expect(text).not.toContain('Power is on')
    expect(text.split('\n').filter((l) => /^\d+\./.test(l))).toEqual(['1. The framing inspection has passed.'])
  })

  it('points to their page only when it shows what we need, and says a wasted trip is billed only in the owner’s own sentence', () => {
    expect(askText(SITE, [lodge])).not.toContain('page')
    expect(askText(SITE, [lodge], { page: true }).split('\n').pop()).toBe('A yes or a not yet on each is all we need. Or tap to answer on your page.')
    expect(askText(SITE, [lodge], { wastedTrip: '  ' }).split('\n').pop()).toBe('A yes or a not yet on each is all we need.')
    expect(askText(SITE, [lodge], { wastedTrip: 'A trip we make for nothing is billed.' }).split('\n').pop()).toBe('A trip we make for nothing is billed.')
  })

  it('names a stage on a site of one part without the part', () => {
    const one = stage({ part: '', name: 'Trim Set', window: ['2026-12-01', '2026-12-03'], bullets: [them('The rooms we work in are finished and clear.')] })
    expect(askText(SITE, [one]).split('\n')[2]).toBe('Trim set, we plan Tue Dec 1 and decide by Sat Nov 21:')
    expect(holdText(SITE, one, '2026-12-08').split('\n')[0]).toBe('Ray, we are holding our start on the trim set. We planned Tue Dec 1.')
  })

  it('writes the hold note for the office to send, with what must be true first', () => {
    expect(holdText(SITE, bunk, '2026-12-15')).toBe(
      ['Ray, we are holding our start on the Bunkhouse underground. We planned Tue Dec 8.', 'We cannot send a crew until these are true:', '1. Forms are set where our pipe passes.', '2. Water is on site.', 'Our next opening is Tue Dec 15. Tell us the day it is ready and we will lock it in.'].join('\n'),
    )
    expect(holdText(SITE, lodge, '2026-12-08').split('\n')[1]).toBe('We cannot send a crew until this is true:')
    // A hold with nothing open on them gives the days and no list.
    const ours = stage({ bullets: [us('Our material lands before day one.', false)] })
    expect(holdText(SITE, ours, '2026-12-15')).toBe('Ray, we are holding our start on the Lodge top out. We planned Tue Dec 8.\nOur next opening is Tue Dec 15. Tell us the day it is ready and we will lock it in.')
    for (const line of holdText(SITE, bunk, '2026-12-15').split('\n').filter((l) => !/^\d+\./.test(l))) expect(plainWordsFailures(line)).toEqual([])
    for (const line of askText(SITE, [lodge, bunk], { page: true }).split('\n').filter((l) => l && !/^\d+\./.test(l))) expect(plainWordsFailures(line)).toEqual([])
  })
})

describe('the GC’s page', () => {
  const shown = them('The framing inspection has passed.')
  const hidden = them('The other trades are out of the walls we work in.', { eye: false })
  const settled = them('Power is on for our tools.', { yes: yes('saw') })
  const ours = us('Our material lands before day one.', false)
  const s = stage({ bullets: [shown, hidden, settled, ours] })
  const on = { sharesStageDates: true, showsWhatWeNeed: true }

  it('shows nothing with either of the job’s switches off', () => {
    expect(sharedBullets(s, { sharesStageDates: false, showsWhatWeNeed: true })).toEqual([])
    expect(sharedBullets(s, { sharesStageDates: true, showsWhatWeNeed: false })).toEqual([])
    expect(sharedBullets(s, { sharesStageDates: false, showsWhatWeNeed: false })).toEqual([])
  })

  it('shows a bullet on them with its eye on, and leaves out one with its eye off', () => {
    expect(sharedBullets(s, on).map((b) => b.id)).toEqual([shown.id, settled.id])
    expect(sharedBullets(stage({ bullets: [hidden] }), on)).toEqual([])
  })

  it('never shows a bullet of ours, whatever its row says', () => {
    const turnedOn = { ...ours, eye: true } as unknown as Bullet
    expect(sharedBullets(stage({ bullets: [turnedOn, shown] }), on).map((b) => b.id)).toEqual([shown.id])
    expect(startsShown('them')).toBe(true)
    expect(startsShown('us')).toBe(false)
  })

  it('counts its own percent from what it shows, so the office and the GC can read different numbers', () => {
    expect(readiness(sharedBullets(s, on)).pct).toBe(50)
    expect(readiness(s.bullets).pct).toBe(25)
  })

  it('reads crew confirmed only after our Go with nothing open', () => {
    const go = { kind: 'go' as const, by: 'Dana', day: '2026-11-12', openThen: [] }
    expect(crewConfirmed(stage({ bullets: [settled], decision: go }))).toBe(true)
    expect(crewConfirmed(stage({ bullets: [settled, ours], decision: go }))).toBe(false)
    expect(crewConfirmed(stage({ bullets: [settled] }))).toBe(false)
    expect(crewConfirmed(stage({ bullets: [settled], decision: { ...go, kind: 'hold' } }))).toBe(false)
  })

  it('says how we know a settled bullet with no name of ours', () => {
    expect(settledWords({ ...shown, yes: yes('saw', { who: 'Luis' }) })).toBe('we saw it on site')
    expect(settledWords({ ...shown, yes: yes('photo', { day: '2026-11-12' }) })).toBe('your photo, Nov 12')
    expect(settledWords({ ...shown, yes: yes('word') })).toBe('you told us Nov 14')
    expect(settledWords(shown)).toBe('')
  })
})

describe('the crew’s phone', () => {
  it('lists only the bullets on them that nobody of ours has seen', () => {
    const word = them('The other trades are out of the walls we work in.', { yes: yes('word') })
    const photo = them('Framing is done and the roof is dried in.', { wantsPhoto: true, yes: yes('photo') })
    const seen = them('Power is on for our tools.', { yes: yes('saw') })
    const open = them('The framing inspection has passed.')
    const s = stage({ bullets: [word, photo, seen, open, us('Our material lands before day one.', false)] })
    expect(toLookAt(s).map((b) => b.id)).toEqual([word.id, photo.id, open.id])
    expect(toLookAt(stage({ bullets: [seen] }))).toEqual([])
    expect(openOnThem(s).map((b) => b.id)).toEqual([open.id])
    expect(openOnUs(s)).toHaveLength(1)
  })
})
