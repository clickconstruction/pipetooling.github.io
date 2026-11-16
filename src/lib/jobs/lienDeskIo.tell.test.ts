import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FunctionsHttpError } from '@supabase/functions-js'

/**
 * The desk's two asks of `notify-lien-approval` (v2.7445): what each sends, and that neither throws. The paper is
 * already sent when the leader is told, so a tell that fails comes back as its reason for the office to read. The
 * notice's ask used to throw, and the send for approval swallowed it.
 */
const net = vi.hoisted(() => ({
  bodies: [] as Array<Record<string, unknown>>,
  answer: { data: null, error: null } as { data: unknown; error: unknown },
  throws: null as unknown,
}))

vi.mock('../supabase', () => ({
  supabase: {
    functions: {
      invoke: async (name: string, opts: { body: Record<string, unknown> }) => {
        net.bodies.push({ fn: name, ...JSON.parse(JSON.stringify(opts.body)) })
        if (net.throws) throw net.throws
        return net.answer
      },
    },
  },
}))

import { tellLeaderOfLienAffidavits, tellLeaderOfLienApproval } from './lienDeskIo'

const refusal = (status: number, error: string) => new FunctionsHttpError(new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json' } }))

beforeEach(() => {
  net.bodies = []
  net.answer = { data: null, error: null }
  net.throws = null
})

describe('telling the leader of a notice', () => {
  it('hands the function the item and the mail-by day, and reads what it answered', async () => {
    net.answer = { data: { success: true, push_sent: 2, email_sent: false, held: 0, leader_name: 'Malachi Whites' }, error: null }
    expect(await tellLeaderOfLienApproval('it1', '2026-12-15')).toEqual({ ok: true, told: { pushSent: 2, emailSent: false, leaderName: 'Malachi Whites', held: 0, said: null, told: null } })
    expect(net.bodies).toEqual([{ fn: 'notify-lien-approval', item_id: 'it1', due_ymd: '2026-12-15' }])
  })

  it('a reminder says it is one, and a send never does', async () => {
    await tellLeaderOfLienApproval('it1', null, { remind: true })
    await tellLeaderOfLienApproval('it1', null)
    expect(net.bodies).toEqual([{ fn: 'notify-lien-approval', item_id: 'it1', remind: true }, { fn: 'notify-lien-approval', item_id: 'it1' }])
  })

  it('carries what the function says when it sent nothing', async () => {
    net.answer = { data: { success: true, push_sent: 0, email_sent: false, message: 'Not awaiting approval' }, error: null }
    expect(await tellLeaderOfLienApproval('it1', null)).toEqual({ ok: true, told: { pushSent: 0, emailSent: false, leaderName: null, held: 0, said: 'Not awaiting approval', told: null } })
  })

  it('a refusal comes back as the function’s own reason, never thrown', async () => {
    net.answer = { data: null, error: refusal(403, 'Not the office') }
    expect(await tellLeaderOfLienApproval('it1', null)).toEqual({ ok: false, reason: 'Not the office' })
  })

  it('a lost signal comes back as a reason, never thrown', async () => {
    net.throws = new TypeError('Failed to fetch')
    const told = await tellLeaderOfLienApproval('it1', null)
    expect(told.ok).toBe(false)
    expect(told.ok ? '' : told.reason).toMatch(/\S/)
  })
})

describe('telling the leader of affidavits', () => {
  it('one call for the lot, with the count the function told the leader of', async () => {
    net.answer = { data: { success: true, push_sent: 1, email_sent: false, held: 0, told: 2, leader_name: 'Malachi Whites' }, error: null }
    expect(await tellLeaderOfLienAffidavits([{ itemId: 'a1', dueYmd: '2026-12-15' }, { itemId: 'a2', dueYmd: null }], { remind: true })).toEqual({ ok: true, told: { pushSent: 1, emailSent: false, leaderName: 'Malachi Whites', held: 0, said: null, told: 2 } })
    expect(net.bodies).toEqual([{ fn: 'notify-lien-approval', kind: 'affidavit', items: [{ item_id: 'a1', due_ymd: '2026-12-15' }, { item_id: 'a2' }], remind: true }])
  })

  it('no papers, no call; a refusal is its reason', async () => {
    expect(await tellLeaderOfLienAffidavits([])).toBeNull()
    expect(net.bodies).toEqual([])
    net.answer = { data: null, error: refusal(400, 'Missing item_id') }
    expect(await tellLeaderOfLienAffidavits([{ itemId: 'a1', dueYmd: null }])).toEqual({ ok: false, reason: 'Missing item_id' })
    expect(net.bodies[0]).not.toHaveProperty('remind')
  })
})
