import { describe, expect, it } from 'vitest'
import { heldRows, loadPushHours, pushPayload, sendPushHonouringHours, sentRows, splitPush, type HoursPush } from '../../../supabase/functions/_shared/pushHoursSend'
import { parsePushHours } from './pushHours'

/**
 * The other senders' one door through a person's hours (punch list #141 PR 5): the hours read once, the people split
 * at now, the people on pushed, the people off given a held row and no push, the caller's choice of record. Tue Oct 6,
 * 2026 (Chicago, CDT), 9:05 PM: Luis is pushed weekdays 6 AM to 8 PM, so he is off; Rosa has no row; Tom's row does
 * not read. Nothing here is a real row.
 */
const LUIS = 'u-luis'
const ROSA = 'u-rosa'
const TOM = 'u-tom'
/** Chicago (CDT, UTC-5) on Tue Oct 6, 2026, as ISO; `day` moves it. */
const at = (hhmm: string, day = 6) => new Date(Date.UTC(2026, 9, day, Number(hhmm.slice(0, 2)) + 5, Number(hhmm.slice(3)))).toISOString()
const NOW = at('21:05')

const HOURS_ROWS = [
  { user_id: LUIS, days: [1, 2, 3, 4, 5], opens: '06:00', closes: '20:00' },
  { user_id: TOM, days: [], opens: '06:00', closes: '20:00' },
]

const push: HoursPush = {
  userIds: [LUIS, ROSA, TOM],
  title: 'Task Dispatch',
  body: 'Evan: Bring the big snake to 4120 Oak. It is a long one, so the words run past two hundred characters when the office types the whole story out and the row keeps the first two hundred of them only for the preview.',
  url: '/dashboard',
  tag: 'dispatch-1',
  templateType: 'dispatch_request',
}

type Row = Record<string, unknown>

/** A service-role client over canned tables: the hours table as given, every insert kept. */
function fakeAdmin(hours: Row[] | { error: { message: string } } | 'throws') {
  const reads: string[] = []
  const inserted: Array<{ table: string; rows: Row[] }> = []
  let refuse: string | null = null
  const from = (table: string) => {
    reads.push(table)
    const b: Record<string, unknown> = {}
    b.select = () => {
      if (table === 'user_push_hours' && hours === 'throws') throw new Error('relation "user_push_hours" does not exist')
      return b
    }
    b.insert = (rows: Row | Row[]) => {
      if (refuse) return Promise.resolve({ data: null, error: { message: refuse } })
      inserted.push({ table, rows: Array.isArray(rows) ? rows : [rows] })
      return Promise.resolve({ data: null, error: null })
    }
    b.then = (resolve: (v: unknown) => unknown) => {
      if (table !== 'user_push_hours') return resolve({ data: [], error: null })
      if (!Array.isArray(hours)) return resolve({ data: null, error: (hours as { error: { message: string } }).error })
      return resolve({ data: hours, error: null })
    }
    return b
  }
  return { admin: { from }, reads, inserted, refuseWrites: (why: string) => (refuse = why) }
}

const hoursOf = (rows: Row[]) => new Map(rows.map((r) => [r.user_id as string, parsePushHours(r)]))

describe('the kernel: the split and the rows', () => {
  it('splits the people at now: a person off is held with when they are back, no row or a row that does not read is pushed', () => {
    const out = splitPush(push, hoursOf(HOURS_ROWS), NOW)
    expect(out.send).toEqual([ROSA, TOM])
    expect(out.held).toEqual([{ userId: LUIS, backAt: at('06:00', 7) }])
  })

  it('writes the push as it would have gone, channel held, the preview cut at two hundred, the extra columns beside', () => {
    const rows = heldRows({ ...push, extra: { checklist_instance_id: 'ci-1' } }, [{ userId: LUIS, backAt: null }])
    expect(rows).toEqual([
      {
        checklist_instance_id: 'ci-1',
        recipient_user_id: LUIS,
        template_type: 'dispatch_request',
        title: 'Task Dispatch',
        body_preview: push.body.slice(0, 200),
        channel: 'held',
      },
    ])
    expect(rows[0]!.body_preview).toHaveLength(200)
    expect(sentRows(push, [ROSA, TOM]).map((r) => [r.recipient_user_id, r.channel])).toEqual([
      [ROSA, 'push'],
      [TOM, 'push'],
    ])
    expect(heldRows(push, [])).toEqual([])
  })

  it('the payload carries the four fields the service worker reads', () => {
    expect(JSON.parse(pushPayload(push))).toEqual({ title: 'Task Dispatch', body: push.body, url: '/dashboard', tag: 'dispatch-1' })
  })
})

describe('loadPushHours reads every row once, fail-soft', () => {
  it('reads the rows by user id, a row that does not read as any time', async () => {
    const { admin } = fakeAdmin(HOURS_ROWS)
    const hours = await loadPushHours(admin, () => {})
    expect(hours.get(LUIS)).toMatchObject({ days: [1, 2, 3, 4, 5], opens: '06:00', closes: '20:00' })
    expect(hours.get(TOM)).toBeNull()
    expect(hours.has(ROSA)).toBe(false)
  })

  it('a read that fails, or a table not there yet, holds nobody and says so', async () => {
    const said: string[] = []
    expect((await loadPushHours(fakeAdmin({ error: { message: 'relation "user_push_hours" does not exist' } }).admin, (m) => said.push(m))).size).toBe(0)
    expect((await loadPushHours(fakeAdmin('throws').admin, (m) => said.push(m))).size).toBe(0)
    expect(said).toHaveLength(2)
    expect(said[0]).toContain('user_push_hours')
  })
})

describe('sendPushHonouringHours', () => {
  it('reads the hours, pushes the people on, holds Luis with a row and no push, and records the sent', async () => {
    const { admin, reads, inserted } = fakeAdmin(HOURS_ROWS)
    const sends: Array<{ userId: string; payload: string }> = []
    const result = await sendPushHonouringHours(admin, push, async (userId, payload) => (sends.push({ userId, payload }), userId === TOM ? 2 : 1), { now: NOW })

    expect(reads).toEqual(['user_push_hours', 'notification_history'])
    expect(sends.map((s) => s.userId)).toEqual([ROSA, TOM])
    expect(JSON.parse(sends[0]!.payload)).toMatchObject({ title: 'Task Dispatch', tag: 'dispatch-1' })
    expect(result).toEqual({ sent: [ROSA, TOM], noDevice: [], held: [{ userId: LUIS, backAt: expect.any(String) }], devices: 3 })
    expect(inserted).toHaveLength(1)
    expect(inserted[0]!.rows.map((r) => [r.recipient_user_id, r.channel])).toEqual([
      [ROSA, 'push'],
      [TOM, 'push'],
      [LUIS, 'held'],
    ])
  })

  it('a person on with no device is named for the caller’s fallback and gets no row', async () => {
    const { admin, inserted } = fakeAdmin(HOURS_ROWS)
    const result = await sendPushHonouringHours(admin, push, async (userId) => (userId === ROSA ? 1 : 0), { now: NOW })
    expect(result.sent).toEqual([ROSA])
    expect(result.noDevice).toEqual([TOM])
    expect(inserted[0]!.rows.map((r) => r.recipient_user_id)).toEqual([ROSA, LUIS])
  })

  it('record none leaves the sent rows to the caller; the held rows still go', async () => {
    const { admin, inserted } = fakeAdmin(HOURS_ROWS)
    const result = await sendPushHonouringHours(admin, push, async () => 1, { now: NOW, record: 'none' })
    expect(result.sent).toEqual([ROSA, TOM])
    expect(inserted).toHaveLength(1)
    expect(inserted[0]!.rows).toEqual([expect.objectContaining({ recipient_user_id: LUIS, channel: 'held' })])
  })

  it('no sender (no VAPID keys): nobody is pushed, the held rows still go, the people on read as no device', async () => {
    const { admin, inserted } = fakeAdmin(HOURS_ROWS)
    const result = await sendPushHonouringHours(admin, push, null, { now: NOW })
    expect(result).toEqual({ sent: [], noDevice: [ROSA, TOM], held: [{ userId: LUIS, backAt: expect.any(String) }], devices: 0 })
    expect(inserted[0]!.rows).toEqual([expect.objectContaining({ recipient_user_id: LUIS, channel: 'held' })])
  })

  it('takes the hours the caller read once, so a run of many pushes reads the table once', async () => {
    const { admin, reads } = fakeAdmin(HOURS_ROWS)
    const hours = hoursOf(HOURS_ROWS)
    await sendPushHonouringHours(admin, push, async () => 1, { now: NOW, hours })
    await sendPushHonouringHours(admin, { ...push, tag: 'dispatch-2' }, async () => 1, { now: NOW, hours })
    expect(reads.filter((t) => t === 'user_push_hours')).toEqual([])
  })

  it('the same person named twice is decided once; a payload per person when the words differ by person', async () => {
    const { admin } = fakeAdmin(HOURS_ROWS)
    const sends: Array<[string, string]> = []
    const result = await sendPushHonouringHours(
      admin,
      { ...push, userIds: [ROSA, ROSA, TOM], payloadFor: (id) => JSON.stringify({ body: id === TOM ? '$1,200' : 'a bill' }) },
      async (userId, payload) => (sends.push([userId, JSON.parse(payload).body]), 1),
      { now: NOW },
    )
    expect(result.sent).toEqual([ROSA, TOM])
    expect(sends).toEqual([
      [ROSA, 'a bill'],
      [TOM, '$1,200'],
    ])
  })

  it('a refused write is said and does not stop the run', async () => {
    const f = fakeAdmin(HOURS_ROWS)
    f.refuseWrites('new row violates check constraint "notification_history_channel_check"')
    const said: string[] = []
    const result = await sendPushHonouringHours(f.admin, push, async () => 1, { now: NOW, log: (m) => said.push(m) })
    expect(result.sent).toEqual([ROSA, TOM])
    expect(said).toEqual([expect.stringContaining('notification_history write error (dispatch_request)')])
  })

  it('nothing to write when everyone is on and the caller keeps the record', async () => {
    const { admin, inserted } = fakeAdmin([])
    await sendPushHonouringHours(admin, push, async () => 1, { now: NOW, record: 'none' })
    expect(inserted).toEqual([])
  })
})
