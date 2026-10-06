import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import type { GcAction, GcState } from './gcTypes'
import { scheduleItems } from './gcBuildingSchedule'
import { callList } from './gcCallList'
import { chartHolds } from './gcChartHolds'
import { morningList } from './gcMorningList'
import { planMove } from './gcScheduleMoves'
import { plainWordsFailures } from '../plainWords'
import { PLACE_RULE, TRADES_IN_ONE_PLACE, crowdedCalls, crowdedSpells, crowdedWeeks, crowdingAfterMove, keptPlaces, morningCrowding, placeGuess, placeRows, placesSummary } from './gcPlaces'

/**
 * GC mode design spike: too many trades in one place (G-83). On the made-up job being built, Fair
 * Oaks D, today Fri Oct 2, no bar has a place. Its guesses put the rough-ins inside and the roofing
 * and the rooftop units on the roof. Kept, inside has Pecan Valley Electric, our own crew and Cool
 * Breeze Mechanical at once until Fri Oct 9; the roof has two trades, Oct 12 to Oct 21.
 */

const ID = 'fairoaksd'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
const play = (state: GcState, ...actions: GcAction[]) => actions.reduce((s, a) => gcReducer(s, a), state)
const lineOf = (s: GcState, label: string) => scheduleItems(s, job(s)).find((i) => i.label === label && i.pkg)!.activity.lineId
const placesOf = (places: Record<string, string | null>): GcAction => ({ type: 'setActivityPlaces', projectId: ID, places })

/** The made-up job with every guess kept, as Keep these places sends them. */
function guessesKept(state = initialGcState()): GcState {
  return gcReducer(state, placesOf(Object.fromEntries(placeRows(state, job(state)).flatMap((r) => (r.guess ? [[r.lineId, r.guess.place]] : [])))))
}

/** A bar's dates, changed in place: for the rule's edges, not a move. */
function withDates(state: GcState, dates: Record<string, [string, string]>): GcState {
  return {
    ...state,
    projects: state.projects.map((p) =>
      p.id !== ID || !p.schedule ? p : { ...p, schedule: { ...p.schedule, activities: p.schedule.activities.map((a) => (dates[a.lineId] ? { ...a, start: dates[a.lineId]![0], finish: dates[a.lineId]![1] } : a)) } },
    ),
  }
}

describe('where a place comes from', () => {
  it('guesses each bar not done from its name, its trade or its stage, and leaves the frame with none', () => {
    expect(placeRows(initialGcState(), job(initialGcState())).map((r) => `${r.name}: ${r.guess ? `${r.guess.place}, ${r.guess.from}` : 'none'}`)).toEqual([
      'Structural steel · Erection: none',
      'Roofing · TPO membrane: Roof, name',
      'Roofing · Sheet metal and flashing: Roof, name',
      'Roofing · Roof curbs: Roof, name',
      'Electrical · Panels and feeders: Inside, stage',
      'Electrical · Lighting: Inside, stage',
      'Electrical · Site lighting: Site, name',
      'Electrical · Fire alarm: Inside, stage',
      'Plumbing · Top out: Inside, stage',
      'HVAC · Ductwork: Inside, stage',
      'HVAC · Rooftop units: Roof, name',
      'HVAC · Controls: Inside, stage',
      'Plumbing · Trim: Inside, stage',
      'HVAC · Test and balance: Inside, stage',
    ])
  })

  it('reads a floor or a suite from the name, the trade when the name says nothing, and whole words only', () => {
    expect(placeGuess('Framing and drywall', 'Framing, level 2')).toEqual({ place: 'Level 2', from: 'name' })
    expect(placeGuess('Painting', 'Suite 101 ceilings')).toEqual({ place: 'Suite 101', from: 'name' })
    expect(placeGuess('Glass and storefront', 'Interior storefront')).toEqual({ place: 'Inside', from: 'name' })
    expect(placeGuess('Roofing', 'Insulation')).toEqual({ place: 'Roof', from: 'trade' })
    expect(placeGuess('HVAC', 'Rooftop units')).toEqual({ place: 'Roof', from: 'name' })
    // "Composite" is no site, and the frame is the whole building: no guess.
    expect(placeGuess('Structural steel', 'Composite deck')).toBeNull()
    expect(placeGuess('Concrete', 'Slab on grade')).toBeNull()
  })
})

describe('the action', () => {
  it('keeps every guess in one press, and says so in the log', () => {
    const after = guessesKept()
    expect(after.log[0]?.text).toBe('Set places on 13 bars at Fair Oaks Shops, Building D.')
    expect(keptPlaces(job(after)).size).toBe(13)
    expect(job(after).schedule!.activities.find((a) => a.lineId === lineOf(after, 'Rooftop units'))?.place).toBe('Roof')
  })

  it('sets one place tidied, takes it off, and refuses what cannot take one', () => {
    const s0 = initialGcState()
    const topOut = lineOf(s0, 'Top out')
    const set = gcReducer(s0, placesOf({ [topOut]: '  Level   2 ' }))
    expect(job(set).schedule!.activities.find((a) => a.lineId === topOut)?.place).toBe('Level 2')
    expect(set.log[0]?.text).toBe('Set the place of Top out to Level 2.')
    // The same place again changes nothing.
    expect(gcReducer(set, placesOf({ [topOut]: 'Level 2' }))).toBe(set)
    for (const off of [null, '   ']) {
      const cleared = gcReducer(set, placesOf({ [topOut]: off }))
      expect('place' in job(cleared).schedule!.activities.find((a) => a.lineId === topOut)!).toBe(false)
      expect(cleared.log[0]?.text).toBe('Took the place off Top out.')
    }
    const refused: GcAction[] = [
      placesOf({ nope: 'Roof' }),
      placesOf({ 'fairoaksd-insp-roughin': 'Inside' }),
      placesOf({ [topOut]: 'x'.repeat(41) }),
      { type: 'setActivityPlaces', projectId: 'nowhere', places: { [topOut]: 'Inside' } },
      // One refused line refuses the whole press.
      placesOf({ [topOut]: 'Inside', nope: 'Roof' }),
    ]
    for (const action of refused) expect(gcReducer(s0, action)).toBe(s0)
  })

  it('sets the place on an open what-if copy too, and a move and its undo keep it', () => {
    const copy = play(initialGcState(), { type: 'startWhatIf', projectId: ID, by: 'Robert' })
    const topOut = lineOf(copy, 'Top out')
    const placed = gcReducer(copy, placesOf({ [topOut]: 'Inside' }))
    expect(job(placed).whatIf!.schedule.activities.find((a) => a.lineId === topOut)?.place).toBe('Inside')
    const a = job(placed).schedule!.activities.find((x) => x.lineId === topOut)!
    const moved = gcReducer(placed, { type: 'setScheduleActivity', projectId: ID, lineId: topOut, start: a.start, finish: '2026-10-12', after: a.after, why: { reason: 'crew', note: 'Two plumbers out this week.', by: 'Robert' } })
    expect(job(moved).schedule!.activities.find((x) => x.lineId === topOut)).toMatchObject({ finish: '2026-10-12', place: 'Inside' })
    const undone = gcReducer(moved, { type: 'undoScheduleMove', projectId: ID, moveId: job(moved).schedule!.moves![0]!.id, by: 'Robert' })
    expect(job(undone).schedule!.activities.find((x) => x.lineId === topOut)).toMatchObject({ finish: '2026-10-09', place: 'Inside' })
  })
})

describe('nothing is flagged until a place is kept', () => {
  it('leaves the chart, the card, the morning list, the call list and a move as they were', () => {
    const s = initialGcState()
    expect(crowdedWeeks(s, job(s))).toEqual([])
    expect(crowdedCalls(s, job(s))).toEqual([])
    expect(placesSummary(placeRows(s, job(s)), []).map((l) => l.words)).toEqual(['13 bars not done have a guessed place, and 1 has none.'])
    expect(morningCrowding(job(s), morningList(s, job(s), chartHolds(s, job(s))), s.today)).toEqual([])
    expect(callList(s, job(s), chartHolds(s, job(s))).people.flatMap((p) => p.reasons).some((r) => r.call?.kind === 'crowded')).toBe(false)
    const fire = job(s).schedule!.activities.find((a) => a.lineId === lineOf(s, 'Fire alarm'))!
    expect(crowdingAfterMove(s, job(s), planMove(job(s), fire.lineId, '2026-11-30', '2026-12-18')!.activities)).toEqual([])
  })
})

describe('the made-up job with its guesses kept', () => {
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
    expect([TRADES_IN_ONE_PLACE, PLACE_RULE]).toEqual([3, 'Our rule: 3 trades or more in one place on the same day is too many.'])
  })

  it('says up to 4 when a fourth trade is there only some of the days: Erection put inside', () => {
    const k = guessesKept()
    const s = gcReducer(k, placesOf({ [lineOf(k, 'Erection')]: 'Inside' }))
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
    for (const t of [...weeks.map((w) => w.words), ...calls.map((c) => c.text)]) expect([t, plainWordsFailures(t)]).toEqual([t, []])
  })

  it('reads a split line once, its parts sharing the line’s place (G-39)', () => {
    const k = guessesKept()
    const lighting = lineOf(k, 'Lighting')
    const s = gcReducer(k, { type: 'splitActivity', projectId: ID, lineId: lighting, parts: [{ name: 'Sales floor', start: '2026-09-14', finish: '2026-10-09' }, { name: 'Back of house', start: '2026-10-10', finish: '2026-10-23' }], by: 'Robert' })
    expect(job(s).schedule!.activities.find((a) => a.lineId === lighting)?.parts).toHaveLength(2)
    // The lane, the window's rows and the morning list read the line, not each part: Pecan Valley counts once.
    expect(crowdedWeeks(s, job(s))).toEqual(crowdedWeeks(k, job(k)))
    expect(placeRows(s, job(s)).filter((r) => r.lineId.startsWith(lighting))).toHaveLength(1)
    expect(morningCrowding(job(s), morningList(s, job(s), chartHolds(s, job(s))), s.today)).toEqual(['Inside has 3 trades at once today. They are Pecan Valley Electric, our own crew and Cool Breeze Mechanical.'])
  })

  it('counts a trade’s own number for the week first (G-142)', () => {
    const s = gcReducer(guessesKept(), { type: 'tradeSetCrewCount', projectId: ID, partnerId: 'coolbreeze', packageId: 'fhvac', weekOf: '2026-10-05', count: 5 })
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
    const list = morningList(s, job(s), chartHolds(s, job(s)))
    expect(morningCrowding(job(s), list, s.today)).toEqual(['Inside has 3 trades at once today. They are Pecan Valley Electric, our own crew and Cool Breeze Mechanical.'])
    expect(morningCrowding(job(s), morningList(s, job(s), chartHolds(s, job(s)), '2026-10-01'), s.today)).toEqual(['Inside has 3 trades at once on Thu Oct 1. They are Pecan Valley Electric, our own crew and Cool Breeze Mechanical.'])
    const held = { ...list, expected: list.expected.map((c) => (c.pkg.id !== 'fhvac' ? c : { ...c, bars: c.bars.map((b) => ({ ...b, held: true })) })) }
    expect(morningCrowding(job(s), held, s.today)).toEqual([])
  })

  it('puts a line on the call list for each hired company that has not given its count, never our own crew', () => {
    const s = guessesKept()
    const reasons = (st: GcState) => callList(st, job(st), chartHolds(st, job(st))).people.flatMap((p) => p.reasons.filter((r) => r.call?.kind === 'crowded').map((r) => [p.company, r.tone, r.text]))
    expect(reasons(s)).toEqual([
      ['Pecan Valley Electric', 'amber', 'Inside has 3 trades at once, Fri Oct 2 to Fri Oct 9. With them are our own crew and Cool Breeze Mechanical. They have not said how many people a day.'],
      ['Cool Breeze Mechanical', 'amber', 'Inside has 3 trades at once, Fri Oct 2 to Fri Oct 9. With them are Pecan Valley Electric and our own crew. They have not said how many people a day.'],
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
    // Pecan Valley gives this week's count: the line asks only for next week's. Both given: it goes.
    const one = gcReducer(s, { type: 'tradeSetCrewCount', projectId: ID, partnerId: 'pecanvalley', packageId: 'felec', weekOf: '2026-09-28', count: 2 })
    expect(reasons(one)[0]).toEqual(['Pecan Valley Electric', 'amber', 'Inside has 3 trades at once, Fri Oct 2 to Fri Oct 9. With them are our own crew and Cool Breeze Mechanical. They have not said how many people a day the week of Oct 5.'])
    const both = gcReducer(one, { type: 'tradeSetCrewCount', projectId: ID, partnerId: 'pecanvalley', packageId: 'felec', weekOf: '2026-10-05', count: 2 })
    expect(reasons(both).map((r) => r[0])).toEqual(['Cool Breeze Mechanical'])
  })

  it('says before a move saves when it crowds a place or clears one', () => {
    const s = guessesKept()
    const fire = lineOf(s, 'Fire alarm')
    expect(crowdingAfterMove(s, job(s), planMove(job(s), fire, '2026-11-30', '2026-12-18')!.activities)).toEqual([{ words: 'Too many in one place: Inside would have 3 trades at once, Mon Nov 30 to Fri Dec 4.', tone: 'amber' }])
    const topOut = lineOf(s, 'Top out')
    expect(crowdingAfterMove(s, job(s), planMove(job(s), topOut, '2026-10-10', '2026-10-21')!.activities)).toEqual([{ words: 'Too many in one place: this clears Inside, Fri Oct 2 to Fri Oct 9.', tone: 'green' }])
  })

  it('says every sentence in plain words', () => {
    const s = guessesKept()
    const weeks = crowdedWeeks(s, job(s))
    const fire = lineOf(s, 'Fire alarm')
    const texts = [
      PLACE_RULE,
      ...weeks.flatMap((w) => [w.words, ...w.rows.filter((r) => r.label !== 'Who').flatMap((r) => r.lines)]),
      ...placesSummary(placeRows(s, job(s)), weeks).map((l) => l.words),
      ...placesSummary(placeRows(initialGcState(), job(initialGcState())), []).map((l) => l.words),
      ...crowdedCalls(s, job(s)).flatMap((c) => [c.text, c.words.en.detail, c.words.en.ask]),
      ...morningCrowding(job(s), morningList(s, job(s), chartHolds(s, job(s))), s.today),
      ...crowdingAfterMove(s, job(s), planMove(job(s), fire, '2026-11-30', '2026-12-18')!.activities).map((c) => c.words),
      s.log[0]!.text,
    ]
    for (const t of texts) expect([t, plainWordsFailures(t)]).toEqual([t, []])
  })
})
