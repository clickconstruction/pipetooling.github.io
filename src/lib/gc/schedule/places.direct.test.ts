/**
 * Main's own tests for where the work is (G-83; the schedule's PR 1a): places set, tidied, taken off
 * and refused, and what a move does to a crowded place, run through the kernels on the test data.
 * The schedule's PR 1b adds the crowded weeks, by crew counts and people on site (G-84): the chart's
 * lane, the card, the morning list and the calls. On Fair Oaks D no bar has a place; with every guess
 * kept, inside has three trades at once until Fri Oct 9 (the spike's own cases).
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../../plainWords'
import type { GcState } from '../types'
import { morningList } from './morningList'
import { planMove } from './moves'
import { crowdedCalls, crowdedSpells, crowdedWeeks, crowdingAfterMove, keptPlaces, morningCrowding, placeChanges, placeRows, placesLogWords, placesSummary, withPlaces } from './places'
import { scheduleItems } from './schedule'
import { initialGcState } from './testState'
import type { CrewCount } from './types'

const ID = 'fairoaksd'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
const lineOf = (s: GcState, label: string) => scheduleItems(s, job(s)).find((i) => i.label === label && i.pkg)!.activity.lineId

/** The made-up job with the places sent, as Keep these places and the opened bar send them. */
function withPlacesSet(s: GcState, places: Record<string, string | null>): GcState {
  const changes = placeChanges(job(s).schedule!.activities, places)!
  return { ...s, projects: s.projects.map((p) => (p.id === ID ? { ...p, schedule: { ...p.schedule!, activities: withPlaces(p.schedule!.activities, changes) } } : p)) }
}
/** Every guess kept. */
function guessesKept(s = initialGcState()): GcState {
  return withPlacesSet(s, Object.fromEntries(placeRows(s, job(s)).flatMap((r) => (r.guess ? [[r.lineId, r.guess.place]] : []))))
}

describe('a bar’s place', () => {
  it('keeps every guess in one press, and says so in the log', () => {
    const s = initialGcState()
    expect(keptPlaces(job(s)).size).toBe(0)
    const guesses = Object.fromEntries(placeRows(s, job(s)).flatMap((r) => (r.guess ? [[r.lineId, r.guess.place]] : [])))
    expect(placesLogWords(job(s), placeChanges(job(s).schedule!.activities, guesses)!)).toBe('Set places on 13 bars at Fair Oaks Shops, Building D.')
    const after = guessesKept()
    expect(keptPlaces(job(after)).size).toBe(13)
    expect(keptPlaces(job(after)).get(lineOf(after, 'Rooftop units'))).toBe('Roof')
  })

  it('sets one place tidied, takes it off, and refuses what cannot take one', () => {
    const s = initialGcState()
    const topOut = lineOf(s, 'Top out')
    const activities = job(s).schedule!.activities
    expect(placeChanges(activities, { [topOut]: '  Level   2 ' })).toEqual([{ lineId: topOut, place: 'Level 2' }])
    const set = withPlacesSet(s, { [topOut]: '  Level   2 ' })
    expect(job(set).schedule!.activities.find((a) => a.lineId === topOut)?.place).toBe('Level 2')
    expect(placesLogWords(job(set), [{ lineId: topOut, place: 'Level 2' }])).toBe('Set the place of Top out to Level 2.')
    // The same place again changes nothing.
    expect(placeChanges(job(set).schedule!.activities, { [topOut]: 'Level 2' })).toEqual([])
    for (const off of [null, '   ']) {
      const changes = placeChanges(job(set).schedule!.activities, { [topOut]: off })!
      expect(changes).toEqual([{ lineId: topOut, place: null }])
      expect(withPlaces(job(set).schedule!.activities, changes).find((a) => a.lineId === topOut)).not.toHaveProperty('place')
      expect(placesLogWords(job(set), changes)).toBe('Took the place off Top out.')
    }
    expect(placesLogWords(job(set), [{ lineId: topOut, place: null }, { lineId: lineOf(s, 'Trim'), place: 'Level 2' }])).toBe('Set places on 1 bar at Fair Oaks Shops, Building D and took 1 off.')
    expect(placeChanges(activities, { 'fairoaksd-insp-roughin': 'Inside' })).toBeNull()
    expect(placeChanges(activities, { nope: 'Inside' })).toBeNull()
    expect(placeChanges(activities, { [topOut]: 'x'.repeat(41) })).toBeNull()
  })
})

describe('what a move does to a crowded place', () => {
  it('says before a move saves when it crowds a place or clears one, and nothing with no places kept', () => {
    const s = guessesKept()
    const fire = lineOf(s, 'Fire alarm')
    expect(crowdingAfterMove(s, job(s), planMove(job(s), fire, '2026-11-30', '2026-12-18')!.activities)).toEqual([{ words: 'Too many in one place: Inside would have 3 trades at once, Mon Nov 30 to Fri Dec 4.', tone: 'amber' }])
    const topOut = lineOf(s, 'Top out')
    expect(crowdingAfterMove(s, job(s), planMove(job(s), topOut, '2026-10-10', '2026-10-21')!.activities)).toEqual([{ words: 'Too many in one place: this clears Inside, Fri Oct 2 to Fri Oct 9.', tone: 'green' }])
    const fresh = initialGcState()
    expect(crowdingAfterMove(fresh, job(fresh), planMove(job(fresh), fire, '2026-11-30', '2026-12-18')!.activities)).toEqual([])
  })
})

/** A trade's own count for a week, as its portal keeps it (G-142): newest first. */
const withCount = (s: GcState, c: Omit<CrewCount, 'on'>): GcState => ({ ...s, projects: s.projects.map((p) => (p.id === ID ? { ...p, crewCounts: [{ ...c, on: s.today }, ...(p.crewCounts ?? [])] } : p)) })
/** A bar's dates, changed in place: for the rule's edges, not a move. */
function withDates(state: GcState, dates: Record<string, [string, string]>): GcState {
  return {
    ...state,
    projects: state.projects.map((p) =>
      p.id !== ID || !p.schedule ? p : { ...p, schedule: { ...p.schedule, activities: p.schedule.activities.map((a) => (dates[a.lineId] ? { ...a, start: dates[a.lineId]![0], finish: dates[a.lineId]![1] } : a)) } },
    ),
  }
}

describe('the crowded weeks: nothing until a place is kept', () => {
  it('leaves the chart’s lane, the card, the morning list and the calls as they were', () => {
    const s = initialGcState()
    expect(crowdedWeeks(s, job(s))).toEqual([])
    expect(crowdedCalls(s, job(s))).toEqual([])
    expect(placesSummary(placeRows(s, job(s)), []).map((l) => l.words)).toEqual(['13 bars not done have a guessed place, and 1 has none.'])
    expect(morningCrowding(job(s), morningList(s, job(s), new Map()), s.today)).toEqual([])
  })
})

describe('the crowded weeks on the made-up job with its guesses kept', () => {
  it('flags inside, Fri Oct 2 to Fri Oct 9, with 3 trades and about 8 people a day; the roof’s 2 is under the rule', () => {
    const s = guessesKept()
    const weeks = crowdedWeeks(s, job(s))
    expect(weeks.map((w) => [w.place, w.weekOf, w.from, w.to, w.most, w.people])).toEqual([
      ['Inside', '2026-09-28', '2026-10-02', '2026-10-04', 3, 8],
      ['Inside', '2026-10-05', '2026-10-05', '2026-10-09', 3, 8],
    ])
    expect(weeks[1]!.words).toBe('Inside has 3 trades at once, Mon Oct 5 to Fri Oct 9.')
    expect(weeks[1]!.rows).toEqual([
      { label: 'Where', lines: ['Inside'] },
      { label: 'When', lines: ['Mon Oct 5 to Fri Oct 9, 3 trades at once.'] },
      { label: 'Who', lines: ['Pecan Valley Electric 2', 'Our own crew 3', 'Cool Breeze Mechanical 3'] },
      { label: 'People', lines: ['About 8 a day.', "A trade's own count for the week comes first, then the daily log's last count, then 3."] },
      { label: 'Rule', lines: ['3 trades or more in one place on the same day is too many.'] },
    ])
    expect(weeks.some((w) => w.place === 'Roof')).toBe(false)
    expect(crowdedSpells(weeks)).toEqual([{ place: 'Inside', from: '2026-10-02', to: '2026-10-09', most: 3 }])
    expect(placesSummary(placeRows(s, job(s)), weeks).map((l) => l.words)).toEqual(['13 bars have a place.', '1 has none.', 'Inside has too many from Fri Oct 2 to Fri Oct 9.'])
  })

  it('says up to 4 when a fourth trade is there only some of the days: Erection put inside', () => {
    const k = guessesKept()
    const s = withPlacesSet(k, { [lineOf(k, 'Erection')]: 'Inside' })
    const weeks = crowdedWeeks(s, job(s))
    expect(weeks.map((w) => [w.weekOf, w.most, w.even, w.words, w.rows.find((r) => r.label === 'When')?.lines[0]])).toEqual([
      ['2026-09-28', 4, false, 'Inside has up to 4 trades at once, Fri Oct 2 to Sun Oct 4.', 'Fri Oct 2 to Sun Oct 4, up to 4 trades at once.'],
      ['2026-10-05', 3, true, 'Inside has 3 trades at once, Mon Oct 5 to Fri Oct 9.', 'Mon Oct 5 to Fri Oct 9, 3 trades at once.'],
    ])
    expect(crowdedSpells(weeks)).toEqual([{ place: 'Inside', from: '2026-10-02', to: '2026-10-09', most: 4 }])
    const calls = crowdedCalls(s, job(s))
    const said = (partnerId: string) => calls.find((c) => c.partnerId === partnerId)
    expect(said('ironhorse')?.text).toBe('Inside has up to 4 trades at once, Fri Oct 2 to Sun Oct 4. With them are Pecan Valley Electric, our own crew and Cool Breeze Mechanical. They have not said how many people a day.')
    expect(said('pecanvalley')?.text).toBe('Inside has up to 4 trades at once, Fri Oct 2 to Fri Oct 9. With them are Iron Horse Fabrication, our own crew and Cool Breeze Mechanical. They have not said how many people a day.')
    expect(said('pecanvalley')?.words.es.detail).toBe('Inside tiene hasta 4 oficios al mismo tiempo del vie 2 oct al vie 9 oct. Con ustedes están Iron Horse Fabrication, nuestra propia cuadrilla y Cool Breeze Mechanical')
  })

  it('counts a trade’s own number for the week first (G-142)', () => {
    const s = withCount(guessesKept(), { packageId: 'fhvac', partnerId: 'coolbreeze', weekOf: '2026-10-05', count: 5 })
    const week = crowdedWeeks(s, job(s)).find((w) => w.weekOf === '2026-10-05')!
    expect([week.people, week.rows.find((r) => r.label === 'Who')?.lines]).toEqual([10, ['Pecan Valley Electric 2', 'Our own crew 3', 'Cool Breeze Mechanical 5, its own count']])
  })

  it('counts by the day on the plan’s dates: a done bar, a late bar and trades a few days apart are no crowd', () => {
    const s = guessesKept()
    const ids = { topOut: lineOf(s, 'Top out'), controls: lineOf(s, 'Controls'), fire: lineOf(s, 'Fire alarm'), trim: scheduleItems(s, job(s)).find((i) => i.label === 'Trim' && i.pkg?.id === 'fplumb')!.activity.lineId }
    // Our own crew's Top out finished, on paper, before today and is not done: it does not fill the days ahead.
    const late = withDates(s, { [ids.topOut]: ['2026-09-28', '2026-10-01'] })
    expect(crowdedWeeks(late, job(late))).toEqual([])
    // Ductwork reported done: Cool Breeze is not inside any more.
    const done: GcState = {
      ...s,
      projects: s.projects.map((p) => (p.id !== ID ? p : { ...p, packages: p.packages.map((k) => (k.id !== 'fhvac' || !k.sow ? k : { ...k, sow: { ...k.sow, sov: k.sow.sov.map((l) => (l.label === 'Ductwork' ? { ...l, pctReported: 100 } : l)) } })) })),
    }
    expect(crowdedWeeks(done, job(done))).toEqual([])
    // Three trades in one week, never more than two on a day.
    const apart = withDates(s, { [ids.controls]: ['2026-11-02', '2026-11-04'], [ids.trim]: ['2026-11-02', '2026-11-04'], [ids.fire]: ['2026-11-05', '2026-11-08'] })
    expect(crowdedWeeks(apart, job(apart)).filter((w) => w.weekOf === '2026-11-02')).toEqual([])
  })

  it('says it on the morning list, from the list’s own companies not held', () => {
    const s = guessesKept()
    const list = morningList(s, job(s), new Map())
    expect(morningCrowding(job(s), list, s.today)).toEqual(['Inside has 3 trades at once today. They are Pecan Valley Electric, our own crew and Cool Breeze Mechanical.'])
    expect(morningCrowding(job(s), morningList(s, job(s), new Map(), '2026-10-01'), s.today)).toEqual(['Inside has 3 trades at once on Thu Oct 1. They are Pecan Valley Electric, our own crew and Cool Breeze Mechanical.'])
    const held = { ...list, expected: list.expected.map((c) => (c.pkg.id !== 'fhvac' ? c : { ...c, bars: c.bars.map((b) => ({ ...b, held: true })) })) }
    expect(morningCrowding(job(s), held, s.today)).toEqual([])
  })

  it('asks each hired company that has not given its count, never our own crew', () => {
    const s = guessesKept()
    const asks = (st: GcState) => crowdedCalls(st, job(st)).map((c) => [c.partnerId, c.tone, c.text])
    expect(asks(s)).toEqual([
      ['pecanvalley', 'amber', 'Inside has 3 trades at once, Fri Oct 2 to Fri Oct 9. With them are our own crew and Cool Breeze Mechanical. They have not said how many people a day.'],
      ['coolbreeze', 'amber', 'Inside has 3 trades at once, Fri Oct 2 to Fri Oct 9. With them are Pecan Valley Electric and our own crew. They have not said how many people a day.'],
    ])
    const call = crowdedCalls(s, job(s))[0]!
    expect([call.lineId, call.words]).toEqual([
      lineOf(s, 'Panels and feeders'),
      {
        en: {
          about: 'how many people you will have on Fair Oaks Shops, Building D from Oct 2',
          detail: 'Inside has 3 trades at once from Fri Oct 2 to Fri Oct 9. With you are our own crew and Cool Breeze Mechanical',
          ask: 'How many people a day will you have there? You can tell us in your portal.',
        },
        es: {
          about: 'cuántas personas tendrá en Fair Oaks Shops, Building D desde el vie 2 oct',
          detail: 'Inside tiene 3 oficios al mismo tiempo del vie 2 oct al vie 9 oct. Con ustedes están nuestra propia cuadrilla y Cool Breeze Mechanical',
          ask: '¿Cuántas personas al día tendrá ahí? Nos puede avisar en su portal.',
        },
      },
    ])
    // Pecan Valley gives this week's count: the ask is only for next week's. Both given: it goes.
    const one = withCount(s, { packageId: 'felec', partnerId: 'pecanvalley', weekOf: '2026-09-28', count: 2 })
    expect(asks(one)[0]).toEqual(['pecanvalley', 'amber', 'Inside has 3 trades at once, Fri Oct 2 to Fri Oct 9. With them are our own crew and Cool Breeze Mechanical. They have not said how many people a day the week of Oct 5.'])
    const both = withCount(one, { packageId: 'felec', partnerId: 'pecanvalley', weekOf: '2026-10-05', count: 2 })
    expect(asks(both).map((a) => a[0])).toEqual(['coolbreeze'])
  })

  it('says every sentence in plain words', () => {
    const s = guessesKept()
    const weeks = crowdedWeeks(s, job(s))
    const texts = [
      ...weeks.flatMap((w) => [w.words, ...w.rows.filter((r) => r.label !== 'Who').flatMap((r) => r.lines)]),
      ...placesSummary(placeRows(s, job(s)), weeks).map((l) => l.words),
      ...placesSummary(placeRows(initialGcState(), job(initialGcState())), []).map((l) => l.words),
      ...crowdedCalls(s, job(s)).flatMap((c) => [c.text, c.words.en.detail, c.words.en.ask]),
      ...morningCrowding(job(s), morningList(s, job(s), new Map()), s.today),
    ]
    for (const t of texts) expect([t, plainWordsFailures(t)]).toEqual([t, []])
  })
})
