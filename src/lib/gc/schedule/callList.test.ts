/**
 * The tests of `gcCallList.test.ts` on branch spike/gc-mode that read only the call list's kernels and the made-up data,
 * moved word for word (the schedule's PR 7c-i). The data is `testState.ts`. The tests that play the prototype's reducer
 * or read the Follow up sheet stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { addDays } from '../building'
import { rfiRows } from '../buildingRfis'
import { submittalHolding, submittalNeededBy } from '../buildingSubmittals'
import type { CallPerson } from './callList'
import { callList, callListFollowPeople, callListTitle } from './callList'
import type { GanttHold } from './gantt'
import { withNotReady } from './notReady'
import { scheduleMeasures } from './schedule'
import { initialGcState } from './testState'
import { waitHolds } from './waits'
import type { GcProject, GcState } from '../types'

const ID = 'fairoaksd'

const job = (s: GcState) => s.projects.find((p) => p.id === ID)!

/** The chart's holds the way the Schedule tab draws them (`holdsOf` in GcBuildingSchedule.tsx, then G-77's `withNotReady`). */
function holdsOf(state: GcState, project: GcProject): Map<string, GanttHold> {
  const holds = new Map<string, GanttHold>()
  for (const r of rfiRows(state, project)) {
    if (r.state === 'answered') continue
    for (const h of r.holds) holds.set(h.lineId, { kind: 'rfi', words: `${r.label}, ${r.stateWords}`, late: r.late })
  }
  for (const a of project.schedule?.activities ?? []) {
    const s = submittalHolding(project, a.lineId)
    if (!s) continue
    const needed = submittalNeededBy(project, s)
    holds.set(a.lineId, { kind: 'submittal', words: `submittal ${s.number}`, late: needed !== null && needed < state.today })
  }
  for (const [lineId, hold] of waitHolds(state, project)) if (!holds.has(lineId)) holds.set(lineId, hold)
  return withNotReady(holds, state, project)
}

const listOf = (state: GcState) => callList(state, job(state), holdsOf(state, job(state)))

const person = (state: GcState, company: string): CallPerson | undefined => listOf(state).people.find((p) => p.company === company)

const texts = (p: CallPerson | undefined) => (p?.reasons ?? []).map((r) => `${r.aside ? '○' : '●'} ${r.tone} ${r.text}`)

const lineOf = (state: GcState, label: string) => scheduleMeasures(state, job(state)).items.find((i) => i.label === label)!.activity.lineId

/** Cool Breeze has not set foot on the job: nothing reported, nobody on the daily log, its work `shift` days later. */
function breezeNotStarted(shift: number): GcState {
  const state = structuredClone(initialGcState())
  const p = job(state)
  const pkg = p.packages.find((k) => k.trade === 'HVAC')!
  for (const l of pkg.sow?.sov ?? []) l.pctReported = 0
  for (const log of p.dailyLogs ?? []) log.crews = log.crews.filter((c) => c.packageId !== pkg.id)
  for (const a of p.schedule?.activities ?? []) if (a.packageId === pkg.id) Object.assign(a, { start: addDays(a.start, shift), finish: addDays(a.finish, shift) })
  return state
}

describe('the call list on the fixture (Fair Oaks D, Fri Oct 2)', () => {
  it('has everyone whose answer moves the chart, worst first', () => {
    const list = listOf(initialGcState())
    expect(list.people.map((p) => p.company)).toEqual(['Pecan Valley Electric', 'Cool Breeze Mechanical', 'Iron Horse Fabrication', 'Summit Roofing', 'Marsh & Vale Architects'])
    expect(list.people.map((p) => p.tone)).toEqual(['red', 'red', 'amber', 'amber', 'grey'])
    expect([list.count, list.late, list.tone]).toEqual([5, 2, 'red'])
    expect(callListTitle(list)).toBe('5 to call about the schedule')
  })

  it('puts every reason under the name: the bars, what holds them, and what Follow up already has on this job', () => {
    const s = initialGcState()
    expect(texts(person(s, 'Pecan Valley Electric'))).toEqual([
      '● red Electrical service inspection failed Mon Sep 28. The city sees it again today. What failed: “The main bonding jumper is missing at the service panel.”',
      // The counts (2026-10-06): at work uncovered, in G-138's words.
      '● red Their insurance ran out Tue Sep 15. Nothing they do for us is covered. They are at work on Panels and feeders, and Lighting.',
      '● amber Panels and feeders is due today and 80% done.',
      '● amber Lighting is behind: 40% done against 48% in the plan. It is due Fri Oct 23.',
      // G-77: a trade whose insurance ran out is not ready to start its next bars.
      '● amber Fire alarm waits on current insurance.',
      '● amber Site lighting waits on current insurance.',
      '● amber The unconditional waiver on draw 1 has not come.',
      '○ grey Fire alarm waits on submittal 28 31 11-01. It is with the architect.',
    ])
    expect(texts(person(s, 'Cool Breeze Mechanical'))).toEqual([
      '● red Rooftop units waits on its delivery, expected Tue Oct 20 from their supplier. That is 8 days after it starts.',
      '● grey Controls waits on their submittal 23 09 23-01, needed by Fri Oct 23.',
      '○ grey Rooftop units waits on RFI-003. It is with the architect.',
    ])
    expect(texts(person(s, 'Iron Horse Fabrication'))).toEqual(['● amber Erection is due today and 80% done.'])
    expect(texts(person(s, 'Summit Roofing'))).toEqual([
      '● amber TPO membrane is behind: 50% done against 100% in the plan. It is due Fri Oct 9.',
      '○ grey Roof curbs waits on RFI-004. It is with us, needed today.',
      '○ grey Sheet metal and flashing waits on submittal 07 62 00-01. It is with us to review, needed today.',
    ])
    // Held work goes to whoever holds it: the architect has two calls to make the chart move.
    expect(texts(person(s, 'Marsh & Vale Architects'))).toEqual([
      '● grey RFI-003 holds Rooftop units, which starts Mon Oct 12. The answer is needed by Fri Oct 9.',
      '● grey Submittal 28 31 11-01 holds Fire alarm, which starts Mon Nov 2. It is needed back by Mon Oct 19.',
    ])
  })

  it('leaves off whoever has nothing to answer: the city, our own crew, finished trades, a decision not holding work yet', () => {
    const companies = listOf(initialGcState()).people.map((p) => p.company)
    for (const nobody of ['The city', 'Our own crew', 'Tri-County Site', 'Guadalupe Flatwork', 'Cibolo Creek Partners']) expect(companies).not.toContain(nobody)
  })

  it('a reason about a bar carries the bar, so pressing it opens that bar', () => {
    const s = initialGcState()
    const pecan = person(s, 'Pecan Valley Electric')!
    expect(pecan.reasons.find((r) => r.text.startsWith('Lighting'))?.lineId).toBe(lineOf(s, 'Lighting'))
    expect(pecan.reasons.find((r) => r.text.startsWith('Electrical service'))?.lineId).toBe('fairoaksd-insp-service')
    expect(pecan.reasons.find((r) => r.text.startsWith('Their insurance'))?.lineId).toBeUndefined()
  })

  it('has no list on a job not being built', () => {
    const s = initialGcState()
    for (const p of s.projects.filter((x) => x.stage !== 'building')) expect(callList(s, p, new Map()).count).toBe(0)
    expect(callListTitle(callList(s, s.projects.find((x) => x.stage !== 'building')!, new Map()))).toBe('Nobody to call about the schedule.')
  })
})

describe('any hold on a bar reaches whoever owes it', () => {
  it('a kind the list does not know goes to the trade doing the bar, worded as the chart words it', () => {
    const s = initialGcState()
    const holds = holdsOf(s, job(s))
    const tab = lineOf(s, 'Test and balance')
    holds.set(tab, { kind: 'crane' as GanttHold['kind'], words: 'the crane, booked for Oct 30', late: true })
    const breeze = callList(s, job(s), holds).people.find((p) => p.company === 'Cool Breeze Mechanical')!
    const r = breeze.reasons.find((x) => x.lineId === tab)!
    expect([r.tone, r.text, r.call?.kind, r.call?.hold]).toEqual(['red', 'Test and balance waits on the crane, booked for Oct 30.', 'held', 'crane'])
  })

  it('G-77’s paperwork names the trade’s papers, and the hold it folds in still reaches its own owner', () => {
    const s = initialGcState()
    const fireAlarm = lineOf(s, 'Fire alarm')
    // The chart folds both into one pill on the bar.
    expect(holdsOf(s, job(s)).get(fireAlarm)).toEqual({ kind: 'paperwork', words: 'current insurance and submittal 28 31 11-01', late: false })
    const pecan = person(s, 'Pecan Valley Electric')!
    expect(pecan.reasons.filter((r) => r.lineId === fireAlarm).map((r) => `${r.aside ? '○' : '●'} ${r.text}`)).toEqual([
      '● Fire alarm waits on current insurance.',
      '○ Fire alarm waits on submittal 28 31 11-01. It is with the architect.',
    ])
    expect(person(s, 'Marsh & Vale Architects')!.reasons.some((r) => r.lineId === fireAlarm && r.text.startsWith('Submittal 28 31 11-01 holds Fire alarm'))).toBe(true)
  })

  it('a late wait under a submittal or an RFI still reaches its owner: the delivery is Cool Breeze’s though RFI-003 has the bar', () => {
    const s = initialGcState()
    const rooftop = lineOf(s, 'Rooftop units')
    expect(holdsOf(s, job(s)).get(rooftop)?.kind).toBe('rfi')
    const breeze = person(s, 'Cool Breeze Mechanical')!
    expect(breeze.reasons.find((r) => r.call?.hold === 'delivery')?.lineId).toBe(rooftop)
  })
})

describe('a first day on site nobody confirmed (the office half of G-114)', () => {
  it('asks while it is coming, and reads late once it passed with nobody on the log', () => {
    const coming = person(breezeNotStarted(25), 'Cool Breeze Mechanical')!.reasons.find((r) => r.call?.kind === 'start')!
    expect([coming.tone, coming.text]).toEqual(['amber', 'Their first day on site is Fri Oct 9. They have not said their crew will be there.'])
    const passed = person(breezeNotStarted(0), 'Cool Breeze Mechanical')!.reasons.find((r) => r.call?.kind === 'start')!
    expect([passed.tone, passed.text]).toEqual(['red', 'Their first day on site was Mon Sep 14. Nobody from them is on the daily log yet.'])
  })
})

describe('the Follow up sheet walks the same list', () => {
  it('this job’s Follow up items first, then one item for each reason from the schedule, ticked when red or amber', () => {
    const s = initialGcState()
    const people = callListFollowPeople(s, job(s), holdsOf(s, job(s)))
    expect(people.map((p) => p.partner.id)).toEqual(['pecanvalley', 'coolbreeze', 'ironhorse', 'summit', 'customer:marshvale'])
    const pecan = people[0]!
    expect(pecan.items.map((i) => `${i.kind}${i.due ? '*' : ''} ${i.label}`)).toEqual([
      'insurance* Insurance certificate',
      'waiver* Unconditional waiver · draw 1, Fair Oaks Shops, Building D',
      'schedule* Electrical service inspection · Fair Oaks Shops, Building D',
      'schedule* Panels and feeders · Fair Oaks Shops, Building D',
      'schedule* Lighting · Fair Oaks Shops, Building D',
      'schedule* Fire alarm · Fair Oaks Shops, Building D',
      'schedule* Site lighting · Fair Oaks Shops, Building D',
    ])
    const architect = people[4]!
    expect(architect.items.map((i) => `${i.due ? '*' : ''}${i.label}`)).toEqual(['RFI-003 · Fair Oaks Shops, Building D', 'Submittal 28 31 11-01 · Fair Oaks Shops, Building D'])
    for (const p of people) for (const i of p.items.filter((x) => x.kind === 'schedule')) for (const lang of ['en', 'es'] as const) expect(Object.values(i.words[lang]).every((w) => w.length > 0)).toBe(true)
  })
})
