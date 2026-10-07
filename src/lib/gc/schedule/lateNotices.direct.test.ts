/**
 * Main's own tests for a trade's late notice (G-117; the schedule's PR 1b): the office's card, the
 * chart's tail, taking it, pushing back, the company's answer, and what Follow up, the walk and the
 * log say, run through the kernels on the test data. The spike's own cases: on Fair Oaks D, today
 * Fri Oct 2, Summit Roofing says its TPO membrane (Sep 21 to Oct 9) will finish Wed Oct 14. The
 * notice is the one its portal keeps; the spike's reducer tests send it.
 */
import { describe, expect, it } from 'vitest'
import { partnerById } from '../lookups'
import type { GcState } from '../types'
import {
  companyLateNotice,
  lateAheadWords,
  lateNoticeLogWords,
  lateNoticeMove,
  lateNoticeMoveWords,
  lateNoticeReasons,
  lateNoticeRows,
  lateNoticesToAnswer,
  lateNoticeState,
  lateNoticeTails,
  lateSaysWords,
  lateTarget,
  lateWalkFact,
  openLateNotices,
  portalLateNotice,
} from './lateNotices'
import { moveRecord, planMove, undoMove } from './moves'
import { initialGcState } from './testState'
import type { LateNotice, ProjectSchedule, ScheduleMoveReason } from './types'

const ID = 'fairoaksd'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
const TPO = 'froof-1'
const CURBS = 'froof-4'
const NOTE = 'The membrane ships Oct 12. We finish two days after it lands.'
const PUSH = 'We need the roof dry by Oct 9. Cool Breeze sets the rooftop units Oct 12.'

/** Summit's notice on TPO membrane, as its portal keeps it: Wed Oct 14, not Fri Oct 9. */
const NOTICE: LateNotice = {
  id: 'late-1',
  partnerId: 'summit',
  lineId: TPO,
  on: '2026-10-02',
  by: 'Carla Nguyen',
  started: true,
  was: { start: '2026-09-21', finish: '2026-10-09' },
  to: { start: '2026-09-21', finish: '2026-10-14' },
  reason: 'materials',
  note: NOTE,
}

const withSchedule = (s: GcState, change: (schedule: ProjectSchedule) => ProjectSchedule): GcState => ({
  ...s,
  projects: s.projects.map((p) => (p.id === ID ? { ...p, schedule: change(p.schedule!) } : p)),
})
/** The job with a notice kept on it, newest first. */
const told = (s = initialGcState(), notice = NOTICE): GcState => withSchedule(s, (sc) => ({ ...sc, lateNotices: [notice, ...(sc.lateNotices ?? [])] }))
/** The job with its notice changed: pushed back, answered. */
const answered = (s: GcState, change: Partial<LateNotice>): GcState => withSchedule(s, (sc) => ({ ...sc, lateNotices: sc.lateNotices!.map((n) => (n.id === 'late-1' ? { ...n, ...change } : n)) }))
/** A move saved the way a press saves it: the plan's dates, and its record on the schedule, newest first, naming the notice it takes. */
function saved(s: GcState, lineId: string, start: string, finish: string, after: string[], why: { reason: ScheduleMoveReason; note: string; by: string }, lateNoticeId?: string): GcState {
  const p = job(s)
  const plan = planMove(p, lineId, start, finish, after)!
  const move = moveRecord(p.schedule!, lineId, plan, why, s.today, undefined, lateNoticeId)
  return withSchedule(s, (sc) => ({ ...sc, activities: plan.activities, moves: [move, ...(sc.moves ?? [])] }))
}
/** The office takes the notice: the move it is ready with, saved. */
function taken() {
  const after = told()
  const pending = lateNoticeMove(after, job(after), NOTICE)!
  const moved = saved(after, pending.lineId, pending.start, pending.finish, pending.after, { ...pending.why, by: 'Robert' }, pending.lateNoticeId)
  return { after, pending, moved, move: job(moved).schedule!.moves![0]! }
}

describe('the office’s card', () => {
  it('says what the company said, when it came, and what taking it does', () => {
    const after = told()
    expect(lateNoticeState(job(after), NOTICE)).toBe('open')
    expect(lateAheadWords(NOTICE)).toBe('7 days before its finish')
    expect(lateSaysWords(NOTICE)).toBe('Says it will finish Wed Oct 14, not Fri Oct 9. That is 5 days later.')
    const [row, ...rest] = lateNoticeRows(after, job(after))
    expect(rest).toEqual([])
    expect(row).toMatchObject({
      state: 'open',
      name: 'Roofing · TPO membrane',
      work: 'TPO membrane',
      reason: 'Materials',
      sent: 'Sent today, 7 days before its finish.',
      late: false,
      says: 'Says it will finish Wed Oct 14, not Fri Oct 9. That is 5 days later.',
      ifTaken: 'If you take it: 2 activities after it move out. The job still finishes Tue Dec 8.',
      finishMoves: false,
      answer: null,
    })
    expect(row?.partner.company).toBe('Summit Roofing')
  })

  it('reads a new start for work not started, and a day already passed', () => {
    const state = initialGcState()
    const curbs = job(state).schedule!.activities.find((a) => a.lineId === CURBS)!
    const notStarted: LateNotice = { ...NOTICE, lineId: CURBS, started: false, was: { start: curbs.start, finish: curbs.finish }, to: lateTarget(curbs, false, '2026-10-07'), reason: 'crew', note: 'Our crew is on another roof until Tuesday.' }
    expect(lateAheadWords(notStarted)).toBe('3 days before its start')
    expect(lateSaysWords(notStarted)).toBe('Says it can start Wed Oct 7, not Mon Oct 5. It would finish Sun Oct 11.')
    expect(lateNoticeRows(told(state, notStarted), job(told(state, notStarted)))[0]).toMatchObject({
      says: 'Says it can start Wed Oct 7, not Mon Oct 5. It would finish Sun Oct 11.',
      sent: 'Sent today, 3 days before its start.',
      ifTaken: 'If you take it: Nothing after it moves. The job still finishes Tue Dec 8.',
    })
    // Two days after the curbs should have started, nobody on the roof: the notice comes late, and says so.
    const passed: LateNotice = { ...notStarted, on: '2026-10-07', to: lateTarget(curbs, false, '2026-10-08'), note: 'Our crew is on another roof until Thursday.' }
    expect(lateAheadWords(passed)).toBe('2 days after its start passed')
    const later = told({ ...initialGcState(), today: '2026-10-07' }, passed)
    expect(lateNoticeRows(later, job(later))[0]).toMatchObject({ sent: 'Sent today, 2 days after its start passed.', late: true })
  })

  it('draws the day on the chart as a tail until it is taken', () => {
    const after = told()
    expect([...lateNoticeTails(after, job(after))]).toEqual([[TPO, { finish: '2026-10-14', words: 'Summit Roofing says it will finish Wed Oct 14: materials. Not on the dates yet.' }]])
  })

  it('gives the By company list the open notice, in its stable shape', () => {
    expect(openLateNotices(job(told()))).toEqual([{ id: 'late-1', partnerId: 'summit', lineId: TPO, day: '2026-10-14', started: true, reason: 'materials', note: NOTE, on: '2026-10-02' }])
    expect(openLateNotices(job(initialGcState()))).toEqual([])
  })
})

describe('Follow up, the walk and the log', () => {
  it('puts the open notice on the company, red once its day passes with no answer', () => {
    const after = told()
    expect(lateNoticeReasons(after, job(after))).toEqual([{ partner: partnerById(after, 'summit'), trade: 'Roofing', text: `Says TPO membrane will finish Wed Oct 14, not Fri Oct 9: “${NOTE}”`, tone: 'amber' }])
    const passed = { ...after, today: '2026-10-10' }
    expect(lateNoticeReasons(passed, job(passed))[0]?.tone).toBe('red')
    const state = initialGcState()
    expect(lateNoticeReasons(state, job(state))).toEqual([])
  })

  it('tells the walk what the company said, and the log when it came', () => {
    const after = told()
    expect(lateWalkFact(job(after), TPO, 'Summit Roofing', after.today)).toBe('Summit Roofing said today it will finish Wed Oct 14: materials.')
    expect(lateWalkFact(job(initialGcState()), TPO, 'Summit Roofing', after.today)).toBeNull()
    expect(lateNoticeLogWords(job(after), partnerById(after, 'summit')!, NOTICE)).toBe('Summit Roofing says TPO membrane on Fair Oaks Shops, Building D will finish Wed Oct 14, not Fri Oct 9: materials.')
  })
})

describe('Take: the move carries the notice, its reason and its words', () => {
  it('is ready for Why it moved with the company’s dates, reason and words', () => {
    expect(taken().pending).toEqual({
      lineId: TPO,
      start: '2026-09-21',
      finish: '2026-10-14',
      after: ['fsteel-2'],
      why: { reason: 'materials', note: `Summit Roofing told us Fri Oct 2: ${NOTE}` },
      lateNoticeId: 'late-1',
    })
  })

  it('saves an ordinary move that names the notice, and the portal shows it taken', () => {
    const { moved, move } = taken()
    expect(move).toMatchObject({ lineId: TPO, reason: 'materials', note: `Summit Roofing told us Fri Oct 2: ${NOTE}`, lateNoticeId: 'late-1', to: { start: '2026-09-21', finish: '2026-10-14' } })
    expect(lateNoticeState(job(moved), NOTICE)).toBe('taken')
    expect(lateNoticeMoveWords(moved, job(moved), move)).toBe('Summit Roofing asked for this Fri Oct 2, 7 days before its finish.')
    expect(companyLateNotice(job(moved), 'summit', TPO)?.state).toBe('taken')
    expect(portalLateNotice(job(moved), 'summit', TPO)?.state).toBe('taken')
  })

  it('takes it off the card, the chart, Follow up and the walk', () => {
    const { moved } = taken()
    expect(lateNoticeRows(moved, job(moved))).toEqual([])
    expect(lateNoticeTails(moved, job(moved)).size).toBe(0)
    expect(openLateNotices(job(moved))).toEqual([])
    expect(lateNoticeReasons(moved, job(moved))).toEqual([])
    expect(lateWalkFact(job(moved), TPO, 'Summit Roofing', moved.today)).toBeNull()
  })

  it('opens the notice again when the move is undone', () => {
    const { moved, move } = taken()
    const undone = withSchedule(moved, () => undoMove(job(moved), move.id, 'Robert', moved.today)!)
    expect(lateNoticeState(job(undone), NOTICE)).toBe('open')
    expect(lateNoticeRows(undone, job(undone))).toHaveLength(1)
  })
})

describe('Push back, and the company’s answer', () => {
  const pushBack = (s: GcState) => answered(s, { pushedBack: { on: '2026-10-02', by: 'Robert', note: PUSH } })

  it('keeps the day, takes the tail off, and asks the company in its portal', () => {
    const pushed = pushBack(told())
    expect(lateNoticeState(job(pushed), NOTICE)).toBe('pushedBack')
    expect(lateNoticeRows(pushed, job(pushed))[0]).toMatchObject({ state: 'pushedBack', ifTaken: '', answer: 'We asked them today to keep Fri Oct 9. No answer yet.' })
    expect(lateNoticeTails(pushed, job(pushed)).size).toBe(0)
    expect(lateNoticeMove(pushed, job(pushed), job(pushed).schedule!.lateNotices![0]!)).toBeNull()
    expect(lateNoticeReasons(pushed, job(pushed))).toEqual([])
    expect(portalLateNotice(job(pushed), 'summit', TPO)?.state).toBe('pushedBack')
    expect(lateNoticesToAnswer(pushed, 'summit').map((x) => x.work)).toEqual(['TPO membrane'])
    expect(lateNoticesToAnswer(pushed, 'coolbreeze')).toEqual([])
  })

  it('closes when the company says it will make the day', () => {
    const kept = answered(pushBack(told()), { kept: { on: '2026-10-02' } })
    expect(lateNoticeState(job(kept), NOTICE)).toBe('kept')
    expect(lateNoticeRows(kept, job(kept))[0]).toMatchObject({ state: 'kept', answer: 'They said today they will make Fri Oct 9.' })
    expect(portalLateNotice(job(kept), 'summit', TPO)?.state).toBe('kept')
    expect(lateNoticesToAnswer(kept, 'summit')).toEqual([])
    // Once its day has passed, the answered row leaves the card: the bar's own state says the rest.
    expect(lateNoticeRows({ ...kept, today: '2026-10-10' }, job(kept))).toEqual([])
  })
})

describe('a newer notice replaces the open one; a bar moved another way closes it', () => {
  it('shows only the newest notice from the company on the bar', () => {
    const newer: LateNotice = { ...NOTICE, id: 'late-2', to: { start: '2026-09-21', finish: '2026-10-16' }, note: 'The membrane ships Oct 14 now.' }
    const again = told(told(), newer)
    expect(lateNoticeState(job(again), NOTICE)).toBe('replaced')
    expect(lateNoticeState(job(again), newer)).toBe('open')
    expect(lateNoticeRows(again, job(again)).map((r) => r.notice.id)).toEqual(['late-2'])
    expect(companyLateNotice(job(again), 'summit', TPO)?.notice.id).toBe('late-2')
    expect(portalLateNotice(job(again), 'summit', TPO)?.notice.id).toBe('late-2')
  })

  it('closes when the office moves the bar without it', () => {
    const dragged = saved(told(), TPO, '2026-09-21', '2026-10-12', ['fsteel-2'], { reason: 'materials', note: 'We split the difference with Carla.', by: 'Robert' })
    expect(lateNoticeState(job(dragged), NOTICE)).toBe('moved')
    expect(companyLateNotice(job(dragged), 'summit', TPO)?.state).toBe('moved')
    expect(lateNoticeRows(dragged, job(dragged))).toEqual([])
    expect(portalLateNotice(job(dragged), 'summit', TPO)).toBeNull()
    expect(companyLateNotice(job(dragged), 'coolbreeze', TPO)).toBeNull()
  })
})
