import { beforeEach, describe, expect, it, vi } from 'vitest'

/** What the database answers each table's statements in turn, and every call each statement made on its query, in order. */
const db = vi.hoisted(() => ({
  answers: {} as Record<string, Array<{ data: unknown; error: unknown; count?: number | null }>>,
  statements: [] as Array<{ table: string; calls: Array<[string, unknown[]]> }>,
}))

vi.mock('./supabase', () => {
  const builder = (table: string) => {
    const statement = { table, calls: [] as Array<[string, unknown[]]> }
    db.statements.push(statement)
    const b: Record<string, unknown> = new Proxy(
      {},
      {
        get: (_t, op: string) => {
          if (op === 'then') {
            return (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(db.answers[table]?.shift() ?? { data: [], error: null, count: 0 }).then(resolve, reject)
          }
          return (...args: unknown[]) => {
            statement.calls.push([op, args])
            return b
          }
        },
      },
    )
    return b
  }
  return { supabase: { from: (table: string) => builder(table) } }
})

import { GOALS_CHECK_NOT_TAKEN_BACK } from './goalsCheckTakeBack'
import { readGoalsCheckToday, takeGoalsCheckBack } from './goalsCheckTakeBackIo'

const ME = 'user-zz-dev'
const DAYS = ['2026-11-26']
const ok = (data: unknown, count: number | null = null) => ({ data, error: null, count })
const by = (table: string) => db.statements.find((s) => s.table === table)?.calls
const deletes = () => db.statements.filter((s) => s.calls.some(([op]) => op === 'delete'))

beforeEach(() => {
  db.answers = {}
  db.statements.length = 0
})

describe('readGoalsCheckToday', () => {
  it('reads the person’s own record, goals and clock sessions for today, each by their own user id', async () => {
    db.answers = {
      user_daily_goals_ack: [ok([{ local_date: '2026-11-26', completed_at: '2026-11-26T15:14:00Z' }])],
      user_dashboard_goals: [ok(null, 3)],
      clock_sessions: [ok(null, 1)],
    }
    expect(await readGoalsCheckToday(ME, DAYS)).toEqual({ acks: [{ localDate: '2026-11-26', completedAtIso: '2026-11-26T15:14:00Z' }], goals: 3, sessions: 1 })
    expect(by('user_daily_goals_ack')).toEqual([
      ['select', ['local_date, completed_at']],
      ['eq', ['user_id', ME]],
      ['in', ['local_date', DAYS]],
      ['order', ['local_date', { ascending: true }]],
    ])
    expect(by('user_dashboard_goals')).toEqual([
      ['select', ['id', { count: 'exact', head: true }]],
      ['eq', ['user_id', ME]],
    ])
    expect(by('clock_sessions')).toEqual([
      ['select', ['id', { count: 'exact', head: true }]],
      ['eq', ['user_id', ME]],
      ['in', ['work_date', DAYS]],
    ])
    expect(deletes()).toHaveLength(0)
  })
  it('answers no record when the check is not passed', async () => {
    db.answers = { user_daily_goals_ack: [ok([])], user_dashboard_goals: [ok(null, 2)], clock_sessions: [ok(null, 0)] }
    expect(await readGoalsCheckToday(ME, DAYS)).toEqual({ acks: [], goals: 2, sessions: 0 })
  })
  it('throws when a count fails or answers nothing', async () => {
    db.answers = { user_daily_goals_ack: [ok([])], user_dashboard_goals: [{ data: null, error: { message: 'no signal' } }], clock_sessions: [ok(null, 0)] }
    await expect(readGoalsCheckToday(ME, DAYS)).rejects.toEqual({ message: 'no signal' })
    db.answers = { user_daily_goals_ack: [ok([])], user_dashboard_goals: [ok(null, 2)], clock_sessions: [ok(null, null)] }
    await expect(readGoalsCheckToday(ME, DAYS)).rejects.toThrow(/could not be read/)
  })
})

describe('takeGoalsCheckBack', () => {
  it('deletes the person’s own rows for today, once, by their user id and the days', async () => {
    db.answers = { user_daily_goals_ack: [ok([{ local_date: '2026-11-26' }])] }
    expect(await takeGoalsCheckBack(ME, DAYS)).toBe(1)
    expect(db.statements).toHaveLength(1)
    expect(db.statements[0]?.table).toBe('user_daily_goals_ack')
    expect(db.statements[0]?.calls).toEqual([
      ['delete', []],
      ['eq', ['user_id', ME]],
      ['in', ['local_date', DAYS]],
      ['select', ['local_date']],
    ])
  })
  it('names both days when today is two', async () => {
    const two = ['2026-11-26', '2026-11-27']
    db.answers = { user_daily_goals_ack: [ok([{ local_date: '2026-11-26' }, { local_date: '2026-11-27' }])] }
    expect(await takeGoalsCheckBack(ME, two)).toBe(2)
    expect(db.statements[0]?.calls[2]).toEqual(['in', ['local_date', two]])
  })
  it('says so when the delete reaches no row', async () => {
    db.answers = { user_daily_goals_ack: [ok([])] }
    await expect(takeGoalsCheckBack(ME, DAYS)).rejects.toThrow(GOALS_CHECK_NOT_TAKEN_BACK)
  })
  it('sends nothing with no person or no day, so a delete can never run unfiltered', async () => {
    await expect(takeGoalsCheckBack('', DAYS)).rejects.toThrow(GOALS_CHECK_NOT_TAKEN_BACK)
    await expect(takeGoalsCheckBack(ME, [])).rejects.toThrow(GOALS_CHECK_NOT_TAKEN_BACK)
    expect(db.statements).toEqual([])
  })
  it('throws the database’s refusal and does not send the delete twice', async () => {
    db.answers = { user_daily_goals_ack: [{ data: null, error: { message: 'permission denied', code: '42501' } }] }
    await expect(takeGoalsCheckBack(ME, DAYS)).rejects.toBeTruthy()
    expect(deletes()).toHaveLength(1)
  })
})
