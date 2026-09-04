import { describe, expect, it } from 'vitest'
import {
  groupStatementRoundChains,
  parseStatementRoundPayload,
  planStatementRoundChainEdit,
  statementRoundNudgeFromPayload,
  type StatementRoundRequestRow,
} from './statementRoundEmail'

// 2026-09-07 is a Monday; 12:00Z = 07:00 Central (CDT).
const row = (id: string, sendAt: string, recipient = 'u1', weekly = true): StatementRoundRequestRow => ({
  id,
  requested_by: 'u9',
  recipient_user_id: recipient,
  send_at: sendAt,
  repeat_weekly: weekly,
})

describe('groupStatementRoundChains', () => {
  it('groups weekly chains per recipient by Central weekday, earliest time wins, one-offs skipped', () => {
    const groups = groupStatementRoundChains([
      row('a', '2026-09-07T12:00:00Z'), // Mon 07:00
      row('b', '2026-09-09T12:00:00Z'), // Wed 07:00
      row('c', '2026-09-09T11:30:00Z', 'u1'), // Wed 06:30 (retry double)
      row('d', '2026-09-08T12:00:00Z', 'u2'),
      row('e', '2026-09-10T12:00:00Z', 'u1', false),
    ])
    expect(groups).toHaveLength(2)
    const u1 = groups.find((g) => g.recipientUserId === 'u1')!
    expect(u1.weekdays).toEqual([1, 3])
    expect(u1.timeHm).toBe('06:30')
    expect(u1.rowIdsByWeekday[3]).toEqual(['b', 'c'])
    expect(u1.allRowIds).toEqual(['a', 'b', 'c'])
  })
})

describe('planStatementRoundChainEdit', () => {
  const now = new Date('2026-09-04T15:00:00Z') // Fri 10:00 Central
  it('a new subscription inserts one chain per weekday at the next occurrence', () => {
    const plan = planStatementRoundChainEdit(
      { requestedBy: 'u9', recipientUserId: 'u1', desiredWeekdays: [1, 3], desiredTimeHm: '07:00', current: null },
      now,
    )
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.inserts.map((i) => i.send_at)).toEqual(['2026-09-07T12:00:00.000Z', '2026-09-09T12:00:00.000Z'])
    expect(plan.inserts[0]).toMatchObject({ requested_by: 'u9', recipient_user_id: 'u1', repeat_weekly: true })
    expect(plan.cancelIds).toEqual([])
  })
  it('a weekday change touches only the added/removed days; a time change re-creates all', () => {
    const current = groupStatementRoundChains([row('a', '2026-09-07T12:00:00Z'), row('b', '2026-09-09T12:00:00Z')])[0]!
    const dayEdit = planStatementRoundChainEdit(
      { requestedBy: 'u9', recipientUserId: 'u1', desiredWeekdays: [1, 5], desiredTimeHm: '07:00', current },
      now,
    )
    expect(dayEdit).toMatchObject({ ok: true, cancelIds: ['b'] })
    if (dayEdit.ok) expect(dayEdit.inserts.map((i) => i.send_at)).toEqual(['2026-09-11T12:00:00.000Z'])
    const timeEdit = planStatementRoundChainEdit(
      { requestedBy: 'u9', recipientUserId: 'u1', desiredWeekdays: [1, 3], desiredTimeHm: '08:00', current },
      now,
    )
    expect(timeEdit).toMatchObject({ ok: true, cancelIds: ['a', 'b'] })
    if (timeEdit.ok) expect(timeEdit.inserts).toHaveLength(2)
  })
  it('zero weekdays with nothing current is an error; zero with chains is an unsubscribe', () => {
    expect(planStatementRoundChainEdit({ requestedBy: 'u9', recipientUserId: 'u1', desiredWeekdays: [], desiredTimeHm: '07:00', current: null }, now)).toEqual({
      ok: false,
      error: 'Pick at least one weekday.',
    })
    const current = groupStatementRoundChains([row('a', '2026-09-07T12:00:00Z')])[0]!
    expect(planStatementRoundChainEdit({ requestedBy: 'u9', recipientUserId: 'u1', desiredWeekdays: [], desiredTimeHm: '07:00', current }, now)).toEqual({
      ok: true,
      inserts: [],
      cancelIds: ['a'],
    })
  })
})

describe('round payload → nudge', () => {
  it('parses the RPC shape and sums the ready GCs', () => {
    const p = parseStatementRoundPayload({
      week_start: '2026-08-31',
      user_id: 'u1',
      ready: [
        { gc_id: 'a', gc_name: 'RMC- Dudley Mason', amount: 58221, job_count: 16, oldest_age_days: 172, certified_by_name: 'Robert' },
        { gc_id: 'b', gc_name: 'Knight Contracting', amount: '38036.27', job_count: 4, oldest_age_days: null, certified_by_name: null },
      ],
      held: { count: 4, total: 89000 },
      assigned_to_me: 2,
      sent_by_me: 0,
    })
    expect(p?.ready[1]?.amount).toBe(38036.27)
    expect(statementRoundNudgeFromPayload(p)).toEqual({ count: 2, total: 96257.27, gcNames: ['RMC- Dudley Mason', 'Knight Contracting'] })
  })
  it('null / malformed / empty payloads make no nudge', () => {
    expect(parseStatementRoundPayload(null)).toBeNull()
    expect(parseStatementRoundPayload({ ready: 'x' })).toBeNull()
    expect(statementRoundNudgeFromPayload(parseStatementRoundPayload({ week_start: '2026-08-31', ready: [] }))).toBeNull()
  })
})
