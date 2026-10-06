import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import type { GcAction, GcState, LookAheadReason } from './gcTypes'
import { portalHome } from './gcPortal'
import { projectPeople } from './gcProjectPeople'
import { gcNeedsYou } from './gcNeedsYou'
import { moveActivityName } from './gcScheduleMoves'
import { walkItems } from './gcScheduleWalk'
import { customerChanges } from './gcCustomerSchedule'
import { companiesToTell } from './gcTellTrades'
import {
  lateDoor,
  lateNoticeMove,
  lateNoticeMoveWords,
  lateNoticeProblem,
  lateNoticeRows,
  lateNoticesToAnswer,
  lateNoticeState,
  lateNoticeTails,
  lateTarget,
  lateWaiting,
  openLateNotices,
  portalLateNotice,
} from './gcLateNotices'

/**
 * GC mode design spike: a trade tells us it will be late, from its portal (the Gantt, G-117).
 * Played on the made-up job being built, Fair Oaks D, where today is Fri Oct 2: Summit Roofing's
 * TPO membrane runs Sep 21 to Oct 9 at 50%, and its Roof curbs Oct 5 to Oct 9, not started.
 */

const ID = 'fairoaksd'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
const TPO = 'froof-1'
const CURBS = 'froof-4'
const NOTE = 'The membrane ships Oct 12. We finish two days after it lands.'
const PUSH = 'We need the roof dry by Oct 9. Cool Breeze sets the rooftop units Oct 12.'

const sayLate = (lineId: string, day: string, reason: LookAheadReason = 'materials', note = NOTE, partnerId = 'summit'): GcAction => ({ type: 'tradeSayLate', projectId: ID, partnerId, lineId, day, reason, note })

/** Summit says TPO membrane will finish Wed Oct 14, not Fri Oct 9. */
function told() {
  const state = initialGcState()
  const after = gcReducer(state, sayLate(TPO, '2026-10-14'))
  return { state, after, notice: job(after).schedule!.lateNotices![0]! }
}

describe('the made-up job, as these tests read it', () => {
  it('has the bars the examples name, and no notice yet', () => {
    const state = initialGcState()
    expect(moveActivityName(job(state), TPO)).toBe('Roofing · TPO membrane')
    expect(moveActivityName(job(state), CURBS)).toBe('Roofing · Roof curbs')
    expect(state.today).toBe('2026-10-02')
    expect(job(state).schedule!.lateNotices).toBeUndefined()
  })
})

describe('the door: a company may say it will be late on its own unfinished bar', () => {
  const state = initialGcState()
  it('asks for a new finish on work under way, a new start on work not started', () => {
    expect(lateDoor(state, job(state), 'summit', TPO)).toMatchObject({ started: true, day: '2026-10-09' })
    expect(lateDoor(state, job(state), 'summit', CURBS)).toMatchObject({ started: false, day: '2026-10-05' })
  })

  it('has no door on a finished bar, another company’s bar, our own crew’s, an inspection, or a job not being built', () => {
    expect(lateDoor(state, job(state), 'summit', 'froof-2')).toBeNull()
    expect(lateDoor(state, job(state), 'summit', 'fhvac-1')).toBeNull()
    expect(lateDoor(state, job(state), 'summit', 'fplumb-3')).toBeNull()
    expect(lateDoor(state, job(state), 'summit', 'fairoaksd-insp-roughin')).toBeNull()
    const pursuing = state.projects.find((p) => p.stage !== 'building' && p.schedule)
    if (pursuing) {
      const line = pursuing.schedule!.activities[0]!.lineId
      expect(state.partners.every((p) => lateDoor(state, pursuing, p.id, line) === null)).toBe(true)
    }
  })

  it('moves the finish of work under way, and the whole bar of work not started', () => {
    const a = (id: string) => job(state).schedule!.activities.find((x) => x.lineId === id)!
    expect(lateTarget(a(TPO), true, '2026-10-14')).toEqual({ start: '2026-09-21', finish: '2026-10-14' })
    expect(lateTarget(a(CURBS), false, '2026-10-07')).toEqual({ start: '2026-10-07', finish: '2026-10-11' })
  })

  it('says what stops a notice, in the portal’s words', () => {
    const door = lateDoor(state, job(state), 'summit', TPO)!
    expect(lateNoticeProblem(door, state.today, '', 'materials', NOTE)).toEqual({ key: 'latePickDay' })
    expect(lateNoticeProblem(door, state.today, '2026-10-09', 'materials', NOTE)).toEqual({ key: 'lateLaterDay', day: '2026-10-09' })
    expect(lateNoticeProblem({ ...door, day: '2026-09-30' }, state.today, '2026-10-01', 'materials', NOTE)).toEqual({ key: 'lateFromToday' })
    expect(lateNoticeProblem(door, state.today, '2026-10-14', null, NOTE)).toEqual({ key: 'latePickWhy' })
    expect(lateNoticeProblem(door, state.today, '2026-10-14', 'materials', 'late')).toEqual({ key: 'lateNote' })
    expect(lateNoticeProblem(door, state.today, '2026-10-14', 'materials', NOTE)).toBeNull()
  })
})

describe('tradeSayLate: the notice is kept, nothing moves', () => {
  it('keeps the dates it was sent against, the dates it asks for, why, and who', () => {
    const { state, after, notice } = told()
    expect(notice).toEqual({
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
    })
    // Nothing on the chart moves until the office takes it.
    expect(job(after).schedule!.activities).toEqual(job(state).schedule!.activities)
    expect(job(after).schedule!.moves).toBeUndefined()
    expect(after.log[0]?.text).toBe('Summit Roofing says TPO membrane on Fair Oaks Shops, Building D will finish Wed Oct 14, not Fri Oct 9: materials.')
  })

  it('refuses what the door refuses, and leaves the state as it was', () => {
    const state = initialGcState()
    const refused: GcAction[] = [
      sayLate('fhvac-1', '2026-10-30'),
      sayLate('fplumb-3', '2026-10-14'),
      sayLate('froof-2', '2026-10-14'),
      sayLate('fairoaksd-insp-roughin', '2026-10-20'),
      sayLate(TPO, '2026-10-09'),
      sayLate(TPO, '2026-10-14', 'materials', 'late'),
      sayLate(TPO, '2026-10-14', 'customer' as LookAheadReason),
      sayLate(TPO, 'soon'),
      sayLate(TPO, '2026-10-14', 'materials', NOTE, 'nobody'),
    ]
    for (const action of refused) expect(gcReducer(state, action)).toBe(state)
  })
})

describe('the office’s card', () => {
  it('says what the company said, when it came, and what taking it does', () => {
    const { after } = told()
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
    const curbs = gcReducer(initialGcState(), sayLate(CURBS, '2026-10-07', 'crew', 'Our crew is on another roof until Tuesday.'))
    expect(lateNoticeRows(curbs, job(curbs))[0]).toMatchObject({
      says: 'Says it can start Wed Oct 7, not Mon Oct 5. It would finish Sun Oct 11.',
      sent: 'Sent today, 3 days before its start.',
      ifTaken: 'If you take it: Nothing after it moves. The job still finishes Tue Dec 8.',
    })
    // Two days after the curbs should have started, nobody on the roof: the notice comes late, and says so.
    const later = gcReducer({ ...initialGcState(), today: '2026-10-07' }, sayLate(CURBS, '2026-10-08', 'crew', 'Our crew is on another roof until Thursday.'))
    expect(lateNoticeRows(later, job(later))[0]).toMatchObject({ sent: 'Sent today, 2 days after its start passed.', late: true })
  })

  it('draws the day on the chart as a tail until it is taken', () => {
    const { after } = told()
    expect([...lateNoticeTails(after, job(after))]).toEqual([[TPO, { finish: '2026-10-14', words: 'Summit Roofing says it will finish Wed Oct 14: materials. Not on the dates yet.' }]])
  })

  it('gives Helper 3’s By company list the open notice, in its stable shape', () => {
    const { after } = told()
    expect(openLateNotices(job(after))).toEqual([{ id: 'late-1', partnerId: 'summit', lineId: TPO, day: '2026-10-14', started: true, reason: 'materials', note: NOTE, on: '2026-10-02' }])
    expect(openLateNotices(job(initialGcState()))).toEqual([])
  })
})

describe('Follow up, Needs you and the walk', () => {
  it('puts the open notice on the company, the way another day is', () => {
    const { state, after } = told()
    const summit = projectPeople(after, job(after)).people.find((p) => p.partnerId === 'summit')
    expect(summit?.reasons).toContainEqual({ text: `Says TPO membrane will finish Wed Oct 14, not Fri Oct 9: “${NOTE}”`, tone: 'amber', code: 'late' })
    expect(projectPeople(state, job(state)).people.flatMap((p) => p.reasons).some((r) => r.code === 'late')).toBe(false)
  })

  it('counts the company on the dashboard, and names it there in its own phrase', () => {
    const { state, after } = told()
    // Summit was not on Follow up before: the notice adds it to the count.
    expect(gcNeedsYou(after)?.count).toBe((gcNeedsYou(state)?.count ?? 0) + 1)
    // The detail names the first three people; alone on the job, Summit is the one.
    const alone = { ...after, projects: [job(after)], partners: after.partners.filter((p) => p.id === 'summit'), customers: [] }
    expect(gcNeedsYou(alone)?.detail).toBe('Summit Roofing says it will be late.')
  })

  it('turns red once the day it changes passes with no answer from us', () => {
    const { after } = told()
    const passed = { ...after, today: '2026-10-10' }
    expect(projectPeople(passed, job(passed)).people.find((p) => p.partnerId === 'summit')?.reasons.find((r) => r.code === 'late')?.tone).toBe('red')
  })

  it('tells the walk what the company said, so it is not kept as drawn unread', () => {
    const { state, after } = told()
    const fact = 'Summit Roofing said today it will finish Wed Oct 14: materials.'
    expect(walkItems(after, job(after), new Map()).find((i) => i.lineId === TPO)?.facts).toContain(fact)
    expect(walkItems(state, job(state), new Map()).find((i) => i.lineId === TPO)?.facts).not.toContain(fact)
  })
})

describe('Take: the move carries the notice, its reason and its words', () => {
  function taken() {
    const { after, notice } = told()
    const pending = lateNoticeMove(after, job(after), notice)!
    const moved = gcReducer(after, { type: 'setScheduleActivity', projectId: ID, lineId: pending.lineId, start: pending.start, finish: pending.finish, after: pending.after, why: { ...pending.why, by: 'Robert' }, lateNoticeId: pending.lateNoticeId })
    return { after, notice, pending, moved, move: job(moved).schedule!.moves![0]! }
  }

  it('is ready for Why it moved with the company’s dates, reason and words', () => {
    const { pending } = taken()
    expect(pending).toEqual({
      lineId: TPO,
      start: '2026-09-21',
      finish: '2026-10-14',
      after: ['fsteel-2'],
      why: { reason: 'materials', note: `Summit Roofing told us Fri Oct 2: ${NOTE}` },
      lateNoticeId: 'late-1',
    })
  })

  it('saves an ordinary move that names the notice', () => {
    const { moved, move, notice } = taken()
    expect(move).toMatchObject({ lineId: TPO, reason: 'materials', note: `Summit Roofing told us Fri Oct 2: ${NOTE}`, lateNoticeId: 'late-1', to: { start: '2026-09-21', finish: '2026-10-14' } })
    expect(lateNoticeState(job(moved), notice)).toBe('taken')
    expect(lateNoticeMoveWords(moved, job(moved), move)).toBe('Summit Roofing asked for this Fri Oct 2, 7 days before its finish.')
    expect(portalLateNotice(job(moved), 'summit', TPO)?.state).toBe('taken')
  })

  it('takes it off the card, the chart, Follow up and the walk', () => {
    const { moved } = taken()
    expect(lateNoticeRows(moved, job(moved))).toEqual([])
    expect(lateNoticeTails(moved, job(moved)).size).toBe(0)
    expect(openLateNotices(job(moved))).toEqual([])
    expect(projectPeople(moved, job(moved)).people.flatMap((p) => p.reasons).some((r) => r.code === 'late')).toBe(false)
    expect(walkItems(moved, job(moved), new Map()).flatMap((i) => i.facts).some((f) => f.startsWith('Summit Roofing said'))).toBe(false)
  })

  it('reads like any move to the trades and the customer', () => {
    const { moved, move } = taken()
    expect(companiesToTell(moved, job(moved), [move]).map((c) => c.partner.company).sort()).toEqual(['Cool Breeze Mechanical', 'Summit Roofing'])
    expect(customerChanges(job(moved), moved.today)).toEqual(['Dry-in is 5 days later than planned, because of materials. The finish holds.'])
  })

  it('opens the notice again when the move is undone', () => {
    const { moved, move, notice } = taken()
    const undone = gcReducer(moved, { type: 'undoScheduleMove', projectId: ID, moveId: move.id, by: 'Robert' })
    expect(lateNoticeState(job(undone), notice)).toBe('open')
    expect(lateNoticeRows(undone, job(undone))).toHaveLength(1)
  })

  it('keeps the id only for an open notice on the same bar', () => {
    const { after } = told()
    const curbs = job(after).schedule!.activities.find((a) => a.lineId === CURBS)!
    const elsewhere = gcReducer(after, { type: 'setScheduleActivity', projectId: ID, lineId: CURBS, start: '2026-10-06', finish: '2026-10-10', after: curbs.after, why: { reason: 'crew', note: 'Crew is a day behind.', by: 'Robert' }, lateNoticeId: 'late-1' })
    expect(job(elsewhere).schedule!.moves![0]?.lateNoticeId).toBeUndefined()
    const { moved } = taken()
    const again = gcReducer(moved, { type: 'setScheduleActivity', projectId: ID, lineId: TPO, start: '2026-09-21', finish: '2026-10-15', after: ['fsteel-2'], why: { reason: 'materials', note: 'One more day on the membrane.', by: 'Robert' }, lateNoticeId: 'late-1' })
    expect(job(again).schedule!.moves![0]?.lateNoticeId).toBeUndefined()
  })
})

describe('Push back, and the company’s answer', () => {
  const pushBack = (s: GcState, note = PUSH, by = 'Robert'): GcState => gcReducer(s, { type: 'pushBackLateNotice', projectId: ID, noticeId: 'late-1', note, by })

  it('sends the office’s words to the company and keeps the day', () => {
    const { after, notice } = told()
    const pushed = pushBack(after)
    const n = job(pushed).schedule!.lateNotices![0]!
    expect(n.pushedBack).toEqual({ on: '2026-10-02', by: 'Robert', note: PUSH })
    expect(lateNoticeState(job(pushed), notice)).toBe('pushedBack')
    expect(job(pushed).schedule!.activities).toEqual(job(after).schedule!.activities)
    expect(pushed.log[0]?.text).toBe(`Robert asked Summit Roofing to keep Fri Oct 9 on TPO membrane: “${PUSH}”`)
    expect(lateNoticeRows(pushed, job(pushed))[0]).toMatchObject({ state: 'pushedBack', ifTaken: '', answer: 'We asked them today to keep Fri Oct 9. No answer yet.' })
    expect(lateNoticeTails(pushed, job(pushed)).size).toBe(0)
    expect(lateNoticeMove(pushed, job(pushed), n)).toBeNull()
    expect(projectPeople(pushed, job(pushed)).people.flatMap((p) => p.reasons).some((r) => r.code === 'late')).toBe(false)
  })

  it('asks the company in its portal, in English and Spanish', () => {
    const pushed = pushBack(told().after)
    expect(portalLateNotice(job(pushed), 'summit', TPO)?.state).toBe('pushedBack')
    expect(lateNoticesToAnswer(pushed, 'summit').map((x) => x.work)).toEqual(['TPO membrane'])
    const en = portalHome(pushed, 'summit', 'en').todos.find((t) => t.key.startsWith('late:'))
    expect(en).toMatchObject({ projectId: ID, tone: 'amber', anchor: 'schedule', text: 'Click needs Fri Oct 9 on TPO membrane at Fair Oaks Shops, Building D. Say you will make it, or give another day.' })
    expect(portalHome(pushed, 'summit', 'es').todos.find((t) => t.key.startsWith('late:'))?.text).toBe(
      'Click necesita el vie 9 oct para TPO membrane en Fair Oaks Shops, Building D. Díganos si va a cumplir o denos otra fecha.',
    )
  })

  it('refuses a push back with no sentence, no name, or on a notice not open', () => {
    const { after } = told()
    expect(pushBack(after, 'No.')).toBe(after)
    expect(pushBack(after, PUSH, '  ')).toBe(after)
    const pushed = pushBack(after)
    expect(pushBack(pushed, 'Again, we need the ninth.')).toBe(pushed)
  })

  it('closes when the company says it will make the day', () => {
    const pushed = pushBack(told().after)
    const keep: GcAction = { type: 'tradeKeepDay', projectId: ID, partnerId: 'summit', noticeId: 'late-1' }
    const kept = gcReducer(pushed, keep)
    expect(job(kept).schedule!.lateNotices![0]?.kept).toEqual({ on: '2026-10-02' })
    expect(kept.log[0]?.text).toBe('Summit Roofing will make Fri Oct 9 on TPO membrane at Fair Oaks Shops, Building D.')
    expect(lateNoticeRows(kept, job(kept))[0]).toMatchObject({ state: 'kept', answer: 'They said today they will make Fri Oct 9.' })
    expect(portalLateNotice(job(kept), 'summit', TPO)?.state).toBe('kept')
    expect(portalHome(kept, 'summit').todos.some((t) => t.key.startsWith('late:'))).toBe(false)
    // A second press, another company, or an open notice: nothing.
    expect(gcReducer(kept, keep)).toBe(kept)
    expect(gcReducer(pushed, { ...keep, partnerId: 'coolbreeze' })).toBe(pushed)
    const { after } = told()
    expect(gcReducer(after, keep)).toBe(after)
    // Once its day has passed, the answered row leaves the card: the bar's own state says the rest.
    expect(lateNoticeRows({ ...kept, today: '2026-10-10' }, job(kept))).toEqual([])
  })
})

describe('a newer notice replaces the open one; a bar moved another way closes it', () => {
  it('shows only the newest notice from the company on the bar', () => {
    const { after } = told()
    const again = gcReducer(after, sayLate(TPO, '2026-10-16', 'materials', 'The membrane ships Oct 14 now.'))
    const [newest, first] = job(again).schedule!.lateNotices!
    expect(lateNoticeState(job(again), first!)).toBe('replaced')
    expect(lateNoticeState(job(again), newest!)).toBe('open')
    expect(lateNoticeRows(again, job(again)).map((r) => r.notice.id)).toEqual(['late-2'])
    expect(portalLateNotice(job(again), 'summit', TPO)?.notice.id).toBe('late-2')
  })

  it('closes when the office moves the bar without it', () => {
    const { after, notice } = told()
    const dragged = gcReducer(after, { type: 'setScheduleActivity', projectId: ID, lineId: TPO, start: '2026-09-21', finish: '2026-10-12', after: ['fsteel-2'], why: { reason: 'materials', note: 'We split the difference with Carla.', by: 'Robert' } })
    expect(lateNoticeState(job(dragged), notice)).toBe('moved')
    expect(lateNoticeRows(dragged, job(dragged))).toEqual([])
    expect(portalLateNotice(job(dragged), 'summit', TPO)).toBeNull()
  })
})

describe('what waits on it, for the trade to see before it sends', () => {
  it('names the bars that wait on it directly and would move, its own and another company’s', () => {
    const state = initialGcState()
    expect(lateWaiting(state, job(state), TPO, { start: '2026-09-21', finish: '2026-10-14' })).toEqual([
      { lineId: 'froof-3', work: 'Sheet metal and flashing', company: null, start: '2026-10-15', days: 3 },
      { lineId: 'fhvac-1', work: 'Rooftop units', company: 'Cool Breeze Mechanical', start: '2026-10-15', days: 3 },
    ])
  })

  it('is empty when nothing waiting on it would move', () => {
    const state = initialGcState()
    expect(lateWaiting(state, job(state), CURBS, { start: '2026-10-07', finish: '2026-10-11' })).toEqual([])
  })
})
