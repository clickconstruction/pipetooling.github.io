import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = vi.hoisted(() => ({ inserts: [] as unknown[], updates: [] as Array<{ table: string; patch: unknown; id: string }>, invoked: [] as unknown[], emailOk: true, insertError: null as null | { message: string } }))
vi.mock('../supabase', () => {
  const builder = (table: string) => ({
    insert: (row: unknown) => {
      calls.inserts.push({ table, row })
      return { select: () => ({ single: () => Promise.resolve(calls.insertError ? { data: null, error: calls.insertError } : { data: { id: 'm-reply' }, error: null }) }) }
    },
    update: (patch: unknown) => ({
      eq: (_k: string, id: string) => ({ eq: () => { calls.updates.push({ table, patch, id }); return Promise.resolve({ error: null }) } }),
    }),
  })
  return {
    supabase: {
      from: builder,
      functions: { invoke: (fn: string, opts: unknown) => { calls.invoked.push({ fn, opts }); return Promise.resolve(calls.emailOk ? { data: { ok: true }, error: null } : { data: { error: 'no address' }, error: null }) } },
    },
  }
})
vi.stubGlobal('window', { location: { origin: 'https://clicktooling.com' } })

import { inboxRowOf, replyToRoom } from './replyToRoom'

const ask = { id: 'm-ask', submittalId: 'rev-2', tags: ['DWH-1'], metadata: { inbox: 'estimator', request_id: 'req-1' } }

describe('replyToRoom (stage 5a)', () => {
  beforeEach(() => {
    calls.inserts.length = 0
    calls.updates.length = 0
    calls.invoked.length = 0
    calls.emailOk = true
    calls.insertError = null
  })

  it('writes the office reply, emails the person, and closes the inbox row with the reply as the note', async () => {
    const r = await replyToRoom({ roomId: 'room-1', ask, body: '  Yes — same footprint.  ', authorUserId: 'u-wendi' })
    expect(r).toEqual({ messageId: 'm-reply', emailed: true, emailError: null, closedRequest: true })
    expect(calls.inserts[0]).toMatchObject({ table: 'bid_submittal_messages', row: { room_id: 'room-1', submittal_id: 'rev-2', author_kind: 'office', author_user_id: 'u-wendi', body: 'Yes — same footprint.', kind: 'reply', tags: ['DWH-1'], metadata: { answers_message_id: 'm-ask' } } })
    expect(calls.invoked[0]).toMatchObject({ fn: 'send-submittal-reply-email', opts: { body: { message_id: 'm-reply' } } })
    expect(calls.updates[0]).toMatchObject({ table: 'estimator_requests', id: 'req-1', patch: { status: 'closed', closed_note: 'Yes — same footprint.', closed_by_user_id: 'u-wendi' } })
  })

  it('a failed email leaves the reply on the thread and says so; no inbox row means nothing to close', async () => {
    calls.emailOk = false
    const r = await replyToRoom({ roomId: 'room-1', ask: { ...ask, metadata: {} }, body: 'Yes', authorUserId: null })
    expect(r.emailed).toBe(false)
    expect(r.emailError).toBe('no address')
    expect(r.closedRequest).toBe(false)
    expect(calls.updates).toHaveLength(0)
  })

  it('refuses an empty answer and surfaces the insert error', async () => {
    await expect(replyToRoom({ roomId: 'r', ask, body: '   ', authorUserId: null })).rejects.toThrow('Write the answer first.')
    calls.insertError = { message: 'permission denied' }
    await expect(replyToRoom({ roomId: 'r', ask, body: 'x', authorUserId: null })).rejects.toMatchObject({ message: 'permission denied' })
  })

  it('reads the inbox row out of the ask metadata', () => {
    expect(inboxRowOf({ inbox: 'dispatch', request_id: 'r1' })).toEqual({ inbox: 'dispatch', requestId: 'r1' })
    expect(inboxRowOf({ inbox: 'mail', request_id: 'r1' })).toBeNull()
    expect(inboxRowOf(null)).toBeNull()
  })
})
