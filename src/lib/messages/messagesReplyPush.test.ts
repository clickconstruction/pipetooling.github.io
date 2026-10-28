import { describe, expect, it } from 'vitest'
import { runReplyPushes, type ReplyPushBody } from '../../../supabase/functions/_shared/messagesReplyPush'
import { REPLY_PUSH_ON_KEY } from './notifyPlan'
import { OFFICE_WAIT_KEY } from './notifyRule'

/**
 * messages-notify's reply push over a fake service-role client (punch list #141 PR 3): the function reads every row of
 * `user_push_hours`, the planner holds whoever is off, the held get a `notification_history` row with `channel = 'held'`
 * and no push, and the office hears at once who is off. Tue Oct 6, 2026 (Chicago, CDT): Luis texted Dana from the job
 * at 8:50, Dana answered at 9:04, the sweep runs at 9:05. Luis is pushed 10 AM to 6 PM on weekdays. Nothing here is a
 * real row.
 */
const LUIS = 'u-luis'
const ROSA = 'u-rosa'
const TOM = 'u-tom'
const LINE = '0f3c1a2b-4d5e-4f60-8a7b-9c0d1e2f3a4b'
const at = (hhmm: string) => `2026-10-06T${String(Number(hhmm.slice(0, 2)) + 5).padStart(2, '0')}:${hhmm.slice(3)}:00.000Z`
const REAL = { is_sample: false, is_digital_twin: false, is_walk_tester: false, archived_at: null }

type Row = Record<string, unknown>
type Tables = Record<string, Row[] | { error: { message: string } }>

const tables = (patch: Partial<Tables> = {}): Tables => ({
  app_settings: [
    { key: REPLY_PUSH_ON_KEY, value_text: 'true', value_num: null },
    { key: OFFICE_WAIT_KEY, value_text: null, value_num: 15 },
  ],
  messages: [
    { id: LINE, contact_id: 'dana', channel: 'text', direction: 'in', at: at('09:04'), body: 'Perfect, thank you. The side gate is unlocked.', subject: null, who_user_id: null },
    { id: 'o-1', contact_id: 'dana', channel: 'text', direction: 'out', at: at('08:50'), body: 'On our way.', subject: null, who_user_id: LUIS },
  ],
  contacts: [{ id: 'dana', kind: 'customer', goes_by: null, customer_id: null, customer_contact_person_id: null, has_user_id: null, has_how: null, has_until: null }],
  users: [
    { id: LUIS, name: 'Luis Ortega', role: 'primary', ...REAL },
    { id: ROSA, name: 'Rosa', role: 'assistant', ...REAL },
    { id: TOM, name: 'Tom', role: 'controller', ...REAL },
  ],
  notification_history: [],
  user_push_hours: [{ user_id: LUIS, days: [1, 2, 3, 4, 5], opens: '10:00', closes: '18:00' }],
  ...patch,
})

/** A service-role client over canned tables: eq, in, gte, match and is filter the rows; maybeSingle takes the first; inserts are kept. */
function fakeAdmin(data: Tables, opts: { refuseHeld?: boolean } = {}) {
  const reads: string[] = []
  const inserted: Array<{ table: string; rows: Row[] }> = []
  const from = (table: string) => {
    reads.push(table)
    const filters: Array<(r: Row) => boolean> = []
    let single = false
    const b: Record<string, unknown> = {}
    b.select = () => b
    b.order = () => b
    b.limit = () => b
    b.eq = (col: string, val: unknown) => (filters.push((r) => r[col] === val), b)
    b.is = (col: string, val: unknown) => (filters.push((r) => (val === null ? r[col] == null : r[col] === val)), b)
    b.in = (col: string, vals: unknown[]) => (filters.push((r) => vals.includes(r[col])), b)
    b.gte = (col: string, val: string) => (filters.push((r) => String(r[col]) >= val), b)
    b.match = (obj: Row) => (filters.push((r) => Object.entries(obj).every(([k, v]) => r[k] === v)), b)
    b.maybeSingle = () => ((single = true), b)
    b.insert = (rows: Row | Row[]) => {
      const list = Array.isArray(rows) ? rows : [rows]
      if (opts.refuseHeld && list.some((r) => r.channel === 'held')) return Promise.resolve({ data: null, error: { message: 'new row for relation "notification_history" violates check constraint "notification_history_channel_check"' } })
      inserted.push({ table, rows: list })
      return Promise.resolve({ data: null, error: null })
    }
    b.then = (resolve: (v: unknown) => unknown) => {
      const t = data[table]
      if (t && !Array.isArray(t)) return resolve({ data: null, error: t.error })
      const rows = (t ?? []).filter((r) => filters.every((f) => f(r)))
      return resolve({ data: single ? (rows[0] ?? null) : rows, error: null })
    }
    return b
  }
  const rpc = async (name: string) => ({ data: name === 'contact_display_name' ? 'Dana Whitfield' : null, error: null })
  return { admin: { from, rpc }, reads, inserted }
}

const sweep: ReplyPushBody = { sweep: true }

describe('messages-notify holds a push for a person’s hours (punch list #141 PR 3)', () => {
  it('reads every push hours row, holds Luis with a held row and no push, and tells the office at once who is off', async () => {
    const { admin, reads, inserted } = fakeAdmin(tables())
    const sends: Array<{ userId: string; body: string }> = []
    const sendTo = async (userId: string, payload: string) => (sends.push({ userId, body: (JSON.parse(payload) as { body: string }).body }), 1)

    const result = await runReplyPushes(admin, sweep, sendTo, at('09:05'))

    expect(result).toEqual({ lines: 1, sent: 1, reached: 2, held: 1, waiting: 2, answered: 0, late: 0 })
    expect(reads).toContain('user_push_hours')
    expect(sends.map((s) => s.userId)).toEqual([ROSA, TOM])
    expect(sends[0]!.body).toBe('Dana wrote to Luis, who is off until 10 AM. Perfect, thank you. The side gate is unlocked.')
    expect(inserted.map((i) => i.table)).toEqual(['notification_history', 'notification_history'])
    expect(inserted[0]!.rows).toEqual([
      expect.objectContaining({ recipient_user_id: ROSA, template_type: 'message_reply_off', channel: 'push', message_id: LINE }),
      expect.objectContaining({ recipient_user_id: TOM, template_type: 'message_reply_off', channel: 'push', message_id: LINE }),
    ])
    expect(inserted[1]!.rows).toEqual([
      { recipient_user_id: LUIS, template_type: 'message_reply', title: 'Dana Whitfield', body_preview: 'Perfect, thank you. The side gate is unlocked.', channel: 'held', message_id: LINE },
    ])
  })

  it('pushes Luis as before once his hours open, with no held row', async () => {
    const { admin, inserted } = fakeAdmin(tables({ user_push_hours: [{ user_id: LUIS, days: [1, 2, 3, 4, 5], opens: '06:00', closes: '20:00' }] }))
    const sends: string[] = []
    const result = await runReplyPushes(admin, sweep, async (userId) => (sends.push(userId), 1), at('09:05'))
    expect(result).toMatchObject({ sent: 1, reached: 1, held: 0 })
    expect(sends).toEqual([LUIS])
    expect(inserted).toHaveLength(1)
    expect(inserted[0]!.rows[0]).toMatchObject({ recipient_user_id: LUIS, template_type: 'message_reply', channel: 'push' })
  })

  it('reads a table not there yet as any time, so a missing migration holds nobody', async () => {
    const { admin } = fakeAdmin(tables({ user_push_hours: { error: { message: 'relation "public.user_push_hours" does not exist' } } }))
    const sends: string[] = []
    const result = await runReplyPushes(admin, sweep, async (userId) => (sends.push(userId), 1), at('09:05'))
    expect(result).toMatchObject({ sent: 1, reached: 1, held: 0 })
    expect(sends).toEqual([LUIS])
  })

  it('never pushes a held line to the person later: the held row counts as sent for its template', async () => {
    const heldAlready = [{ recipient_user_id: LUIS, template_type: 'message_reply', channel: 'held', message_id: LINE }]
    const sentOff = [
      { recipient_user_id: ROSA, template_type: 'message_reply_off', channel: 'push', message_id: LINE },
      { recipient_user_id: TOM, template_type: 'message_reply_off', channel: 'push', message_id: LINE },
    ]
    const { admin, inserted } = fakeAdmin(tables({ notification_history: [...heldAlready, ...sentOff] }))
    const sends: string[] = []
    const result = await runReplyPushes(admin, sweep, async (userId) => (sends.push(userId), 1), at('09:06'))
    expect(result).toMatchObject({ sent: 0, reached: 0, held: 0, waiting: 2 })
    expect(sends).toEqual([])
    expect(inserted).toEqual([])
  })

  it('logs a held row the database refuses, before the migration is on, and still sends the rest', async () => {
    const { admin, inserted } = fakeAdmin(tables(), { refuseHeld: true })
    const sends: string[] = []
    const result = await runReplyPushes(admin, sweep, async (userId) => (sends.push(userId), 1), at('09:05'))
    expect(result).toMatchObject({ sent: 1, reached: 2, held: 1 })
    expect(sends).toEqual([ROSA, TOM])
    expect(inserted.flatMap((i) => i.rows).some((r) => r.channel === 'held')).toBe(false)
  })
})
