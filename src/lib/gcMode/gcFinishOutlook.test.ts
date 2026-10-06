import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import { daysBetween, projectedFinish, scheduleMeasures } from './gcBuildingSchedule'
import { TIGHT_SPARE_DAYS } from './gcGantt'
import { chartHolds } from './gcChartHolds'
import { callList, callListFollowPeople } from './gcCallList'
import { followUpDraft } from './gcFollowUpSheet'
import { customerSchedulePicture } from './gcCustomerSchedule'
import { addDays } from './gcBuilding'
import type { GcState } from './gcTypes'
import { finishOutlook, LOG_MONTH_DAYS, shortCrewDetail, shortCrewReason, WEATHER_DAYS_A_MONTH } from './gcFinishOutlook'

const ID = 'fairoaksd'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
const outlookOf = (s: GcState) => finishOutlook(s, job(s))!

/** Our superintendent's log for a day, through the reducer. */
function logDay(s: GcState, date: string, crews: Record<string, number>, weather?: { packageId: string; note: string }): GcState {
  return gcReducer(s, {
    type: 'saveDailyLog',
    projectId: ID,
    log: {
      date,
      sky: weather ? 'rain' : 'clear',
      high: 78,
      low: 61,
      weatherStop: false,
      crews: Object.entries(crews).map(([packageId, workers]) => ({ packageId, workers })),
      done: 'Work went on.',
      delays: weather ? [{ packageId: weather.packageId, reason: 'weather', note: weather.note }] : [],
      visitors: '',
    },
  })
}

/** Today's log, Fri Oct 2, with every trade at its crew so far but Cool Breeze Mechanical's HVAC. */
const hvacToday = (workers: number, s = initialGcState()) => logDay(s, s.today, { fsteel: 4, froof: 5, felec: 3, fplumb: 3, fhvac: workers })

/** A trade's own count for a week, from its portal (G-142). */
function says(s: GcState, company: string, packageId: string, weekOf: string, count: number): GcState {
  const partnerId = s.partners.find((p) => p.company === company)!.id
  return gcReducer(s, { type: 'tradeSetCrewCount', projectId: ID, partnerId, packageId, weekOf, count })
}

/** The call list's crew lines (G-57's pick 2). */
const crewCalls = (s: GcState) =>
  callList(s, job(s), chartHolds(s, job(s))).people.flatMap((p) => p.reasons.filter((r) => r.call?.kind === 'crew').map((r) => ({ company: p.company, text: r.text, tone: r.tone })))

describe('the projected finish with weather and crews on the fixture (Fair Oaks D, Fri Oct 2)', () => {
  it('holds the same day: our rule on roofing and electrical, and three short crews their spare days cover', () => {
    const s = initialGcState()
    const o = outlookOf(s)
    expect(o.words).toEqual({
      line: 'With weather and crews: Fri Dec 11, the same day.',
      weather: 'Weather adds no days. Our rule, 2 a month on roofing and electrical, fits inside their spare days.',
      crews: 'Crews add no days. Three trades have fewer on site than so far, and their spare days cover it.',
    })
    expect(o.finish).toBe('2026-12-11')
    expect(o.days).toBe(0)
    // Roofing and electrical are the trades the log saw the weather stop (G-58), not a guess from the trade.
    expect(o.weather).toEqual({ rate: WEATHER_DAYS_A_MONTH, fromLog: false, trades: ['roofing', 'electrical'], days: 0 })
    expect(o.crews.short.map((c) => [c.company, c.now, c.soFar, c.days])).toEqual([
      ['Iron Horse Fabrication', 3, 4, 0],
      ['Summit Roofing', 4, 5, 0],
      ['Pecan Valley Electric', 2, 3, 0],
    ])
    expect(o.crews.nobody).toEqual([])
    // Nothing to call about: every short crew fits in its spare days.
    expect(crewCalls(s)).toEqual([])
  })

  it('is for a job being built with a schedule only', () => {
    const s = initialGcState()
    for (const p of s.projects.filter((x) => x.stage !== 'building')) expect(finishOutlook(s, p)).toBeNull()
  })
})

describe('a short crew on the red chain (pick 2)', () => {
  it('moves the second line, and the trade is on the call list with the same days', () => {
    const s = hvacToday(1)
    // Test and balance, Cool Breeze's last bar, has 2 spare days: it is on the red chain.
    expect(scheduleMeasures(s, job(s)).float.get('fhvac-4')).toBeLessThanOrEqual(TIGHT_SPARE_DAYS)
    const o = outlookOf(s)
    expect(o.words).toEqual({
      line: 'With weather and crews: Thu Dec 31, 20 days later.',
      weather: 'Weather adds 1 day: our rule, 2 a month, on the work left of roofing and electrical.',
      crews: 'Crews add 19 days: Cool Breeze Mechanical has 1 on site against 3 so far.',
    })
    expect(o.pace.on).toBe('2026-12-11')
    expect(o.finish).toBe(addDays(o.pace.on, o.days))
    // Weather falls on the longer work: its days are on top of the crews', and the two add up to the line.
    expect(o.weather.days + o.crews.days).toBe(o.days)
    expect(o.crews.short).toHaveLength(1)
    const hvac = o.crews.short[0]!
    expect(hvac).toMatchObject({ company: 'Cool Breeze Mechanical', now: 1, soFar: 3, said: null, days: 19, finish: '2026-12-30', lineId: 'fhvac-2' })
    // The same trade with the same days on the call list, amber: a call can change it today.
    expect(crewCalls(s)).toEqual([{ company: 'Cool Breeze Mechanical', text: 'They have 1 on site this week against 3 so far. At that, the job finishes 19 days later, Wed Dec 30.', tone: 'amber' }])
    expect(hvac.days).toBe(o.crews.days)
    // On the Follow up sheet it is a message about their crew.
    const cool = callListFollowPeople(s, job(s), chartHolds(s, job(s))).find((p) => p.partner.company === 'Cool Breeze Mechanical')!
    const item = cool.items.find((i) => i.schedule?.kind === 'crew')!
    expect(item).toMatchObject({ label: 'Crew on site · Fair Oaks Shops, Building D', due: true, tone: 'amber', schedule: { kind: 'crew', lineId: 'fhvac-2', packageId: 'fhvac' } })
    expect(followUpDraft(cool, [item], { from: 'me', via: 'text', length: 'nudge' }, 'Robert Douglas').body).toContain(
      'Just checking on your crew on Fair Oaks Shops, Building D. You have 1 on site this week, against 3 a day so far. Can you bring it back up to size?',
    )
  })

  it('two against three on the same bars fits in their spare days: no days, no call', () => {
    const s = hvacToday(2)
    const o = outlookOf(s)
    expect(o.days).toBe(0)
    expect(o.words.crews).toBe('Crews add no days. One trade has fewer on site than so far, and its spare days cover it.')
    expect(crewCalls(s)).toEqual([])
  })
})

describe('the crew now', () => {
  it('a told count for the week the work falls in outranks the newest logged day', () => {
    // The log's newest day has Cool Breeze at 3, its crew so far: not short.
    const base = initialGcState()
    expect(outlookOf(base).crews.short.some((c) => c.packageId === 'fhvac')).toBe(false)
    // Their own word for the week of Oct 12, when Rooftop units start, through the default: 1 a day.
    const s = says(base, 'Cool Breeze Mechanical', 'fhvac', '2026-10-12', 1)
    const hvac = outlookOf(s).crews.short.find((c) => c.packageId === 'fhvac')!
    expect(hvac).toMatchObject({ now: 1, soFar: 3, said: '2026-10-12', lineId: 'fhvac-1' })
    expect(shortCrewReason(hvac, s.today)).toMatch(/^They said 1 a day the week of Oct 12 against 3 so far\. /)
    expect(shortCrewDetail(hvac, s.today)).toBe('You told us 1 a day the week of Oct 12, against 3 a day so far')
    // The other way round: the log has 1 today, but they said 3 for this week. Their word counts.
    const o = outlookOf(says(hvacToday(1), 'Cool Breeze Mechanical', 'fhvac', '2026-09-28', 3))
    expect(o.crews.short).toEqual([])
    expect(o.days).toBe(0)
  })

  it('a trade with all its work ahead is not here yet: last week’s log does not make it short', () => {
    // The TPO membrane moves out a month: Summit Roofing has nothing under way, though the log had 4 against 5.
    const s0 = initialGcState()
    const a = job(s0).schedule!.activities.find((x) => x.lineId === 'froof-1')!
    const s = gcReducer(s0, { type: 'setScheduleActivity', projectId: ID, lineId: a.lineId, start: addDays(a.start, 30), finish: addDays(a.finish, 30), after: a.after, why: { reason: 'customer', note: 'The owner changed the roof color.', by: 'Robert' } })
    const o = outlookOf(s)
    expect(o.crews.short.map((c) => c.company)).toEqual(['Iron Horse Fabrication', 'Pecan Valley Electric'])
    expect(o.crews.nobody).toEqual([])
    expect(crewCalls(s)).toEqual([])
    // Their own count for the week Roof curbs start still counts.
    const said = outlookOf(says(s, 'Summit Roofing', 'froof', '2026-10-05', 2)).crews.short.find((c) => c.packageId === 'froof')
    expect(said).toMatchObject({ now: 2, soFar: 5, said: '2026-10-05', lineId: 'froof-4' })
  })

  it('a bigger crew is not counted on: the line never comes earlier', () => {
    const o = outlookOf(hvacToday(6))
    expect(o.finish).toBe(o.pace.on)
    expect(o.words.crews).toBe('Crews add no days: no trade has fewer on site than so far.')
  })

  it('nobody on site this week is said by name and not stretched', () => {
    // Summit Roofing says nobody this week, with the TPO membrane half done.
    const o = outlookOf(says(initialGcState(), 'Summit Roofing', 'froof', '2026-09-28', 0))
    expect(o.crews.nobody).toEqual(['Summit Roofing'])
    expect(o.crews.short.map((c) => c.company)).toEqual(['Iron Horse Fabrication', 'Pecan Valley Electric'])
    expect(o.words.crews).toBe('Crews add no days. Two trades have fewer on site than so far, and their spare days cover it. Summit Roofing has nobody on site this week.')
  })
})

describe('the weather rule', () => {
  it('is ours until the log covers a month, then the log’s own: 3 weather days in 29 is 3 a month', () => {
    let s = logDay(initialGcState(), '2026-09-03', {})
    s = logDay(s, '2026-09-15', { fhvac: 3 }, { packageId: 'fhvac', note: 'Rain on the ductwork.' })
    expect(daysBetween('2026-09-03', '2026-10-01') + 1).toBeGreaterThanOrEqual(LOG_MONTH_DAYS)
    const o = outlookOf(s)
    expect(o.weather).toEqual({ rate: 3, fromLog: true, trades: ['roofing', 'electrical', 'HVAC'], days: 0 })
    expect(o.words.weather).toBe("Weather adds no days. The log's 3 a month on roofing, electrical and HVAC fits inside their spare days.")
    // A short HVAC crew on top: the weather falls on longer work, and the sentences still add up.
    const short = outlookOf(hvacToday(1, s))
    expect(short.words).toEqual({
      line: 'With weather and crews: Thu Jan 7, 27 days later.',
      weather: 'Weather adds 8 days: 3 a month from the log, on the work left of roofing, electrical and HVAC.',
      crews: 'Crews add 19 days: Cool Breeze Mechanical has 1 on site against 3 so far.',
    })
    expect(short.weather.days + short.crews.days).toBe(short.days)
  })

  it('no weather in the log adds none and says so; no log at all says so for the crews too', () => {
    const s0 = initialGcState()
    const dry: GcState = { ...s0, projects: s0.projects.map((p) => (p.id !== ID ? p : { ...p, dailyLogs: (p.dailyLogs ?? []).map((l) => ({ ...l, weatherStop: false, delays: l.delays.filter((d) => d.reason !== 'weather') })) })) }
    const o = outlookOf(dry)
    expect(o.weather).toEqual({ rate: WEATHER_DAYS_A_MONTH, fromLog: false, trades: [], days: 0 })
    expect(o.words.weather).toBe('Weather adds no days: the log has no weather yet.')
    const none: GcState = { ...s0, projects: s0.projects.map((p) => (p.id !== ID ? p : { ...p, dailyLogs: [] })) }
    expect(outlookOf(none).words).toEqual({
      line: 'With weather and crews: Fri Dec 11, the same day.',
      weather: 'Weather adds no days: the log has no weather yet.',
      crews: 'Crews add no days: the log has no crews yet.',
    })
  })
})

describe('the second line', () => {
  const cases = () => [initialGcState(), hvacToday(1), hvacToday(2), hvacToday(6), says(initialGcState(), 'Cool Breeze Mechanical', 'fhvac', '2026-09-28', 1), says(initialGcState(), 'Summit Roofing', 'froof', '2026-09-28', 0)]

  it('never comes before the pace line, and leaves the pace line as it is', () => {
    for (const s of cases()) {
      const o = outlookOf(s)
      expect(o.finish >= o.pace.on).toBe(true)
      expect(o.pace).toEqual(scheduleMeasures(s, job(s)).finish)
      // No days more is the measure's own projection.
      expect(projectedFinish(job(s), s.today, new Map())).toEqual(o.pace)
    }
  })

  it('says every line in plain words, and none of it reaches the customer', () => {
    for (const s of cases()) {
      const o = outlookOf(s)
      for (const line of Object.values(o.words)) expect(plainWordsFailures(line)).toEqual([])
      for (const c of o.crews.short) expect(plainWordsFailures(shortCrewReason(c, s.today))).toEqual([])
      const customer = JSON.stringify(customerSchedulePicture(s, job(s)))
      for (const line of Object.values(o.words)) expect(customer).not.toContain(line)
      expect(customer).not.toContain('weather and crews')
    }
  })
})
