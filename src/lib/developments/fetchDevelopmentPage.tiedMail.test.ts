import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The read of the mail tied to a site's bids and jobs (v2.7479), against a client that answers like PostgREST.
 * It asks `messages` for emails alone, by the bids and by the jobs, in slices; it reads the people the mail is
 * with; and a failure hands back no mail and its reason, never a throw, so History stands without it.
 */
type Step = { name: string; args: unknown[] }
type Call = { table: string; steps: Step[] }
type Answer = { data: unknown[] | null; error: { message: string; code?: string } | null }

const state: { calls: Call[]; answer: (call: Call) => Answer } = { calls: [], answer: () => ({ data: [], error: null }) }

vi.mock('../supabase', () => {
  const builder = (call: Call) => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'order', 'limit']) {
      b[m] = (...args: unknown[]) => {
        call.steps.push({ name: m, args })
        return b
      }
    }
    b.then = (ok: (v: Answer) => unknown, err?: (e: unknown) => unknown) =>
      Promise.resolve()
        .then(() => state.answer(call))
        .then(ok, err)
    return b
  }
  return {
    supabase: {
      from: (table: string) => {
        const call: Call = { table, steps: [] }
        state.calls.push(call)
        return builder(call)
      },
    },
  }
})

import { readTiedMail } from './fetchDevelopmentPage'
import { TIED_MAIL_COLUMNS } from './history'

const step = (call: Call, name: string) => call.steps.filter((s) => s.name === name).map((s) => s.args)
const ids = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i}`)

beforeEach(() => {
  state.calls = []
  state.answer = () => ({ data: [], error: null })
})

describe('readTiedMail: the emails tied to the site’s bids and jobs', () => {
  it('asks for nothing when the site has no bid and no job', async () => {
    expect(await readTiedMail([], [])).toEqual({ rows: [], contacts: [], files: [], error: null })
    expect(state.calls).toEqual([])
  })

  it('reads emails alone, by the bids and by the jobs, then the people they are with', async () => {
    state.answer = (call) => {
      if (call.table === 'contacts') return { data: [{ id: 'c1', kind: 'customer', name: 'Dana Whitfield', goes_by: null }], error: null }
      if (call.table === 'message_attachments') return { data: [{ message_id: 'm-bid', kind: 'file', bucket_path: 'gm/a.pdf', bid_plan_set_id: null }], error: null }
      const [column] = step(call, 'in')[0] as [string]
      return { data: [column === 'bid_id' ? { id: 'm-bid', contact_id: 'c1', bid_id: 'b1' } : { id: 'm-job', contact_id: 'c1', bid_id: null }], error: null }
    }
    const got = await readTiedMail(['b1'], ['j1', 'j2'])
    expect(got.error).toBeNull()
    expect(got.rows.map((r) => r.id)).toEqual(['m-bid', 'm-job'])
    expect(got.contacts).toEqual([{ id: 'c1', kind: 'customer', name: 'Dana Whitfield', goes_by: null }])
    const mailCalls = state.calls.filter((c) => c.table === 'messages')
    expect(mailCalls).toHaveLength(2)
    for (const c of mailCalls) {
      expect(step(c, 'select')).toEqual([[TIED_MAIL_COLUMNS]])
      // Email alone: a text, a call or a team note tied to the same job is Job activity's, not this look's.
      expect(step(c, 'eq')).toEqual([['channel', 'email']])
    }
    expect(mailCalls.map((c) => step(c, 'in')[0])).toEqual([
      ['bid_id', ['b1']],
      ['jobs_ledger_id', ['j1', 'j2']],
    ])
    // The files are asked for on the bids' mail alone (punch list #368): a job's mail keeps a paper, not a bid's set.
    expect(got.files).toEqual([{ message_id: 'm-bid', kind: 'file', bucket_path: 'gm/a.pdf', bid_plan_set_id: null }])
    expect(state.calls.filter((c) => c.table === 'message_attachments').map((c) => step(c, 'in')[0])).toEqual([['message_id', ['m-bid']]])
    // The people are asked for once, by id, whoever many mails they wrote.
    expect(state.calls.filter((c) => c.table === 'contacts').map((c) => step(c, 'in')[0])).toEqual([['id', ['c1']]])
  })

  it('slices a long list of ids so no one request carries them all', async () => {
    await readTiedMail(ids('b', 230), [])
    const asked = state.calls.filter((c) => c.table === 'messages').map((c) => (step(c, 'in')[0] as [string, string[]])[1].length)
    expect(asked).toEqual([100, 100, 30])
  })

  it('a refused read hands back no mail and its reason, and never throws', async () => {
    state.answer = (call) => (call.table === 'messages' ? { data: null, error: { message: 'permission denied for table messages', code: '42501' } } : { data: [], error: null })
    const got = await readTiedMail(['b1'], ['j1'])
    expect(got.rows).toEqual([])
    expect(got.contacts).toEqual([])
    expect(got.error).toBe("You don't have access to this mail tied to this site.")
  })

  it('the mail still comes when the people’s names do not', async () => {
    state.answer = (call) => (call.table === 'contacts' ? { data: null, error: { message: 'contacts are closed' } } : { data: [{ id: 'm1', contact_id: 'c1' }], error: null })
    const got = await readTiedMail(['b1'], [])
    expect(got.rows.map((r) => r.id)).toEqual(['m1'])
    expect(got.contacts).toEqual([])
    expect(got.error).toBeNull()
  })

  it('the files read again without the kept mark when the database does not have its column yet', async () => {
    state.answer = (call) => {
      if (call.table === 'message_attachments') {
        const cols = String(step(call, 'select')[0]![0])
        return cols.includes('bid_plan_set_id') ? { data: null, error: { message: 'column message_attachments.bid_plan_set_id does not exist', code: '42703' } } : { data: [{ message_id: 'm1', kind: 'file', bucket_path: 'gm/a.pdf' }], error: null }
      }
      return call.table === 'contacts' ? { data: [], error: null } : { data: [{ id: 'm1', contact_id: 'c1', bid_id: 'b1' }], error: null }
    }
    const got = await readTiedMail(['b1'], [])
    expect(got.files).toEqual([{ message_id: 'm1', kind: 'file', bucket_path: 'gm/a.pdf' }])
    expect(state.calls.filter((c) => c.table === 'message_attachments')).toHaveLength(2)
  })

  it('the mail still comes when its files do not', async () => {
    state.answer = (call) => (call.table === 'message_attachments' ? { data: null, error: { message: 'permission denied', code: '42501' } } : call.table === 'contacts' ? { data: [], error: null } : { data: [{ id: 'm1', contact_id: 'c1', bid_id: 'b1' }], error: null })
    const got = await readTiedMail(['b1'], [])
    expect(got.rows.map((r) => r.id)).toEqual(['m1'])
    expect(got.files).toEqual([])
    expect(got.error).toBeNull()
  })
})
