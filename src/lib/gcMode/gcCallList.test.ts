import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import { addDays } from './gcBuilding'
import type { GcProject, GcState } from './gcTypes'
import { scheduleMeasures } from './gcBuildingSchedule'
import { weekdayDate } from './gcWords'
import type { GanttHold } from './gcGantt'
import { rfiRows } from './gcBuildingRfis'
import { submittalHolding, submittalNeededBy } from './gcBuildingSubmittals'
import { waitHolds } from './gcScheduleWaits'
import { followUpDraft } from './gcFollowUpSheet'
import { barCaller, callList, callListCallActions, callListFollowPeople, callListTitle, type CallPerson } from './gcCallList'

const ID = 'fairoaksd'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!

/** The chart's holds the way the Schedule tab draws them (`holdsOf` in GcBuildingSchedule.tsx). */
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
  return holds
}

const listOf = (state: GcState) => callList(state, job(state), holdsOf(state, job(state)))
const person = (state: GcState, company: string): CallPerson | undefined => listOf(state).people.find((p) => p.company === company)
const texts = (p: CallPerson | undefined) => (p?.reasons ?? []).map((r) => `${r.aside ? '○' : '●'} ${r.tone} ${r.text}`)
const lineOf = (state: GcState, label: string) => scheduleMeasures(state, job(state)).items.find((i) => i.label === label)!.activity.lineId
/** Without what a person quotes: the inspector's words and the trade's are kept as written. */
const ownWords = (text: string) => text.replace(/“[^”]*”/g, '').trim()

/** The roof moved for the rain: a month pushes Sheet metal (Summit) and the rooftop units (Cool Breeze). */
function roofMoved(by = 30, state = initialGcState()) {
  const tpo = job(state).schedule!.activities.find((a) => a.lineId === lineOf(state, 'TPO membrane'))!
  const moved = gcReducer(state, { type: 'setScheduleActivity', projectId: ID, lineId: tpo.lineId, start: addDays(tpo.start, by), finish: addDays(tpo.finish, by), after: tpo.after, why: { reason: 'weather', note: 'Rain stopped the roof for a week.', by: 'Robert' } })
  const move = job(moved).schedule!.moves![0]!
  return { moved, move, summit: moved.partners.find((p) => p.company === 'Summit Roofing')! }
}

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
      '● red Their insurance ran out Sep 15.',
      '● amber Panels and feeders is due today and 80% done.',
      '● amber Lighting is behind: 40% done against 48% in the plan. It is due Fri Oct 23.',
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

  it('says every line in plain words', () => {
    for (const p of listOf(initialGcState()).people) for (const r of p.reasons) expect(plainWordsFailures(ownWords(r.text))).toEqual([])
  })

  it('has no list on a job not being built', () => {
    const s = initialGcState()
    for (const p of s.projects.filter((x) => x.stage !== 'building')) expect(callList(s, p, new Map()).count).toBe(0)
    expect(callListTitle(callList(s, s.projects.find((x) => x.stage !== 'building')!, new Map()))).toBe('Nobody to call about the schedule.')
  })
})

describe('any hold on a bar reaches whoever owes it', () => {
  it('a kind the chart adds later goes to the trade doing the bar, worded as the chart words it (G-77)', () => {
    const s = initialGcState()
    const holds = holdsOf(s, job(s))
    const tab = lineOf(s, 'Test and balance')
    holds.set(tab, { kind: 'paperwork' as GanttHold['kind'], words: 'current insurance, theirs ran out Sep 15', late: true })
    const breeze = callList(s, job(s), holds).people.find((p) => p.company === 'Cool Breeze Mechanical')!
    const r = breeze.reasons.find((x) => x.lineId === tab)!
    expect([r.tone, r.text, r.call?.kind, r.call?.hold]).toEqual(['red', 'Test and balance waits on current insurance, theirs ran out Sep 15.', 'held', 'paperwork'])
  })

  it('a late wait under a submittal or an RFI still reaches its owner: the delivery is Cool Breeze’s though RFI-003 has the bar', () => {
    const s = initialGcState()
    const rooftop = lineOf(s, 'Rooftop units')
    expect(holdsOf(s, job(s)).get(rooftop)?.kind).toBe('rfi')
    const breeze = person(s, 'Cool Breeze Mechanical')!
    expect(breeze.reasons.find((r) => r.call?.hold === 'delivery')?.lineId).toBe(rooftop)
  })
})

describe('new dates nobody answered (G-113)', () => {
  it('a move not told yet is an aside: the caller should know, Tell the trades does the telling', () => {
    // Three days: the membrane is still under way and behind, so Summit stays on the list for it.
    const { moved } = roofMoved(3)
    const summit = person(moved, 'Summit Roofing')!
    const aside = summit.reasons.find((r) => r.aside && r.text.startsWith('New dates for TPO membrane'))
    expect(aside?.text).toMatch(/are not sent yet\. Tell the trades sends them\.$/)
    // A month: the membrane has not started, so nothing is Summit's to answer and the aside alone puts nobody on the list.
    expect(person(roofMoved(30).moved, 'Summit Roofing')).toBeUndefined()
  })

  it('told and not answered is a reason: grey while they have time, amber from three days, red with the new start three days off', () => {
    const { moved, move } = roofMoved()
    const told = gcReducer(moved, { type: 'tellTradesMoves', projectId: ID, moveIds: [move.id], by: 'Robert' })
    const line = (s: GcState) => person(s, 'Summit Roofing')?.reasons.find((r) => r.call?.kind === 'dates')
    expect(line(told)?.text).toBe('New dates for TPO membrane and Sheet metal and flashing went out Fri Oct 2. No answer yet.')
    expect(line(told)?.tone).toBe('grey')
    expect(line({ ...told, today: '2026-10-05' })?.tone).toBe('amber')
    expect(line({ ...told, today: '2026-10-19' })?.tone).toBe('red')
    // Cool Breeze was told too: its rooftop units moved with the roof.
    expect(person(told, 'Cool Breeze Mechanical')?.reasons.some((r) => r.call?.kind === 'dates')).toBe(true)
  })

  it('their yes clears it; another day turns it into Follow up’s own ask until the bar moves again', () => {
    const { moved, move, summit } = roofMoved()
    const told = gcReducer(moved, { type: 'tellTradesMoves', projectId: ID, moveIds: [move.id], by: 'Robert' })
    const yes = gcReducer(told, { type: 'tradeAnswerDates', projectId: ID, partnerId: summit.id, moveId: move.id, ok: true })
    expect((person(yes, 'Summit Roofing')?.reasons ?? []).some((r) => r.call?.kind === 'dates')).toBe(false)
    const no = gcReducer(told, { type: 'tradeAnswerDates', projectId: ID, partnerId: summit.id, moveId: move.id, ok: false, day: '2026-11-09', note: 'Crew is on another job.' })
    const reasons = person(no, 'Summit Roofing')!.reasons
    expect(reasons.some((r) => r.call?.kind === 'dates')).toBe(false)
    const asked = reasons.find((r) => r.call?.kind === 'asked')!
    expect([asked.tone, asked.text, asked.lineId]).toEqual(['amber', 'Asked for Mon Nov 9 on TPO membrane after we moved it: “Crew is on another job.”', lineOf(no, 'TPO membrane')])
    // Follow up has the same ask: said once.
    expect(reasons.filter((r) => r.text.startsWith('Asked for Mon Nov 9')).length).toBe(1)
  })
})

describe('a first day on site nobody confirmed (the office half of G-114)', () => {
  it('asks while it is coming, and reads late once it passed with nobody on the log', () => {
    const coming = person(breezeNotStarted(25), 'Cool Breeze Mechanical')!.reasons.find((r) => r.call?.kind === 'start')!
    expect([coming.tone, coming.text]).toEqual(['amber', 'Their first day on site is Fri Oct 9. They have not said their crew will be there.'])
    const passed = person(breezeNotStarted(0), 'Cool Breeze Mechanical')!.reasons.find((r) => r.call?.kind === 'start')!
    expect([passed.tone, passed.text]).toEqual(['red', 'Their first day on site was Mon Sep 14. Nobody from them is on the daily log yet.'])
  })

  it('their word on the day takes it off', () => {
    const s = breezeNotStarted(25)
    const breeze = s.partners.find((p) => p.company === 'Cool Breeze Mechanical')!
    const pkg = job(s).packages.find((k) => k.trade === 'HVAC')!
    const promised = gcReducer(s, { type: 'recordPromise', partnerId: breeze.id, kind: 'start', projectId: ID, packageId: pkg.id, by: '2026-10-09', from: 'office' })
    expect(person(promised, 'Cool Breeze Mechanical')?.reasons.some((r) => r.call?.kind === 'start')).toBe(false)
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
    ])
    const architect = people[4]!
    expect(architect.items.map((i) => `${i.due ? '*' : ''}${i.label}`)).toEqual(['RFI-003 · Fair Oaks Shops, Building D', 'Submittal 28 31 11-01 · Fair Oaks Shops, Building D'])
    for (const p of people) for (const i of p.items.filter((x) => x.kind === 'schedule')) for (const lang of ['en', 'es'] as const) expect(Object.values(i.words[lang]).every((w) => w.length > 0)).toBe(true)
  })

  it('drafts a message that names the bar, in their language', () => {
    const s = initialGcState()
    const summit = callListFollowPeople(s, job(s), holdsOf(s, job(s))).find((p) => p.partner.company === 'Summit Roofing')!
    const en = followUpDraft(summit, summit.items, { from: 'me', via: 'text', length: 'nudge' }, 'Robert Douglas')
    expect(en.body).toBe("Hi Carla, it's Robert at Click. Just checking on your roofing TPO membrane on Fair Oaks Shops, Building D. It is 50% done, and our plan had 100% by today. When will it be done? Thanks!")
    // A line's name reads inside the sentence with its trade: never "your Erection".
    const steel = callListFollowPeople(s, job(s), holdsOf(s, job(s))).find((p) => p.partner.company === 'Iron Horse Fabrication')!
    expect(steel.items[0]?.words.en.about).toBe('your structural steel erection on Fair Oaks Shops, Building D')
    const es = followUpDraft({ ...summit, partner: { ...summit.partner, lang: 'es' } }, summit.items, { from: 'me', via: 'text', length: 'nudge' }, 'Robert Douglas')
    expect(es.body).toContain('su trabajo de TPO membrane en Fair Oaks Shops, Building D. Va en 50% y nuestro plan tenía 100% para hoy. ¿Para cuándo estará terminado?')
  })

  it('an opened bar’s company joins the sheet with that bar when nothing else puts it on the list', () => {
    // The roof moved a month and Summit said yes: nothing is Summit's to answer.
    const { moved, move, summit: roofer } = roofMoved()
    const told = gcReducer(moved, { type: 'tellTradesMoves', projectId: ID, moveIds: [move.id], by: 'Robert' })
    const s = gcReducer(told, { type: 'tradeAnswerDates', projectId: ID, partnerId: roofer.id, moveId: move.id, ok: true })
    const holds = holdsOf(s, job(s))
    expect(callListFollowPeople(s, job(s), holds).some((p) => p.partner.company === 'Summit Roofing')).toBe(false)
    const sheetMetal = lineOf(s, 'Sheet metal and flashing')
    const starts = job(s).schedule!.activities.find((a) => a.lineId === sheetMetal)!.start
    const summit = callListFollowPeople(s, job(s), holds, sheetMetal).find((p) => p.partner.company === 'Summit Roofing')!
    expect(summit.items.map((i) => `${i.due ? '*' : ''}${i.label}: ${i.why}`)).toEqual([`*Sheet metal and flashing · Fair Oaks Shops, Building D: Sheet metal and flashing starts ${weekdayDate(starts)}.`])
  })
})

describe('a call’s answer lands where it belongs (pick 2)', () => {
  const sheetPerson = (s: GcState, company: string) => callListFollowPeople(s, job(s), holdsOf(s, job(s))).find((p) => p.partner.company === company)!

  it('new dates: they work, or another day, the way the portal answers', () => {
    const { moved, move, summit } = roofMoved()
    const told = gcReducer(moved, { type: 'tellTradesMoves', projectId: ID, moveIds: [move.id], by: 'Robert' })
    const p = sheetPerson(told, 'Summit Roofing')
    const dates = p.items.filter((i) => i.schedule?.kind === 'dates')
    expect(callListCallActions(p, dates, { dates: 'work', day: null, said: 'Said the new dates work.', by: 'Robert' })).toEqual([
      { type: 'tradeAnswerDates', projectId: ID, partnerId: summit.id, moveId: move.id, ok: true, note: 'Said the new dates work.' },
    ])
    expect(callListCallActions(p, dates, { dates: 'another', day: '2026-11-09', said: '', by: 'Robert' })).toEqual([{ type: 'tradeAnswerDates', projectId: ID, partnerId: summit.id, moveId: move.id, ok: false, day: '2026-11-09' }])
    expect(callListCallActions(p, dates, { dates: 'none', day: null, said: 'Will call back.', by: 'Robert' })).toEqual([])
  })

  it('a day on a delivery moves the delivery, and a day before the work starts lifts the hold', () => {
    const s = initialGcState()
    const p = sheetPerson(s, 'Cool Breeze Mechanical')
    const delivery = p.items.filter((i) => i.schedule?.hold === 'delivery')
    const actions = callListCallActions(p, delivery, { dates: 'none', day: '2026-10-09', said: 'Carrier ships Monday.', by: 'Robert' })
    expect(actions).toEqual([{ type: 'setScheduleWaitStep', projectId: ID, waitId: delivery[0]!.schedule!.waitId, step: 'expected', on: '2026-10-09', note: 'Andre said so on a call with Robert.' }])
    const after = actions.reduce(gcReducer, s)
    expect(person(after, 'Cool Breeze Mechanical')!.reasons.some((r) => r.call?.hold === 'delivery')).toBe(false)
  })

  it('a day on their submittal or their start becomes their word, which Follow up chases', () => {
    const s = initialGcState()
    const p = sheetPerson(s, 'Cool Breeze Mechanical')
    const sub = p.items.filter((i) => i.schedule?.hold === 'submittal')
    const actions = callListCallActions(p, sub, { dates: 'none', day: '2026-10-09', said: 'Sending it Friday.', by: 'Robert' })
    expect(actions).toEqual([{ type: 'recordPromise', partnerId: 'coolbreeze', kind: 'submittals', projectId: ID, packageId: sub[0]!.packageId, by: '2026-10-09', from: 'office' }])
    const after = actions.reduce(gcReducer, s)
    expect(person(after, 'Cool Breeze Mechanical')!.reasons.find((r) => r.call?.hold === 'submittal')?.text).toBe('Controls waits on their submittal 23 09 23-01, needed by Fri Oct 23. They said they will send it Fri Oct 9.')

    const ns = breezeNotStarted(25)
    const np = sheetPerson(ns, 'Cool Breeze Mechanical')
    const start = np.items.filter((i) => i.schedule?.kind === 'start')
    expect(callListCallActions(np, start, { dates: 'none', day: '2026-10-09', said: 'Crew is set.', by: 'Robert' }).map((a) => a.type === 'recordPromise' && a.kind)).toEqual(['start'])
  })

  it('a day on late work, an RFI or the architect’s submittal is only logged with the call', () => {
    const s = initialGcState()
    for (const company of ['Summit Roofing', 'Marsh & Vale Architects']) {
      const p = sheetPerson(s, company)
      expect(callListCallActions(p, p.items, { dates: 'none', day: '2026-10-09', said: 'Friday.', by: 'Robert' })).toEqual([])
    }
  })
})

describe('the opened bar’s company (pick 1)', () => {
  it('names the company doing the bar, and its word on the bar’s newest dates', () => {
    const s = initialGcState()
    expect(barCaller(s, job(s), lineOf(s, 'Rooftop units'))).toMatchObject({ name: 'Andre Wallace', first: 'Andre', word: null })
    expect(barCaller(s, job(s), 'fairoaksd-insp-service')).toBeNull()
    expect(barCaller(s, job(s), lineOf(s, 'Top out'))).toBeNull()
    const { moved, move, summit } = roofMoved()
    const told = gcReducer(moved, { type: 'tellTradesMoves', projectId: ID, moveIds: [move.id], by: 'Robert' })
    const sheet = lineOf(told, 'Sheet metal and flashing')
    expect(barCaller(told, job(told), sheet)?.word).toBe('New dates went out Fri Oct 2. No answer yet.')
    const yes = gcReducer(told, { type: 'tradeAnswerDates', projectId: ID, partnerId: summit.id, moveId: move.id, ok: true })
    expect(barCaller(yes, job(yes), sheet)?.word).toBe('They said the dates work, Fri Oct 2.')
  })
})

describe('a trade’s word that a bar will be late, once G-117 lands', () => {
  it('rides on the bar’s own line, or makes one', () => {
    const s = initialGcState()
    const notices = [
      { partnerId: 'summit', lineId: lineOf(s, 'TPO membrane'), day: '2026-10-14', reason: 'Rain all week.' },
      { partnerId: 'coolbreeze', lineId: lineOf(s, 'Ductwork'), day: '2026-10-19', reason: null },
    ]
    const list = callList(s, job(s), holdsOf(s, job(s)), notices)
    const summit = list.people.find((p) => p.company === 'Summit Roofing')!
    expect(summit.reasons[0]?.text).toBe('TPO membrane is behind: 50% done against 100% in the plan. It is due Fri Oct 9. They told us in their portal it will be Wed Oct 14: “Rain all week.”')
    const breeze = list.people.find((p) => p.company === 'Cool Breeze Mechanical')!
    expect(breeze.reasons.find((r) => r.call?.kind === 'notice')?.text).toBe('They told us in their portal that Ductwork will be late. They gave Mon Oct 19.')
  })
})
