/**
 * GC mode design spike: pulling work earlier (G-37, `to-dos/gc-mode/mockups/G-37.md`). Work that
 * finished early catches its plan up, and the work right behind it comes in by the days it gave
 * back, never more, never before tomorrow, its Not before day or a wait's day. One press, one move,
 * with a reason and a sentence. Played here from the made-up data, and on small schedules of the
 * job's own bars for the rule's edges.
 */
import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import type { GcAction, GcState, ScheduleActivity, ScheduleWait } from './gcTypes'
import { PULL_SOONEST_DAYS, RIGHT_BEHIND_DAYS, finishedOn, planPull, pullCountWords, pullGhosts, pullMove, pullWordsFor, type PullOffer } from './gcPullEarlier'
import { moveRows, redoableMove, undoableMove } from './gcScheduleMoves'
import { companiesToTell, datesMessage } from './gcTellTrades'
import { customerChanges } from './gcCustomerSchedule'
import { daysLostByCause } from './gcDaysLost'
import { plainWordsFailures } from '../plainWords'

const play = (state: GcState, ...actions: GcAction[]) => actions.reduce((s, a) => gcReducer(s, a), state)
const job = (s: GcState) => s.projects.find((p) => p.id === 'fairoaksd')!
const act = (s: GcState, lineId: string) => job(s).schedule!.activities.find((a) => a.lineId === lineId)!
const offerOf = (s: GcState, leaveOut?: string[]) => planPull(s, job(s), leaveOut)
const span = (start: string, finish: string) => ({ start, finish })
const INSP = 'fairoaksd-insp-roughin'

/** The trades' reports that make each early finish on Fair Oaks D, today Fri Oct 2. */
const TPO_DONE: GcAction = { type: 'tradeReport', projectId: 'fairoaksd', packageId: 'froof', sovId: 'froof-1', pct: 100 }
const DUCTWORK_DONE: GcAction = { type: 'tradeReport', projectId: 'fairoaksd', packageId: 'fhvac', sovId: 'fhvac-2', pct: 100 }
const TOP_OUT_DONE: GcAction = { type: 'selfReportStage', projectId: 'fairoaksd', packageId: 'fplumb', lineId: 'fplumb-3', pct: 100 }
/** Sheet metal's submittal approved: the one thing holding it. */
const FLASHING_APPROVED: GcAction[] = [
  { type: 'sendSubmittalToArchitect', projectId: 'fairoaksd', submittalId: 'fairoaksd-sub-6' },
  { type: 'answerSubmittal', projectId: 'fairoaksd', submittalId: 'fairoaksd-sub-6', answer: 'approved', note: '' },
]

const why = (note: string) => ({ reason: 'early' as const, note, by: 'Robert' })
const pull = (s: GcState, note: string, leaveOut: string[] = []): GcState => play(s, { type: 'pullScheduleEarlier', projectId: 'fairoaksd', leaveOut, why: why(note) })

/** Every sentence an offer makes, for the plain-words rules. */
function sentences(o: PullOffer): string[] {
  return [
    ...o.words.finished,
    o.words.state,
    ...o.words.detail,
    o.words.finish,
    ...(o.words.lost ? [o.words.lost] : []),
    ...o.stays.flatMap((s) => [s.why, s.said]),
    ...o.pulls.flatMap((p) => [p.said, ...(p.limit ? [p.limit] : [])]),
    ...[...o.finished, ...o.pulls, ...o.stays].flatMap((x) => pullWordsFor(o, x.lineId) ?? []),
    ...[...pullGhosts(o).values()].map((g) => g.words),
  ]
}

/** One of the job's own bars (G-38): no trade's report, done when the office says. */
function own(lineId: string, start: string, finish: string, after: string[] = [], more: Partial<ScheduleActivity> = {}): ScheduleActivity {
  return { lineId, packageId: '', start, finish, after, added: { label: lineId.toUpperCase(), who: 'Our own crew', doneOn: null }, ...more }
}

/** Fair Oaks D with a small schedule of its own bars, and nothing holding them, for the rule's edges. */
function small(activities: ScheduleActivity[], waits: ScheduleWait[] = []): GcState {
  const s = initialGcState()
  return {
    ...s,
    projects: s.projects.map((p) => (p.id === 'fairoaksd' && p.schedule ? { ...p, schedule: { ...p.schedule, activities, moves: [], walks: [], baseline: null }, waits, submittals: [], rfis: [] } : p)),
  }
}
/** A: planned to finish Fri Oct 9, done today, 7 days early. */
const A_EARLY = own('a', '2026-09-28', '2026-10-09', [], { added: { label: 'A', who: 'Our own crew', doneOn: '2026-10-02' } })

describe('what finished early', () => {
  it('the made-up data has none, on any project', () => {
    const s = initialGcState()
    for (const p of s.projects) expect(planPull(s, p)).toBeNull()
  })

  it('reads the recorded finish, a pass, a done day, or today for a line reported at 100%', () => {
    const a = own('x', '2026-09-28', '2026-10-09')
    expect(finishedOn(a, 0, '2026-10-02')).toBeNull()
    expect(finishedOn({ ...a, actualFinish: '2026-09-30' }, 0, '2026-10-02')).toBe('2026-09-30')
    expect(finishedOn({ ...a, added: { label: 'X', who: 'Us', doneOn: '2026-10-01' } }, 0, '2026-10-02')).toBe('2026-10-01')
    const { added: _added, ...line } = a
    expect(finishedOn(line, 100, '2026-10-02')).toBe('2026-10-02')
    expect(finishedOn({ ...line, finish: '2026-09-25' }, 100, '2026-10-02')).toBe('2026-09-25')
    expect(finishedOn({ ...line, inspection: { label: 'Final', passedOn: '2026-10-01' } }, 0, '2026-10-02')).toBe('2026-10-01')
  })

  it('keeps the defaults it was given: right behind is 2 days, the soonest is tomorrow', () => {
    expect(RIGHT_BEHIND_DAYS).toBe(2)
    expect(PULL_SOONEST_DAYS).toBe(1)
  })
})

describe('Fair Oaks D', () => {
  it('TPO membrane finished early, and what is right behind it is held: the line names what to chase', () => {
    const s = play(initialGcState(), TPO_DONE)
    const o = offerOf(s)!
    expect(o.show).toBe('chase')
    expect(o.finished.map((f) => [f.lineId, f.name, f.finishedOn, f.early])).toEqual([['froof-1', 'TPO membrane', '2026-10-02', 7]])
    expect(o.pulls).toEqual([])
    expect(o.stays.map((x) => [x.lineId, x.why, x.held])).toEqual([
      ['froof-3', 'It waits on submittal 07 62 00-01, which is with us.', true],
      ['fhvac-1', 'It waits on RFI-003, which is with the architect.', true],
    ])
    expect(o.words).toEqual({
      finished: ['TPO membrane finished Fri Oct 2, 7 days early.'],
      state: 'The next work is held, so nothing can start sooner yet.',
      detail: ['Sheet metal and flashing waits on submittal 07 62 00-01, which is with us.', 'Rooftop units waits on RFI-003, which is with the architect.'],
      finish: 'The job still finishes Tue Dec 8.',
      lost: null,
    })
    expect(pullGhosts(o).size).toBe(0)
  })

  it('Ductwork alone moves nothing: the inspection still waits on Top out, and the line stays quiet', () => {
    const s = play(initialGcState(), DUCTWORK_DONE)
    const o = offerOf(s)!
    expect(o.show).toBe('quiet')
    expect(o.pulls).toEqual([])
    expect(o.stays.map((x) => x.said)).toEqual(['Rough-in inspection still waits on Top out, which finishes Fri Oct 9.'])
    expect(pullWordsFor(o, 'fhvac-2')).toBe('It finished Fri Oct 2, 7 days early. Nothing can start sooner yet. Rough-in inspection still waits on Top out, which finishes Fri Oct 9.')
  })

  it('Ductwork and Top out together bring the rough-in inspection in 7 days; Trim keeps its room', () => {
    const s = play(initialGcState(), DUCTWORK_DONE, TOP_OUT_DONE)
    const o = offerOf(s)!
    expect(o.show).toBe('pull')
    expect(o.finished.map((f) => [f.lineId, f.to])).toEqual([
      ['fplumb-3', span('2026-09-28', '2026-10-02')],
      ['fhvac-2', span('2026-09-14', '2026-10-02')],
    ])
    expect(o.pulls).toEqual([{ lineId: INSP, name: 'Rough-in inspection', trade: 'Inspections', company: 'The city', from: span('2026-10-12', '2026-10-13'), to: span('2026-10-05', '2026-10-06'), days: 7, limit: null, said: 'Rough-in inspection can start Mon Oct 5, 7 days sooner.' }])
    expect(o.stays.map((x) => [x.lineId, x.why])).toEqual([['fplumb-4', 'It was drawn with 47 days of room before it.']])
    expect(o.words.state).toBe('1 activity can start 7 days sooner.')
    expect(o.words.finish).toBe('The job still finishes Tue Dec 8.')
    expect(o.note).toBe('Top out finished Fri Oct 2, 7 days early. Ductwork finished Fri Oct 2, 7 days early.')
    expect(pullCountWords(o)).toBe('1 activity')
    expect(pullGhosts(o).get(INSP)).toEqual({ start: '2026-10-05', finish: '2026-10-06', words: 'Mon Oct 5, 7 days sooner. The work before it finished early.' })
    expect(pullWordsFor(o, INSP)).toBe('It can start Mon Oct 5, 7 days sooner. The work before it finished early.')
    expect(pullWordsFor(o, 'fplumb-4')).toBe('The work before it finished early. It was drawn with 47 days of room before it.')
    expect(pullWordsFor(o, 'fsite-1')).toBeNull()
  })

  it('the press saves one move: both plans caught up, the inspection in, the reason and the sentence kept', () => {
    const before = play(initialGcState(), DUCTWORK_DONE, TOP_OUT_DONE)
    const after = pull(before, 'Top out finished Fri Oct 2, 7 days early. Ductwork finished Fri Oct 2, 7 days early.')
    const move = job(after).schedule!.moves![0]!
    expect(move).toEqual({
      id: 'move-1',
      on: '2026-10-02',
      by: 'Robert',
      lineId: 'fplumb-3',
      from: span('2026-09-28', '2026-10-09'),
      to: span('2026-09-28', '2026-10-02'),
      reason: 'early',
      note: 'Top out finished Fri Oct 2, 7 days early. Ductwork finished Fri Oct 2, 7 days early.',
      pushed: [
        { lineId: 'fhvac-2', from: span('2026-09-14', '2026-10-09'), to: span('2026-09-14', '2026-10-02') },
        { lineId: INSP, from: span('2026-10-12', '2026-10-13'), to: span('2026-10-05', '2026-10-06') },
      ],
      finishFrom: '2026-12-08',
      finishTo: '2026-12-08',
      pull: { finished: ['fplumb-3', 'fhvac-2'] },
    })
    expect([act(after, 'fplumb-3').finish, act(after, 'fhvac-2').finish, act(after, INSP).start, act(after, INSP).finish]).toEqual(['2026-10-02', '2026-10-02', '2026-10-05', '2026-10-06'])
    // Nothing else on the schedule moved.
    const moved = job(after).schedule!.activities.filter((a, i) => a !== job(before).schedule!.activities[i]).map((a) => a.lineId)
    expect(moved).toEqual(['fplumb-3', 'fhvac-2', INSP])
    expect(after.log[0]?.text).toBe('Robert pulled 1 activity earlier on Fair Oaks Shops, Building D. Top out finished Fri Oct 2, 7 days early. Ductwork finished Fri Oct 2, 7 days early.')
    // The plans read true now, so there is nothing left to pull.
    expect(offerOf(after)).toBeNull()
  })

  it('Undo puts every date back and the offer returns; Redo pulls it again', () => {
    const before = play(initialGcState(), DUCTWORK_DONE, TOP_OUT_DONE)
    const after = pull(before, 'Top out and Ductwork both finished today.')
    expect(undoableMove(job(after))?.id).toBe('move-1')
    const undone = play(after, { type: 'undoScheduleMove', projectId: 'fairoaksd', moveId: 'move-1', by: 'Robert' })
    expect(job(undone).schedule!.activities).toEqual(job(before).schedule!.activities)
    expect(offerOf(undone)?.show).toBe('pull')
    expect(redoableMove(job(undone))?.id).toBe('move-1')
    const redone = play(undone, { type: 'redoScheduleMove', projectId: 'fairoaksd', moveId: 'move-1', by: 'Robert' })
    expect(job(redone).schedule!.activities).toEqual(job(after).schedule!.activities)
  })

  it('a trade line comes in once its hold is gone, and only that company is told, never the one that finished', () => {
    const s = play(initialGcState(), TPO_DONE, ...FLASHING_APPROVED)
    const o = offerOf(s)!
    expect(o.show).toBe('pull')
    expect(o.pulls.map((p) => [p.lineId, p.to, p.days])).toEqual([['froof-3', span('2026-10-05', '2026-10-14'), 7]])
    // Rooftop units is still held; the line says so beside the press.
    expect(o.words.detail).toEqual(['Rooftop units waits on RFI-003, which is with the architect.'])
    const after = pull(s, o.note)
    const move = job(after).schedule!.moves![0]!
    const told = companiesToTell(after, job(after), [move])
    expect(told.map((c) => [c.partner.company, c.lines.map((l) => l.work)])).toEqual([['Summit Roofing', ['Sheet metal and flashing']]])
    const told0 = told[0]!
    expect(datesMessage(job(after), told0.partner, told0, 'en').lines).toContain('Why: finished early: TPO membrane finished Fri Oct 2, 7 days early.')
  })

  it('a pulled inspection or our own crew is nobody to tell', () => {
    const after = pull(play(initialGcState(), DUCTWORK_DONE, TOP_OUT_DONE), 'Both rough-ins finished today.')
    expect(companiesToTell(after, job(after), [job(after).schedule!.moves![0]!])).toEqual([])
  })

  it('an unticked activity keeps its dates, and the press with nothing ticked does nothing', () => {
    const s = play(initialGcState(), TPO_DONE, ...FLASHING_APPROVED)
    const o = offerOf(s, ['froof-3'])!
    expect(o.pulls).toEqual([])
    expect(o.stays.find((x) => x.lineId === 'froof-3')).toMatchObject({ why: 'It is left out. It keeps its dates.', left: true, held: false })
    expect(pull(s, 'TPO membrane finished today.', ['froof-3'])).toBe(s)
  })

  it('the reducer refuses a pull with no reason or a short sentence, and with nothing finished early', () => {
    const s = play(initialGcState(), DUCTWORK_DONE, TOP_OUT_DONE)
    expect(play(s, { type: 'pullScheduleEarlier', projectId: 'fairoaksd', leaveOut: [], why: { reason: 'early', note: 'early', by: 'Robert' } })).toBe(s)
    expect(play(s, { type: 'pullScheduleEarlier', projectId: 'fairoaksd', leaveOut: [], why: { reason: null as never, note: 'Both rough-ins finished today.', by: 'Robert' } })).toBe(s)
    const plain = initialGcState()
    expect(pull(plain, 'Nothing finished early here.')).toBe(plain)
  })

  it('Keep the dates in a walk ends the offer; a bar kept as drawn in the same walk does not', () => {
    const s = play(initialGcState(), TPO_DONE)
    const keptEarly = play(s, { type: 'recordScheduleWalk', projectId: 'fairoaksd', by: 'Robert', kept: [], moveIds: [], skipped: 3, keptEarly: ['froof-1'] })
    expect(job(keptEarly).schedule!.walks![0]).toMatchObject({ keptEarly: ['froof-1'], kept: [] })
    expect(offerOf(keptEarly)).toBeNull()
    const keptAsDrawn = play(s, { type: 'recordScheduleWalk', projectId: 'fairoaksd', by: 'Robert', kept: ['froof-1'], moveIds: [], skipped: 3 })
    expect(offerOf(keptAsDrawn)?.show).toBe('chase')
  })

  it('reads in the history, the customer’s What changed and Days lost the way the mockup says', () => {
    const both = pull(play(initialGcState(), DUCTWORK_DONE, TOP_OUT_DONE), 'Both rough-ins finished today.')
    const row = moveRows(job(both))[0]!
    expect([row.what, row.effect, row.reason]).toEqual(['Plumbing · Top out and 1 more finished early.', 'Rough-in inspection was pulled earlier with them.', 'Finished early'])
    expect(customerChanges(job(both), both.today)).toEqual(['Rough-in is 7 days sooner than planned. The finish holds.'])
    const one = pull(play(initialGcState(), TPO_DONE, ...FLASHING_APPROVED), 'TPO membrane finished today.')
    const r1 = moveRows(job(one))[0]!
    expect([r1.what, r1.effect]).toEqual(['Roofing · TPO membrane finished Fri Oct 2, 7 days early.', 'Roofing · Sheet metal and flashing was pulled earlier with it.'])
  })
})

describe('Days lost, by cause: a pull is days given back, on its own line', () => {
  it('never nets against a trade’s door, which keeps counting only what it cost', () => {
    // A crew move costs the job 2 days on its last bar; then A's early finish gives 7 back down the chain.
    const s0 = small([A_EARLY, own('b', '2026-10-10', '2026-10-14', ['a']), own('c', '2026-10-15', '2026-10-20', ['b'])])
    const crew = play(s0, { type: 'setScheduleActivity', projectId: 'fairoaksd', lineId: 'c', start: '2026-10-17', finish: '2026-10-22', after: ['b'], why: { reason: 'crew', note: 'Our crew was on another job for two days.', by: 'Robert' } })
    const before = daysLostByCause(job(crew))
    const trade = before.rows.find((r) => r.cause === 'trade')!
    const after = pull(crew, 'A finished Fri Oct 2, 7 days early.')
    const lost = daysLostByCause(job(after))
    expect(lost.rows.find((r) => r.cause === 'trade')).toEqual(trade)
    expect(lost.rows.find((r) => r.cause === 'early')).toEqual({ cause: 'early', label: 'finished early', finishDays: -7, workDays: -7, moves: 1, reasons: ['finished early'] })
    expect(lost.words).toBe("The finish moved 5 days sooner in 2 moves: 2 days a trade's (crew), 7 days back from work that finished early.")
  })

  it('a pull that leaves the finish where it was still shows its days back on the work', () => {
    const after = pull(play(initialGcState(), DUCTWORK_DONE, TOP_OUT_DONE), 'Both rough-ins finished today.')
    expect(daysLostByCause(job(after)).rows).toEqual([{ cause: 'early', label: 'finished early', finishDays: 0, workDays: -7, moves: 1, reasons: ['finished early'] }])
  })
})

describe('the rule, on small schedules of the job’s own bars', () => {
  it('right behind comes in; drawn with room stays', () => {
    const o = offerOf(small([A_EARLY, own('b', '2026-10-12', '2026-10-15', ['a']), own('c', '2026-10-13', '2026-10-15', ['a'])]))!
    expect(o.pulls.map((p) => [p.lineId, p.to.start, p.days])).toEqual([['b', '2026-10-05', 7]])
    expect(o.stays.map((x) => [x.lineId, x.why])).toEqual([['c', 'It was drawn with 3 days of room before it.']])
  })

  it('comes in by the days given back, never more, keeping its length', () => {
    const a = own('a', '2026-09-28', '2026-10-05', [], { added: { label: 'A', who: 'Our own crew', doneOn: '2026-10-02' } })
    const o = offerOf(small([a, own('b', '2026-10-06', '2026-10-09', ['a'])]))!
    expect(o.finished[0]?.early).toBe(3)
    expect(o.pulls.map((p) => [p.to, p.days])).toEqual([[span('2026-10-03', '2026-10-06'), 3]])
  })

  it('never before tomorrow, and says how many days waiting already cost', () => {
    const a = own('a', '2026-09-20', '2026-10-09', [], { added: { label: 'A', who: 'Our own crew', doneOn: '2026-09-28' } })
    const o = offerOf(small([a, own('b', '2026-10-10', '2026-10-12', ['a'])]))!
    expect(o.pulls.map((p) => [p.to.start, p.days, p.limit])).toEqual([['2026-10-03', 7, 'Tomorrow is the soonest it can start.']])
    expect(o.lostDays).toBe(4)
    expect(o.words.lost).toBe('4 of those days are gone already. Each day of waiting costs one more.')
  })

  it('never before its Not before day', () => {
    const o = offerOf(small([A_EARLY, own('b', '2026-10-10', '2026-10-12', ['a'], { notBefore: '2026-10-07' })]))!
    expect(o.pulls.map((p) => [p.to.start, p.days, p.limit])).toEqual([['2026-10-07', 3, 'It cannot start before Wed Oct 7.']])
  })

  it('never before the day after what it waits on from outside is expected', () => {
    const doors: ScheduleWait = { id: 'w1', kind: 'delivery', title: 'the doors', packageId: null, who: 'the supplier', lineIds: ['b'], askedOn: '2026-09-20', expectedOn: '2026-10-05', doneOn: null }
    const o = offerOf(small([A_EARLY, own('b', '2026-10-10', '2026-10-12', ['a'])], [doors]))!
    expect(o.pulls.map((p) => [p.to.start, p.days, p.limit])).toEqual([['2026-10-06', 4, 'It waits on the doors, expected Mon Oct 5.']])
  })

  it('a late wait holds it, and the line names it to chase', () => {
    const late: ScheduleWait = { id: 'w1', kind: 'delivery', title: 'the doors', packageId: null, who: 'the supplier', lineIds: ['b'], askedOn: '2026-09-20', expectedOn: '2026-10-12', doneOn: null }
    const o = offerOf(small([A_EARLY, own('b', '2026-10-10', '2026-10-12', ['a'])], [late]))!
    expect(o.show).toBe('chase')
    expect(o.stays.map((x) => [x.why, x.held])).toEqual([['It waits on the doors, expected Mon Oct 12.', true]])
  })

  it('work that started stays, and so does an inspection the city will see again', () => {
    const insp = own('i', '2026-10-10', '2026-10-10', ['a'], { inspection: { label: 'Rough-in inspection', failed: [{ on: '2026-09-30', note: 'Strapping.', packageIds: [], reinspectOn: '2026-10-10' }] } })
    const { added: _a, ...inspection } = insp
    const o = offerOf(small([A_EARLY, own('b', '2026-10-10', '2026-10-12', ['a'], { actualStart: '2026-10-01' }), inspection]))!
    expect(o.stays.map((x) => [x.lineId, x.why])).toEqual([
      ['b', 'It started Thu Oct 1.'],
      ['i', 'The city sees it again Sat Oct 10.'],
    ])
  })

  it('a bar with another wait comes in only as far as that wait allows, and keeps a gap on its wait', () => {
    const e = own('e', '2026-10-01', '2026-10-07')
    const o = offerOf(small([A_EARLY, e, own('b', '2026-10-10', '2026-10-12', ['a', 'e']), own('g', '2026-10-12', '2026-10-13', ['a'], { lag: { a: 2 } })]))!
    expect(o.pulls.map((p) => [p.lineId, p.to.start, p.days])).toEqual([
      ['b', '2026-10-08', 2],
      ['g', '2026-10-05', 7],
    ])
  })

  it('a chain comes in together, and a finish that moves says by how much', () => {
    const o = offerOf(small([A_EARLY, own('b', '2026-10-10', '2026-10-14', ['a']), own('c', '2026-10-15', '2026-10-20', ['b']), own('d', '2026-10-21', '2026-10-21', ['c'])]))!
    expect(o.pulls.map((p) => [p.lineId, p.to])).toEqual([
      ['b', span('2026-10-03', '2026-10-07')],
      ['c', span('2026-10-08', '2026-10-13')],
      ['d', span('2026-10-14', '2026-10-14')],
    ])
    expect(o.words.state).toBe('3 activities can start 7 days sooner.')
    expect(o.words.finish).toBe('The job finishes Wed Oct 14, 7 days sooner.')
    // Leave the middle one out: it keeps its dates, and what waits only on it stays too.
    const left = offerOf(small([A_EARLY, own('b', '2026-10-10', '2026-10-14', ['a']), own('c', '2026-10-15', '2026-10-20', ['b']), own('d', '2026-10-21', '2026-10-21', ['c'])]), ['c'])!
    expect(left.pulls.map((p) => p.lineId)).toEqual(['b'])
    expect(left.stays.map((x) => [x.lineId, x.left])).toEqual([['c', true]])
    expect(left.words.finish).toBe('The job still finishes Wed Oct 21.')
  })

  it('a job not being built offers nothing', () => {
    const s = small([A_EARLY, own('b', '2026-10-10', '2026-10-12', ['a'])])
    const buyout = { ...s, projects: s.projects.map((p) => (p.id === 'fairoaksd' ? { ...p, stage: 'buyout' as const } : p)) }
    expect(offerOf(buyout)).toBeNull()
  })

  it('pullMove is null with nothing to pull', () => {
    const s = play(initialGcState(), TPO_DONE)
    expect(pullMove(job(s).schedule!, offerOf(s)!, why('TPO membrane finished today.'), s.today)).toBeNull()
  })
})

describe('plain words', () => {
  it('every sentence an offer makes passes the rules', () => {
    const offers = [
      offerOf(play(initialGcState(), TPO_DONE)),
      offerOf(play(initialGcState(), DUCTWORK_DONE)),
      offerOf(play(initialGcState(), DUCTWORK_DONE, TOP_OUT_DONE)),
      offerOf(play(initialGcState(), TPO_DONE, ...FLASHING_APPROVED)),
      offerOf(play(initialGcState(), TPO_DONE, ...FLASHING_APPROVED), ['froof-3']),
      offerOf(small([own('a', '2026-09-20', '2026-10-09', [], { added: { label: 'A', who: 'Our own crew', doneOn: '2026-09-28' } }), own('b', '2026-10-10', '2026-10-12', ['a'])])),
    ]
    const failures = offers.flatMap((o) => (o ? sentences(o) : ['no offer'])).flatMap((t) => plainWordsFailures(t))
    expect(failures).toEqual([])
  })
})
