import { describe, expect, it } from 'vitest'
import { customerMove } from '../flows/customerMove'
import { portalReady, readyTitle, type ReadinessIn } from './readiness'
import {
  DEMO_TODAY,
  ELENA_CHANGES,
  ELENA_MONEY,
  ELENA_PAGE,
  ELENA_STEPS,
  MARCUS_STEPS,
  PRIYA_CHANGES,
  PRIYA_MONEY,
  PRIYA_PAGE,
  PRIYA_STEPS,
  customerFlow,
} from './portalTestPeople'

const priya: ReadinessIn = {
  firstName: 'Priya',
  off: false,
  move: customerMove('en', { off: false, steps: customerFlow(PRIYA_STEPS), changes: PRIYA_CHANGES }),
  nowStep: 'Start date',
  today: DEMO_TODAY,
  week: PRIYA_PAGE.week,
  apps: PRIYA_MONEY.apps,
  next: PRIYA_MONEY.next,
  changes: PRIYA_CHANGES,
  schedule: PRIYA_PAGE.schedule,
  people: PRIYA_PAGE.people,
}

const elena: ReadinessIn = {
  firstName: 'Elena',
  off: false,
  move: customerMove('en', { off: false, steps: customerFlow(ELENA_STEPS), changes: ELENA_CHANGES }),
  nowStep: 'Pay application',
  today: DEMO_TODAY,
  week: ELENA_PAGE.week,
  apps: ELENA_MONEY.apps,
  next: ELENA_MONEY.next,
  changes: ELENA_CHANGES,
  schedule: ELENA_PAGE.schedule,
  people: ELENA_PAGE.people,
}

const words = (rows: ReturnType<typeof portalReady>, piece: string) => rows.find((r) => r.piece === piece)

describe('Ready for the customer?', () => {
  it("finds Priya's page all set, one row per piece", () => {
    const rows = portalReady(priya)
    expect(rows.map((r) => [r.piece, r.ok, r.words])).toEqual([
      ['Your move', true, 'Change order 2 waits on your answer.'],
      ['This week', true, 'A customer line from Fri Oct 2.'],
      ['Photos', true, 'This week’s line links to the job’s photos.'],
      ['After that', true, 'The next application is sized, $60,000 to $80,000, Nov 5.'],
      ['Change orders', true, '1 waiting on Priya, with the amount and the days.'],
      ['Schedule', true, '3 milestones.'],
      ['Your people', true, 'Rosa, Robert, Wendi.'],
      ['Words', true, 'Every sentence of ours reads in English and Spanish.'],
    ])
    expect(rows.map((r) => [r.from, r.fix])).toEqual([
      ['the step', 'step'],
      ['the daily log', 'log'],
      ['the daily log', 'log'],
      ['the schedule of values', 'forecast'],
      ['Change orders', 'changeOrders'],
      ['the schedule', 'schedule'],
      ["the job's people", 'people'],
      ['Settings → Customer page', 'words'],
    ])
    expect(readyTitle('Priya', rows)).toEqual({ title: 'Ready for Priya?', state: 'all set', good: true })
  })

  it("finds the one thing to fix on Elena's: no photo marked this week", () => {
    const rows = portalReady(elena)
    expect(rows.filter((r) => !r.ok).map((r) => [r.piece, r.words])).toEqual([['Photos', 'No photos link on this week’s log. The card shows words only.']])
    expect(words(rows, 'Your move')?.words).toBe('Nothing owed. Elena reads that we are on Pay application.')
    expect(words(rows, 'Pay applications')?.words).toBe('Every application says what it covers. 1 is with the architect.')
    expect(words(rows, 'Change orders')?.words).toBe('None open. 2 signed, in the sum.')
    expect(words(rows, 'Schedule')?.words).toBe('3 milestones, 1 move with its why.')
    expect(words(rows, 'After that')?.words).toBe('The next application is sized, $115,000 to $145,000, Nov 5.')
    expect(readyTitle('Elena', rows)).toEqual({ title: 'Ready for Elena?', state: '1 thing to fix', good: false })
  })

  it('reads a customer line older than seven days as stale news', () => {
    const rows = portalReady({ ...priya, week: { ...PRIYA_PAGE.week, on: '2026-09-20' } })
    expect(words(rows, 'This week')).toMatchObject({ ok: false, words: 'The last customer line is 12 days old. Priya would read stale news.' })
    expect(words(portalReady({ ...priya, week: { ...PRIYA_PAGE.week, on: '2026-09-25' } }), 'This week')?.ok).toBe(true)
    expect(words(portalReady({ ...priya, week: null }), 'This week')).toMatchObject({ ok: false, words: 'No customer line on the log yet. The card would not show.' })
  })

  it('names the typed lines still waiting on their Spanish, where the prototype always said yes', () => {
    const rows = portalReady({
      ...elena,
      week: { ...ELENA_PAGE.week, line: { en: ELENA_PAGE.week.line.en, es: null } },
      apps: elena.apps.map((a) => (a.n === 4 && a.covers ? { ...a, covers: { en: a.covers.en, es: null } } : a)),
      schedule: { ...ELENA_PAGE.schedule, moves: [{ name: { en: 'Parking lot pour', es: 'Vaciado del estacionamiento' }, why: { en: 'rain', es: null } }] },
    })
    expect(words(rows, 'Words')).toEqual({
      ok: false,
      piece: 'Words',
      words: "This week's line, pay application 4's covers line and the why on Parking lot pour have no Spanish yet. Elena would read English there.",
      from: 'the daily log',
      fix: 'log',
    })
    const one = portalReady({ ...priya, people: [...PRIYA_PAGE.people.slice(0, 2), { name: 'Wendi', role: { en: 'on site', es: null } }] })
    expect(words(one, 'Words')).toMatchObject({ words: "Wendi's role has no Spanish yet. Priya would read English there.", fix: 'people' })
  })

  it('names the pay applications with no customer sentence, one or many', () => {
    const bare = (ns: number[]) => portalReady({ ...elena, apps: elena.apps.map((a) => (ns.includes(a.n) ? { ...a, covers: null } : a)) })
    expect(words(bare([4]), 'Pay applications')).toMatchObject({ ok: false, words: 'Pay application 4 has no customer sentence. Elena would see a number with nothing it bought.' })
    expect(words(bare([4, 3]), 'Pay applications')?.words).toBe('Pay applications 3 and 4 have no customer sentence. Elena would see a number with nothing it bought.')
  })

  it('flags a schedule move with no why, an empty schedule, too few people and nothing sized', () => {
    const noWhy = portalReady({ ...elena, schedule: { ...ELENA_PAGE.schedule, moves: [{ name: { en: 'Parking lot pour', es: 'Vaciado del estacionamiento' }, why: null }] } })
    expect(words(noWhy, 'Schedule')).toMatchObject({ ok: false, words: 'A move has no why. Elena would see a date change and no reason.' })
    expect(words(portalReady({ ...priya, schedule: { milestones: [], moves: [] } }), 'Schedule')).toMatchObject({ ok: false, words: 'No milestones. The tab would be empty.' })
    expect(words(portalReady({ ...priya, people: PRIYA_PAGE.people.slice(0, 1) }), 'Your people')).toMatchObject({ ok: false, words: 'Fewer than two names. Priya would not know who to call.' })
    expect(words(portalReady({ ...priya, next: null }), 'After that')).toMatchObject({ ok: false, words: 'No next application sized. Priya would get no warning before the bill.' })
    expect(words(portalReady({ ...priya, week: { ...PRIYA_PAGE.week, photos: 'off' } }), 'Photos')).toMatchObject({ ok: true, words: 'Photos are off for this job.', fix: 'words' })
    expect(portalReady({ ...priya, sizesNext: false }).map((r) => r.piece)).not.toContain('After that')
  })

  it('gives a customer off the flow one row, since the page reads only a thank-you', () => {
    const marcus: ReadinessIn = {
      ...priya,
      firstName: 'Marcus',
      off: true,
      move: customerMove('en', { off: true, steps: customerFlow(MARCUS_STEPS), changes: [] }),
      nowStep: null,
      week: null,
      next: null,
      changes: [],
      schedule: { milestones: [], moves: [] },
      people: [],
    }
    expect(portalReady(marcus)).toEqual([{ ok: true, piece: 'Your move', words: 'Marcus is off the flow. The page reads a thank-you line and the thread.', from: 'the flow', fix: 'flows' }])
  })
})
