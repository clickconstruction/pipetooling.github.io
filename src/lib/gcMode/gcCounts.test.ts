/**
 * GC mode design spike: the counts (`to-dos/gc-mode/mockups/counts.md`). The schedule's reasons on
 * the board row, Follow up and Needs you, each from its kernel's own read. Played on Fair Oaks D,
 * today Fri Oct 2, where Pecan Valley Electric is at work with its insurance run out (G-138) and its
 * next two bars wait on it (G-77). A company's move is a reason under it, counted once, however many
 * bars. Our move is a line on the ring card and one Needs you line.
 */
import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import { addDays } from './gcBuilding'
import { stageProgress } from './gcProgress'
import { allPeople, projectPeople } from './gcProjectPeople'
import { gcNeedsYou, phraseFor } from './gcNeedsYou'
import { callList, callRows } from './gcCallList'
import { chartHolds } from './gcChartHolds'
import { placeRows } from './gcPlaces'
import { lateNoticeState, lateDayChanged } from './gcLateNotices'
import { noticesSentAhead, toldAheadWords, tradeBenches } from './gcBench'
import { plainWordsFailures } from '../plainWords'
import type { DailyLog, GcAction, GcState, ScheduleMoveReason } from './gcTypes'
import { CALL_LIST_SAYS, REASON_GROUPS, barReasons, boardFollowPeople, gcScheduleMovesNeedsYou, ourScheduleMoves, pastContract, reasonGroup, scheduleReasons, uninsuredReasons } from './gcCounts'

const ID = 'fairoaksd'
const play = (state: GcState, ...actions: GcAction[]) => actions.reduce((s, a) => gcReducer(s, a), state)
const job = (s: GcState, id = ID) => s.projects.find((p) => p.id === id)!
const reasons = (s: GcState) => scheduleReasons(s, job(s)).map((r) => [r.partner.company, r.reason.code, r.reason.tone, r.reason.text])
const moves = (s: GcState) => ourScheduleMoves(s, job(s)).map((m) => [m.kind, m.tone, m.words])
const s0 = initialGcState()

/** Fair Oaks D's packages changed in place of the reducer, the way the walk's own steps would leave them. */
function withPackage(state: GcState, packageId: string, change: (pkg: GcState['projects'][number]['packages'][number]) => GcState['projects'][number]['packages'][number]): GcState {
  return { ...state, projects: state.projects.map((p) => (p.id !== ID ? p : { ...p, packages: p.packages.map((k) => (k.id === packageId ? change(k) : k)) })) }
}

/** This week's logs with a trade left off, as G-60's own tests write them. */
function withLogs(state: GcState, change: (log: DailyLog) => DailyLog): GcState {
  return { ...state, projects: state.projects.map((p) => (p.id !== ID ? p : { ...p, dailyLogs: (p.dailyLogs ?? []).map(change) })) }
}
const WEEK = ['2026-09-28', '2026-09-29', '2026-10-01']
const leftOff = (packageId: string) => (l: DailyLog) => (WEEK.includes(l.date) ? { ...l, crews: l.crews.filter((c) => c.packageId !== packageId) } : l)

/** A bar moved later by `days`, with a reason: G-98's late job. */
function moveBy(s: GcState, lineId: string, days: number, reason: ScheduleMoveReason): GcState {
  const a = job(s).schedule!.activities.find((x) => x.lineId === lineId)!
  return gcReducer(s, { type: 'setScheduleActivity', projectId: ID, lineId, start: addDays(a.start, days), finish: addDays(a.finish, days), after: a.after, why: { reason, note: 'The late job, as G-98 plays it.', by: 'Robert' } })
}
/** G-98's late job: Trim a week later for the customer, Test and balance nine days for rain, $500 a day. Four days past the contract, all the customer's. */
const LATE = play(moveBy(moveBy(s0, 'fplumb-4', 7, 'customer'), 'fhvac-4', 9, 'weather'), { type: 'setOwnerLateFinish', projectId: ID, perDay: 500 })

describe('on the made-up data', () => {
  it("names one company, Pecan Valley Electric: its insurance at work and its bars that wait, counted once", () => {
    expect(reasons(s0)).toEqual([['Pecan Valley Electric', 'notReady', 'amber', 'Site lighting and Fire alarm wait on current insurance. Site lighting starts Mon Oct 19.']])
    expect([...uninsuredReasons(s0, job(s0))]).toEqual([
      ['pecanvalley', { text: 'Their insurance ran out Tue Sep 15. Nothing they do for us is covered. They are at work on Panels and feeders, and Lighting.', tone: 'red', code: 'insurance', atWork: true }],
    ])
    // Two bars waiting and two at work: one company. The call list's bar reasons (G-146) put four more on the row.
    const fair = projectPeople(s0, job(s0))
    expect([fair.count, fair.late]).toEqual([6, 3])
    expect(fair.people.find((p) => p.company === 'Pecan Valley Electric')?.reasons.map((r) => r.code)).toEqual(['insurance', 'failed', 'waiver', 'notReady', 'dueToday', 'behind'])
  })

  it('has no move of ours anywhere, so the ring cards, the board row and Needs you read as before', () => {
    for (const p of s0.projects) {
      expect(ourScheduleMoves(s0, p)).toEqual([])
      if (p.id !== ID) expect(scheduleReasons(s0, p)).toEqual([])
    }
    expect(pastContract(s0, job(s0))).toBeNull()
    expect(gcScheduleMovesNeedsYou(s0)).toBeNull()
  })

  it('a closed job counts nothing', () => {
    const closed = play(s0, { type: 'closeJob', projectId: ID })
    expect(scheduleReasons(closed, job(closed))).toEqual([])
    expect(uninsuredReasons(closed, job(closed)).size).toBe(0)
    expect(ourScheduleMoves(closed, job(closed))).toEqual([])
  })
})

describe('not ready to start (G-77): theirs or ours, by the paper', () => {
  it('a statement of work sent and not signed is theirs; drafted, not sent, is ours', () => {
    const sent = withPackage(s0, 'froof', (k) => ({ ...k, sow: { ...k.sow!, status: 'sent', sentOn: '2026-09-30' } }))
    // Roof curbs starts Mon Oct 5, inside the 3 days: red.
    expect(reasons(sent).filter(([company]) => company === 'Summit Roofing')).toEqual([['Summit Roofing', 'notReady', 'red', 'Roof curbs, and Sheet metal and flashing wait on a signed statement of work. Roof curbs starts Mon Oct 5.']])
    const draft = withPackage(s0, 'froof', (k) => ({ ...k, sow: { ...k.sow!, status: 'draft' } }))
    expect(reasons(draft).some(([company]) => company === 'Summit Roofing')).toBe(false)
    expect(moves(draft)).toEqual([['papers', 'red', "Summit Roofing's statement of work is drafted, not sent. Roof curbs starts Mon Oct 5."]])
  })

  it('a trade with no company yet is ours, by trade', () => {
    const open = withPackage(s0, 'froof', (k) => ({ ...k, awardedInviteId: null }))
    expect(moves(open)).toEqual([['award', 'red', 'Roofing has no company yet. Roof curbs starts Mon Oct 5.']])
  })

  it('a statement of work on older plans is ours: a new set after Start', () => {
    const set = play(s0, { type: 'issueAddendum', projectId: ID, note: 'A canopy over the entry.', sheets: ['A-201'], touches: ['froof'] })
    const line = ourScheduleMoves(set, job(set)).find((m) => m.kind === 'newPapers')
    expect(line?.words).toBe('Summit Roofing, Pecan Valley Electric and Cool Breeze Mechanical need a new statement of work. The plans changed after they signed. Roof curbs starts Mon Oct 5.')
    expect(line?.short).toBe('3 trades need a new statement of work.')
  })
})

describe('their word on their dates (G-116’s early warnings)', () => {
  it('new dates told and not answered count, and By company still says them once', () => {
    const tpo = job(s0).schedule!.activities.find((a) => a.lineId === 'froof-1')!
    const moved = play(s0, { type: 'setScheduleActivity', projectId: ID, lineId: tpo.lineId, start: addDays(tpo.start, 30), finish: addDays(tpo.finish, 30), after: tpo.after, why: { reason: 'weather', note: 'Rain stopped the roof for a week.', by: 'Robert' } })
    const told = play(moved, { type: 'tellTradesMoves', projectId: ID, moveIds: [job(moved).schedule!.moves![0]!.id], by: 'Robert' })
    expect(reasons(told).filter(([company]) => company === 'Summit Roofing')).toEqual([['Summit Roofing', 'confirm', 'grey', 'New dates for TPO membrane and Sheet metal and flashing went out Fri Oct 2. No answer yet.']])
    expect(projectPeople(told, job(told)).people.some((p) => p.company === 'Summit Roofing')).toBe(true)
    const summit = callList(told, job(told), chartHolds(told, job(told))).people.find((p) => p.company === 'Summit Roofing')!
    expect(summit.reasons.filter((r) => r.text.startsWith('New dates for TPO membrane')).length).toBe(1)
    expect(CALL_LIST_SAYS).toEqual(['late', 'notReady', 'confirm', 'crew', 'crowded', 'failed', 'overdue', 'dueToday', 'behind', 'held'])
  })

  it('a push back of ours they have not answered counts, and the open notice does not', () => {
    const sent = play(s0, { type: 'tradeSayLate', projectId: ID, partnerId: 'summit', lineId: 'froof-1', day: '2026-10-14', reason: 'materials', note: 'The membrane ships Oct 12. We finish two days after it lands.' })
    // Summit is on the row for TPO membrane behind already (G-146); its own word reads first.
    expect(projectPeople(sent, job(sent)).people.find((p) => p.company === 'Summit Roofing')?.reasons.map((r) => r.code)).toEqual(['late', 'behind'])
    const pushed = play(sent, { type: 'pushBackLateNotice', projectId: ID, noticeId: 'late-1', note: 'We need the roof dry by Oct 9. Cool Breeze sets the rooftop units Oct 12.', by: 'Robert' })
    expect(reasons(pushed).filter(([company]) => company === 'Summit Roofing')).toEqual([['Summit Roofing', 'pushedBack', 'amber', 'We pushed back on their new day for TPO membrane on Fri Oct 2. They have not answered.']])
    const kept = play(pushed, { type: 'tradeKeepDay', projectId: ID, partnerId: 'summit', noticeId: 'late-1' })
    expect(reasons(kept).some(([, code]) => code === 'pushedBack')).toBe(false)
  })
})

describe('the log against the chart (G-60)', () => {
  it('a company away with no reason is theirs to answer', () => {
    const away = withLogs(s0, leftOff('froof'))
    expect(reasons(away).filter(([, code]) => code === 'log')).toEqual([['Summit Roofing', 'log', 'amber', 'Summit Roofing was not on site Mon, Tue and Thu. The chart has TPO membrane running those days.']])
    expect(moves(away)).toEqual([])
  })

  it('a company away for a reason the log gives is ours: move the bar with it', () => {
    const said = withLogs(s0, (l) =>
      WEEK.includes(l.date) ? { ...l, crews: l.crews.filter((c) => c.packageId !== 'felec'), delays: [...l.delays.filter((d) => d.packageId !== 'felec'), { packageId: 'felec', reason: 'materials', note: 'Panel boards are two weeks out' }] } : l,
    )
    expect(reasons(said).some(([, code]) => code === 'log')).toBe(false)
    expect(moves(said)).toEqual([
      ['log', 'amber', "Pecan Valley Electric was not on site Mon, Tue and Thu. The chart has Panels and feeders, and Lighting running those days. The log says materials: Panel boards are two weeks out. Move the bar, and give the log's reason."],
    ])
  })
})

describe('a short crew, and a crowded place', () => {
  it('a crew too short to hold the finish (G-57) is theirs', () => {
    const today = play(s0, {
      type: 'saveDailyLog',
      projectId: ID,
      log: { date: s0.today, sky: 'clear', high: 78, low: 61, weatherStop: false, crews: Object.entries({ fsteel: 4, froof: 5, felec: 3, fplumb: 3, fhvac: 1 }).map(([packageId, workers]) => ({ packageId, workers })), done: 'Work went on.', delays: [], visitors: '' },
    })
    expect(reasons(today).filter(([, code]) => code === 'crew')).toEqual([['Cool Breeze Mechanical', 'crew', 'amber', 'They have 1 on site this week against 3 so far. At that, the job finishes 19 days later, Wed Dec 30.']])
  })

  it('too many trades in one place (G-83): the crowd is ours, a count not given is theirs', () => {
    const kept = play(s0, { type: 'setActivityPlaces', projectId: ID, places: Object.fromEntries(placeRows(s0, job(s0)).flatMap((r) => (r.guess ? [[r.lineId, r.guess.place]] : []))) })
    expect(moves(kept)).toEqual([['crowd', 'amber', 'Inside has too many from Fri Oct 2 to Fri Oct 9.']])
    expect(reasons(kept).filter(([, code]) => code === 'crowded').map(([company, , tone]) => [company, tone])).toEqual([
      ['Pecan Valley Electric', 'amber'],
      ['Cool Breeze Mechanical', 'amber'],
    ])
  })
})

describe('the finish past the contract (G-98)', () => {
  it('is ours: the ring card says it after the schedule’s own lines, and the board row’s block reads the days', () => {
    expect(moves(LATE)).toEqual([['finish', 'red', "It finishes Tue Dec 15, 4 days past the contract's Fri Dec 11. All 4 are the customer's: a change order for them would save $2,000."]])
    expect(pastContract(LATE, job(LATE))).toEqual({ days: 4, words: "It finishes Tue Dec 15, 4 days past the contract's Fri Dec 11. All 4 are the customer's: a change order for them would save $2,000." })
    const ring = stageProgress(LATE, job(LATE)).also
    // The schedule, the failed inspection, the walk, then ours: the owner's order for the first ones (2026-10-03) stands.
    expect(ring.indexOf(pastContract(LATE, job(LATE))!.words)).toBe(3)
    expect(ring[2]).toMatch(/^Not walked yet\./)
  })

  it('makes Needs you’s own line, which opens the job’s schedule', () => {
    expect(gcScheduleMovesNeedsYou(LATE)).toEqual({ count: 1, late: true, title: '1 thing to do on GC schedules', detail: 'Fair Oaks Shops, Building D finishes 4 days past the contract.', projectId: ID })
    const both = withPackage(LATE, 'froof', (k) => ({ ...k, awardedInviteId: null }))
    expect(gcScheduleMovesNeedsYou(both)).toMatchObject({ count: 2, title: '2 things to do on GC schedules', detail: 'Fair Oaks Shops, Building D finishes 4 days past the contract. Roofing has no company yet.' })
  })
})

describe('Needs you’s phrase for a company', () => {
  const person = (s: GcState, company: string) => projectPeople(s, job(s)).people.find((p) => p.company === company)!
  it('says the work, not the paper, for a company at work uncovered', () => {
    expect(phraseFor(s0, person(s0, 'Pecan Valley Electric'))).toBe('Pecan Valley Electric is working without insurance')
  })
  it('says each schedule reason in a phrase', () => {
    const one = (code: string, text = 'x') => ({ key: 'partner:summit', kind: 'trade' as const, name: 'Carla Nguyen', company: 'Summit Roofing', tag: 'Roofing', partnerId: 'summit', reasons: [{ text, tone: 'amber' as const, code, lineId: 'froof-3' }], tone: 'amber' as const, last: null, phone: '' })
    expect(phraseFor(s0, one('notReady'))).toBe('Summit Roofing cannot start Sheet metal and flashing yet')
    expect(phraseFor(s0, one('confirm'))).toBe('Summit Roofing has not confirmed its dates')
    expect(phraseFor(s0, one('pushedBack'))).toBe('Summit Roofing has not answered our push back')
    expect(phraseFor(s0, one('log'))).toBe('Summit Roofing was not on site')
    expect(phraseFor(s0, one('crew'))).toBe('Summit Roofing is short a crew')
    expect(phraseFor(s0, one('crowded'))).toBe('Summit Roofing has not said how many it will have')
  })
})

describe('the bench credit (G-116): a notice sent ahead of the day counts for the company', () => {
  const say = (s: GcState, lineId: string, day: string): GcState => play(s, { type: 'tradeSayLate', projectId: ID, partnerId: 'summit', lineId, day, reason: 'materials', note: 'The membrane ships Oct 12. We finish two days after it lands.' })
  it('counts the newest notice on a bar, sent before its day, on the company’s bench', () => {
    const once = say(s0, 'froof-1', '2026-10-14')
    expect(noticesSentAhead(once, 'summit')).toBe(1)
    // A second word on the same bar replaces the first: still one.
    const twice = say(once, 'froof-1', '2026-10-16')
    expect(noticesSentAhead(twice, 'summit')).toBe(1)
    const roofing = tradeBenches(twice).find((b) => b.trade === 'Roofing')!
    expect(roofing.toldAhead).toEqual({ summit: 1 })
    expect(toldAheadWords(1)).toBe('Told us it would be late before the day, 1 time.')
    expect(tradeBenches(s0).every((b) => Object.keys(b.toldAhead).length === 0)).toBe(true)
  })

  it('reads the late notices’ own rules: replaced, and the day it changes', () => {
    const twice = say(say(s0, 'froof-1', '2026-10-14'), 'froof-1', '2026-10-16')
    const project = job(twice)
    const byKernel = (project.schedule!.lateNotices ?? []).filter((n) => n.partnerId === 'summit' && lateNoticeState(project, n) !== 'replaced' && n.on < lateDayChanged(n)).length
    expect(noticesSentAhead(twice, 'summit')).toBe(byKernel)
  })
})

describe('words', () => {
  it('every sentence the counts write passes the plain-words rules', () => {
    const kept = play(s0, { type: 'setActivityPlaces', projectId: ID, places: Object.fromEntries(placeRows(s0, job(s0)).flatMap((r) => (r.guess ? [[r.lineId, r.guess.place]] : []))) })
    const states = [s0, LATE, kept, withPackage(s0, 'froof', (k) => ({ ...k, awardedInviteId: null })), withPackage(s0, 'froof', (k) => ({ ...k, sow: { ...k.sow!, status: 'draft' } }))]
    const words = states.flatMap((s) => [
      ...scheduleReasons(s, job(s)).filter((r) => ['notReady', 'pushedBack'].includes(r.reason.code ?? '')).map((r) => r.reason.text),
      ...[...uninsuredReasons(s, job(s)).values()].map((r) => r.text),
      ...ourScheduleMoves(s, job(s)).flatMap((m) => [m.words, m.short.charAt(0).toUpperCase() + m.short.slice(1)]),
      ...(gcScheduleMovesNeedsYou(s) ? [gcScheduleMovesNeedsYou(s)!.title, gcScheduleMovesNeedsYou(s)!.detail] : []),
    ])
    expect(words.length).toBeGreaterThan(8)
    expect(words.flatMap((w) => plainWordsFailures(w))).toEqual([])
    expect(plainWordsFailures(toldAheadWords(2))).toEqual([])
  })
})

describe('G-146: the call list’s bar reasons on the board row and the badge', () => {
  const people = (s: GcState) => projectPeople(s, job(s)).people

  it("pins Fair Oaks D's pill at 6 to call and 3 late, the badge at 11 and 6 late, and Needs you's title", () => {
    const fair = projectPeople(s0, job(s0))
    expect([fair.count, fair.late]).toEqual([6, 3])
    expect(fair.people.map((p) => [p.company, p.tone])).toEqual([
      ['Pecan Valley Electric', 'red'],
      ['Cool Breeze Mechanical', 'red'],
      ['Cibolo Creek Partners', 'red'],
      ['Iron Horse Fabrication', 'amber'],
      ['Summit Roofing', 'amber'],
      ['Marsh & Vale Architects', 'grey'],
    ])
    expect([allPeople(s0).count, allPeople(s0).late]).toEqual([11, 6])
    expect(gcNeedsYou(s0)?.title).toBe('11 to follow up on in GC mode')
    expect(gcNeedsYou(s0)?.detail).toBe("Hillside Excavation is late on their word · Bexar Steel Erectors never opened the ask · Voltage Brothers' insurance ran out · and 8 more.")
  })

  it("pins the architect's row to the holds that are theirs, RFI-003 and the submittal, never a bar", () => {
    const architect = people(s0).find((p) => p.kind === 'architect')!
    expect(architect.reasons.map((r) => [r.code, r.tone, r.text])).toEqual([
      ['held', 'grey', 'RFI-003 holds Rooftop units, which starts Mon Oct 12. The answer is needed by Fri Oct 9.'],
      ['held', 'grey', 'Submittal 28 31 11-01 holds Fire alarm, which starts Mon Nov 2. It is needed back by Mon Oct 19.'],
    ])
    // The bars themselves go to the trades doing them.
    expect(people(s0).find((p) => p.company === 'Cool Breeze Mechanical')?.reasons.map((r) => r.text)).toEqual([
      'Rooftop units waits on its delivery, expected Tue Oct 20 from their supplier. That is 8 days after it starts.',
      'Controls waits on their submittal 23 09 23-01, needed by Fri Oct 23.',
    ])
  })

  it('folds each bar reason under whoever already has a row, once per person', () => {
    const pecan = people(s0).find((p) => p.company === 'Pecan Valley Electric')!
    expect(pecan.reasons.map((r) => [r.code, r.tone])).toEqual([
      ['insurance', 'red'],
      ['failed', 'red'],
      ['waiver', 'amber'],
      ['notReady', 'amber'],
      ['dueToday', 'amber'],
      ['behind', 'amber'],
    ])
    expect(people(s0).filter((p) => p.company === 'Pecan Valley Electric')).toHaveLength(1)
  })

  it("leaves out an aside and G-77's paperwork, which the count says once already", () => {
    const own = callRows(s0, job(s0), chartHolds(s0, job(s0)))
    const asides = own.flatMap((p) => p.reasons.filter((r) => r.aside).map((r) => r.text))
    expect(asides.length).toBeGreaterThan(0)
    const counted = barReasons(s0, job(s0)).map((b) => b.reason.text)
    expect(counted.some((t) => asides.includes(t))).toBe(false)
    expect(counted.some((t) => t === 'Fire alarm waits on current insurance.' || t === 'Site lighting waits on current insurance.')).toBe(false)
  })

  it('a bar past its finish is overdue and red; a bar brought to done leaves the row', () => {
    const later = { ...s0, today: '2026-10-10' }
    expect(people(later).find((p) => p.company === 'Summit Roofing')?.reasons.find((r) => r.code === 'overdue')).toMatchObject({ tone: 'red', text: 'TPO membrane is 1 day late and 50% done.' })
    const erected = play(s0, { type: 'tradeReport', projectId: ID, packageId: 'fsteel', sovId: 'fsteel-3', pct: 100 })
    expect(people(erected).some((p) => p.company === 'Iron Horse Fabrication')).toBe(false)
  })

  it('a closed job counts none of them', () => {
    const closed = play(s0, { type: 'closeJob', projectId: ID })
    expect(barReasons(closed, job(closed))).toEqual([])
  })

  it('By company says each bar reason once, its own line, not Follow up’s copy', () => {
    const list = callList(s0, job(s0), chartHolds(s0, job(s0)))
    for (const p of list.people) {
      const texts = p.reasons.map((r) => r.text)
      expect(new Set(texts).size).toBe(texts.length)
    }
    expect(list.count).toBe(5)
  })

  it('two groups, from one rule: on the schedule, or owed to us', () => {
    expect(REASON_GROUPS.map((g) => g.words)).toEqual(['On the schedule', 'Owed to us'])
    for (const code of ['failed', 'overdue', 'dueToday', 'behind', 'held', 'notReady', 'confirm', 'pushedBack', 'log', 'crew', 'crowded', 'late', 'dates', 'schedule']) expect(reasonGroup(code)).toBe('schedule')
    for (const code of ['ask', 'plans', 'sow', 'contract', 'co:co-1', 'pay:3', 'waiver', 'insurance', 'w9', 'promise', 'questions', 'bid', 'sentBack', undefined]) expect(reasonGroup(code)).toBe('owed')
  })

  it('Needs you says the work, never a paper', () => {
    const one = (company: string, code: string, lineId: string) => ({ key: `partner:${company}`, kind: 'trade' as const, name: company, company, tag: 'x', partnerId: company, reasons: [{ text: 'x', tone: 'amber' as const, code, lineId }], tone: 'amber' as const, last: null, phone: '' })
    const phrases = [
      phraseFor(s0, one('Pecan Valley Electric', 'failed', 'fairoaksd-insp-service')),
      phraseFor(s0, one('Summit Roofing', 'overdue', 'froof-1')),
      phraseFor(s0, one('Iron Horse Fabrication', 'dueToday', 'fsteel-3')),
      phraseFor(s0, one('Summit Roofing', 'behind', 'froof-1')),
      phraseFor(s0, one('Cool Breeze Mechanical', 'held', 'fhvac-1')),
    ]
    expect(phrases).toEqual([
      "Pecan Valley Electric's work failed an inspection",
      'Summit Roofing is late on TPO membrane',
      'Iron Horse Fabrication is due today on Erection',
      'Summit Roofing is behind on TPO membrane',
      'Cool Breeze Mechanical holds up Rooftop units',
    ])
    expect([...phrases, ...REASON_GROUPS.map((g) => g.words)].flatMap((w) => plainWordsFailures(w))).toEqual([])
  })

  it("the board row's sheet carries what the row counts: Summit's item in the call list's words, and Cibolo still there", () => {
    const sheet = boardFollowPeople(s0, job(s0))
    expect(sheet.map((p) => p.partner.company)).toEqual(['Pecan Valley Electric', 'Cool Breeze Mechanical', 'Cibolo Creek Partners', 'Iron Horse Fabrication', 'Summit Roofing', 'Marsh & Vale Architects'])
    const summit = sheet.find((p) => p.partner.id === 'summit')!
    expect(summit.items.map((i) => [i.kind, i.why, i.words?.en.about, i.words?.en.ask])).toEqual([
      ['schedule', 'TPO membrane is behind: 50% done against 100% in the plan. It is due Fri Oct 9.', 'your roofing TPO membrane on Fair Oaks Shops, Building D', 'When will it be done?'],
    ])
    // G-77's paperwork holds are asked once, by the paper's own item.
    const pecan = sheet.find((p) => p.partner.id === 'pecanvalley')!
    expect(pecan.items.filter((i) => i.kind === 'schedule' && i.schedule?.hold === 'paperwork')).toEqual([])
  })
})
