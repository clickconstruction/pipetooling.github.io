import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * "Send to Dispatch: add a Customer Pictures folder" — the request a field
 * user files from the Dashboard or Dispatch Mode. The decision kernel has its
 * own suite; this pins the sign-in gate, the two reads, the three outcomes
 * (already linked → retire any orphaned open request; already open; create),
 * the inserted row, the notify call, and the toasts.
 */
type Step = { method: string; args: unknown[] }
const queries: Array<{ table: string; steps: Step[] }> = []
let route: (table: string, steps: Step[]) => { data: unknown; error: { message: string } | null } = () => ({ data: null, error: null })
const invoke = vi.fn(async (_name: string, _opts: unknown) => ({ data: null, error: null }))
vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => {
      const steps: Step[] = []
      queries.push({ table, steps })
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(route(table, steps))
            return (...a: unknown[]) => {
              steps.push({ method: String(prop), args: a })
              return p
            }
          },
        },
      )
      return p
    },
    functions: { invoke: (name: string, opts: unknown) => invoke(name, opts) },
  },
}))
vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => Promise<{ data: unknown; error: { message: string } | null }>) => {
    const r = await op()
    if (r.error) throw new Error(r.error.message)
    return r.data
  },
  formatErrorMessage: (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback),
}))
const changed = vi.fn()
vi.mock('./dispatchRequestHelpers', () => ({ notifyDispatchRequestsChanged: () => changed() }))

import { decidePicturesDispatchRequest, PICTURES_REQUEST_SELF_HEAL_NOTE } from './picturesDispatchRequests'
import { submitLinkJobPicturesDispatchRequestForJob } from './linkJobPicturesDispatchRequest'

const msg = {
  linked: decidePicturesDispatchRequest({ jobPicturesLink: 'x', existingOpenRequestId: null }).message,
  open: decidePicturesDispatchRequest({ jobPicturesLink: null, existingOpenRequestId: 'r' }).message,
  created: decidePicturesDispatchRequest({ jobPicturesLink: null, existingOpenRequestId: null }).message,
}
const toast = vi.fn((_m: string, _t: string) => {})
const isUpdate = (steps: Step[]) => steps.some((s) => s.method === 'update')
const isInsert = (steps: Step[]) => steps.some((s) => s.method === 'insert')
const argsOf = (steps: Step[], m: string) => steps.filter((s) => s.method === m).map((s) => s.args)
const args = { jobId: ' j1 ', hcpNumber: ' 1842 ', jobName: ' Riverside ', jobAddress: ' 1 Main ' }
/** existing open request id, the job's current link, and what the insert returns */
const scenario = (existing: string | null, link: string | null, inserted: { id: string } | null = { id: 'req-new' }) => (table: string, steps: Step[]) => {
  if (table === 'jobs_ledger') return { data: { job_pictures_link: link }, error: null }
  if (table === 'dispatch_requests' && isInsert(steps)) return { data: inserted, error: null }
  if (table === 'dispatch_requests' && isUpdate(steps)) return { data: null, error: null }
  return { data: existing ? { id: existing } : null, error: null }
}
let warn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  queries.length = 0
  toast.mockClear()
  invoke.mockClear()
  changed.mockClear()
  route = scenario(null, null)
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-07T18:00:00Z'))
})
afterEach(() => {
  warn.mockRestore()
  vi.useRealTimers()
})

describe('submitLinkJobPicturesDispatchRequestForJob', () => {
  it('needs a signed-in user and a job id before reading anything', async () => {
    await submitLinkJobPicturesDispatchRequestForJob(null, toast, args)
    expect(toast).toHaveBeenCalledWith('Sign in to send to Dispatch.', 'error')
    await submitLinkJobPicturesDispatchRequestForJob('u1', toast, { ...args, jobId: '   ' })
    expect(queries).toHaveLength(0)
    expect(toast).toHaveBeenCalledTimes(1)
  })

  it('checks for an open request and the job’s current link, then files the request with the HCP-prefixed title and reference summary, notifies Dispatch, and says so', async () => {
    await submitLinkJobPicturesDispatchRequestForJob('u1', toast, args)
    const check = queries.find((q) => q.table === 'dispatch_requests' && !isInsert(q.steps))!
    expect(argsOf(check.steps, 'eq')).toEqual([
      ['job_ledger_id', 'j1'],
      ['pending_action', 'link_job_pictures'],
      ['status', 'open'],
    ])
    expect(check.steps.some((s) => s.method === 'maybeSingle')).toBe(true)
    expect(argsOf(queries.find((q) => q.table === 'jobs_ledger')!.steps, 'eq')).toEqual([['id', 'j1']])
    const insert = queries.find((q) => q.table === 'dispatch_requests' && isInsert(q.steps))!
    expect(argsOf(insert.steps, 'insert')).toEqual([
      [{ from_user_id: 'u1', title: 'Add a Customer Pictures folder for HCP 1842 - Riverside', links: [], job_ledger_id: 'j1', bid_id: null, reference_summary: 'HCP 1842 | Riverside - 1 Main', pending_action: 'link_job_pictures' }],
    ])
    expect(invoke).toHaveBeenCalledWith('notify-dispatch-request', { body: { dispatch_request_id: 'req-new' } })
    expect(changed).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith(msg.created, 'success')
  })

  it('without an HCP or address the title and summary shrink; a blank name reads "Job"', async () => {
    await submitLinkJobPicturesDispatchRequestForJob('u1', toast, { jobId: 'j1', hcpNumber: null, jobName: '  ', jobAddress: undefined })
    const insert = queries.find((q) => q.table === 'dispatch_requests' && isInsert(q.steps))!
    expect(argsOf(insert.steps, 'insert')[0]![0]).toMatchObject({ title: 'Add a Customer Pictures folder for Job', reference_summary: 'Job' })
  })

  it('an open request already on file means no new one, just a note', async () => {
    route = scenario('req-open', null)
    await submitLinkJobPicturesDispatchRequestForJob('u1', toast, args)
    expect(queries.some((q) => isInsert(q.steps))).toBe(false)
    expect(invoke).not.toHaveBeenCalled()
    expect(changed).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith(msg.open, 'info')
  })

  it('a job that already has its pictures link refuses the request — and retires an orphaned open one with the self-heal note', async () => {
    route = scenario(null, 'https://drive.test/pics')
    await submitLinkJobPicturesDispatchRequestForJob('u1', toast, args)
    expect(queries.some((q) => isInsert(q.steps) || isUpdate(q.steps))).toBe(false)
    expect(changed).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith(msg.linked, 'info')

    queries.length = 0
    toast.mockClear()
    route = scenario('req-orphan', 'https://drive.test/pics')
    await submitLinkJobPicturesDispatchRequestForJob('u1', toast, args)
    const close = queries.find((q) => isUpdate(q.steps))!
    expect(argsOf(close.steps, 'update')).toEqual([[{ status: 'closed', closed_at: '2026-09-07T18:00:00.000Z', closed_by_user_id: 'u1', closed_note: PICTURES_REQUEST_SELF_HEAL_NOTE }]])
    expect(argsOf(close.steps, 'eq')).toEqual([
      ['id', 'req-orphan'],
      ['status', 'open'],
    ])
    expect(changed).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith(msg.linked, 'info')
  })

  it('a viewer who cannot close the orphan still gets the note: the failure is logged, never surfaced', async () => {
    route = (table, steps) => (table === 'dispatch_requests' && isUpdate(steps) ? { data: null, error: { message: 'no update rights' } } : scenario('req-orphan', 'https://drive.test/pics')(table, steps))
    await submitLinkJobPicturesDispatchRequestForJob('u1', toast, args)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith(msg.linked, 'info')
    expect(toast).not.toHaveBeenCalledWith(expect.anything(), 'error')
  })

  it('an insert that returns no id, or a failed read, surfaces as an error toast', async () => {
    route = scenario(null, null, null)
    await submitLinkJobPicturesDispatchRequestForJob('u1', toast, args)
    expect(toast).toHaveBeenCalledWith('Could not send to Dispatch.', 'error')
    expect(invoke).not.toHaveBeenCalled()
    toast.mockClear()
    route = (table) => (table === 'jobs_ledger' ? { data: null, error: { message: 'rls' } } : { data: null, error: null })
    await submitLinkJobPicturesDispatchRequestForJob('u1', toast, args)
    expect(toast).toHaveBeenCalledWith('rls', 'error')
  })
})
