/**
 * The Schedule window's own rules for the office's answers (the schedule's PR 14c), on the test data: Fair Oaks D,
 * today Fri Oct 2, Summit Roofing says its TPO membrane (Sep 21 to Oct 9) will finish Wed Oct 14.
 */
import { describe, expect, it } from 'vitest'
import type { GcState } from '../types'
import { lateNoticeMove } from './lateNotices'
import { crewMark, lateNoticeGone, noticeTakenRefusal, verifiedMark } from './lateWindow'
import { moveRecord, planMove } from './moves'
import { scheduleMeasures, verifyList } from './schedule'
import { initialGcState } from './testState'
import type { LateNotice, ProjectSchedule } from './types'

const ID = 'fairoaksd'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
const NOTICE: LateNotice = {
  id: 'late-1',
  partnerId: 'summit',
  lineId: 'froof-1',
  on: '2026-10-02',
  by: 'Carla Nguyen',
  started: true,
  was: { start: '2026-09-21', finish: '2026-10-09' },
  to: { start: '2026-09-21', finish: '2026-10-14' },
  reason: 'materials',
  note: 'The membrane ships Oct 12. We finish two days after it lands.',
}
const withSchedule = (s: GcState, change: (schedule: ProjectSchedule) => ProjectSchedule): GcState => ({
  ...s,
  projects: s.projects.map((p) => (p.id === ID ? { ...p, schedule: change(p.schedule!) } : p)),
})
const told = (s = initialGcState()) => withSchedule(s, (sc) => ({ ...sc, lateNotices: [NOTICE] }))

describe('a late notice someone answered first', () => {
  it('knows the database’s refusal of a notice taken already, and nothing else', () => {
    expect(noticeTakenRefusal(new Error('That late notice was taken already.'))).toBe(true)
    expect(noticeTakenRefusal({ message: 'That late notice was taken already.', code: 'P0001' })).toBe(true)
    expect(noticeTakenRefusal(new Error('That late notice is not on this bar.'))).toBe(false)
    expect(noticeTakenRefusal(null)).toBe(false)
  })

  it('is open until a move takes it, and gone after, or once pushed back', () => {
    const s = told()
    expect(lateNoticeGone(job(s), 'late-1')).toBe(false)
    const pending = lateNoticeMove(s, job(s), NOTICE)!
    const plan = planMove(job(s), pending.lineId, pending.start, pending.finish, pending.after)!
    const move = moveRecord(job(s).schedule!, pending.lineId, plan, { ...pending.why, by: 'Robert' }, s.today, undefined, pending.lateNoticeId)
    const moved = withSchedule(s, (sc) => ({ ...sc, activities: plan.activities, moves: [move, ...(sc.moves ?? [])] }))
    expect(lateNoticeGone(job(moved), 'late-1')).toBe(true)
    const pushed = withSchedule(s, (sc) => ({ ...sc, lateNotices: [{ ...NOTICE, pushedBack: { on: s.today, by: 'Robert', note: 'We need the day as drawn.' } }] }))
    expect(lateNoticeGone(job(pushed), 'late-1')).toBe(true)
    expect(lateNoticeGone(job(s), 'late-2')).toBe(true)
  })
})

describe('our superintendent’s check', () => {
  const s = initialGcState()
  const { waiting } = verifyList(job(s), scheduleMeasures(s, job(s)).rows, s.today)
  const said = (lineId: string) => waiting.find((w) => w.mark.lineId === lineId)!.mark

  it('checks a trade’s mark as it stands, today, with no correction', () => {
    expect(verifiedMark(said('froof-1'), true, null, s.today)).toEqual({ ...said('froof-1'), verifiedOn: '2026-10-02' })
    expect(verifiedMark(said('fsteel-3'), false, 'weather', s.today)).toEqual({ ...said('fsteel-3'), verifiedOn: '2026-10-02' })
  })

  it('corrects a “done” to not done with why, and a “not done” to done with none', () => {
    expect(verifiedMark(said('froof-1'), false, 'weather', s.today)).toEqual({ ...said('froof-1'), verifiedOn: '2026-10-02', verifiedDone: false, verifiedReason: 'weather' })
    expect(verifiedMark(said('fsteel-3'), true, 'weather', s.today)).toEqual({ ...said('fsteel-3'), verifiedOn: '2026-10-02', verifiedDone: true })
  })

  it('marks our own crew’s work for the week, checked the day it is made, why only when not done', () => {
    const row = scheduleMeasures(s, job(s)).rows.find((r) => r.pkg.selfPerform)!
    expect(crewMark(row, '2026-09-28', true, 'crew', s.today)).toEqual({ weekOf: '2026-09-28', lineId: row.activity.lineId, packageId: row.pkg.id, done: true, markedOn: '2026-10-02', verifiedOn: '2026-10-02' })
    expect(crewMark(row, '2026-09-28', false, 'crew', s.today)).toMatchObject({ done: false, reason: 'crew', verifiedOn: '2026-10-02' })
  })
})
