import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * IO for Job Follow-Up Mode. The candidates cache has its own suite
 * (jobFollowupStore.cache.test.ts); this pins everything else: the settings
 * row mapping, each read's filters and shape, the write payloads, the
 * candidate merge with the activity RPC, and that every read degrades to
 * defaults / empty instead of throwing.
 */
type Step = { method: string; args: unknown[] }
const calls: Array<{ kind: 'from' | 'rpc'; name: string; args: unknown[]; steps: Step[] }> = []
let route: (kind: 'from' | 'rpc', name: string, steps: Step[]) => unknown = () => []
function recorder(kind: 'from' | 'rpc', name: string, args: unknown[]) {
  const steps: Step[] = []
  calls.push({ kind, name, args, steps })
  const p: unknown = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') {
          return (resolve: (v: { data: unknown; error: null }) => void, reject: (e: unknown) => void) => {
            try {
              resolve({ data: route(kind, name, steps), error: null })
            } catch (e) {
              reject(e)
            }
          }
        }
        return (...a: unknown[]) => {
          steps.push({ method: String(prop), args: a })
          return p
        }
      },
    },
  )
  return p
}
vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => recorder('from', table, []),
    rpc: (fn: string, args: unknown) => recorder('rpc', fn, [args]),
  },
}))
vi.mock('../../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => Promise<{ data: unknown; error: null }>) => (await op()).data,
}))

import { DEFAULT_JOB_FOLLOWUP_SETTINGS, JOB_FOLLOWUP_STAGES } from './jobFollowupQueue'
import {
  deleteLatestJobFollowupReview,
  fetchJobFollowupCandidates,
  fetchJobFollowupJobLabels,
  fetchJobFollowupReviewerNames,
  fetchJobFollowupReviews,
  fetchJobFollowupSettings,
  followupSettingsFromRow,
  followupSettingsToRow,
  invalidateJobFollowupCandidatesCache,
  recordJobFollowupReview,
  saveJobFollowupSettings,
} from './jobFollowupStore'

const table = (name: string) => calls.filter((c) => c.kind === 'from' && c.name === name)
const argsOf = (steps: Step[], m: string) => steps.filter((s) => s.method === m).map((s) => s.args)
const row = { working_days: 3, waiting_days: 5, ready_to_bill_days: 2, billed_days: 7, collections_days: 4, rest_days: 1 }
const settings = { workingDays: 3, waitingDays: 5, readyToBillDays: 2, billedDays: 7, collectionsDays: 4, restDays: 1 }

beforeEach(() => {
  calls.length = 0
  route = () => []
  invalidateJobFollowupCandidatesCache()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-07T18:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('settings', () => {
  it('maps the row both ways, and a missing row means the defaults', () => {
    expect(followupSettingsFromRow(row)).toEqual(settings)
    expect(followupSettingsToRow(settings)).toEqual(row)
    expect(followupSettingsFromRow(null)).toBe(DEFAULT_JOB_FOLLOWUP_SETTINGS)
    expect(followupSettingsFromRow(undefined)).toBe(DEFAULT_JOB_FOLLOWUP_SETTINGS)
  })
  it('fetches the single settings row, and falls back to the defaults on an empty table or a failed read', async () => {
    route = () => [row]
    expect(await fetchJobFollowupSettings()).toEqual(settings)
    expect(argsOf(table('job_followup_settings')[0]!.steps, 'limit')).toEqual([[1]])
    route = () => []
    expect(await fetchJobFollowupSettings()).toBe(DEFAULT_JOB_FOLLOWUP_SETTINGS)
    route = () => {
      throw new Error('rls')
    }
    expect(await fetchJobFollowupSettings()).toBe(DEFAULT_JOB_FOLLOWUP_SETTINGS)
  })
  it('saves the one row with the columns, a timestamp and who saved it; a failed save throws', async () => {
    await saveJobFollowupSettings(settings, 'u1')
    const q = table('job_followup_settings')[0]!
    expect(argsOf(q.steps, 'update')).toEqual([[{ ...row, updated_at: '2026-09-07T18:00:00.000Z', updated_by: 'u1' }]])
    expect(argsOf(q.steps, 'eq')).toEqual([['id', true]])
    route = () => {
      throw new Error('read only')
    }
    await expect(saveJobFollowupSettings(settings, null)).rejects.toThrow('read only')
  })
})

describe('reviews and history', () => {
  it('reads the newest 5,000 reviews and maps them; a failed read is an empty list', async () => {
    route = () => [{ job_id: 'j1', reviewed_at: '2026-09-06T10:00:00Z', snoozed_until: '2026-09-10', reviewed_by: 'u1' }, { job_id: 'j2', reviewed_at: '2026-09-05T10:00:00Z', snoozed_until: null, reviewed_by: null }]
    expect(await fetchJobFollowupReviews()).toEqual([
      { jobId: 'j1', reviewedAt: '2026-09-06T10:00:00Z', snoozedUntil: '2026-09-10', reviewedBy: 'u1' },
      { jobId: 'j2', reviewedAt: '2026-09-05T10:00:00Z', snoozedUntil: null, reviewedBy: null },
    ])
    const q = table('job_followup_reviews')[0]!
    expect(argsOf(q.steps, 'order')).toEqual([['reviewed_at', { ascending: false }]])
    expect(argsOf(q.steps, 'limit')).toEqual([[5000]])
    route = () => {
      throw new Error('rls')
    }
    expect(await fetchJobFollowupReviews()).toEqual([])
  })
  it('reviewer names: nothing asked for no ids, unnamed users skipped, failure → empty', async () => {
    expect(await fetchJobFollowupReviewerNames([])).toEqual({})
    expect(calls).toHaveLength(0)
    route = () => [{ id: 'u1', name: 'Ana' }, { id: 'u2', name: null }]
    expect(await fetchJobFollowupReviewerNames(['u1', 'u2'])).toEqual({ u1: 'Ana' })
    expect(argsOf(table('users')[0]!.steps, 'in')).toEqual([['id', ['u1', 'u2']]])
    route = () => {
      throw new Error('rls')
    }
    expect(await fetchJobFollowupReviewerNames(['u1'])).toEqual({})
  })
  it('job labels: "HCP · name", nothing asked for no ids, failure → empty', async () => {
    expect(await fetchJobFollowupJobLabels([])).toEqual({})
    route = () => [{ id: 'j1', hcp_number: '1842', job_name: 'Riverside' }]
    expect(await fetchJobFollowupJobLabels(['j1'])).toEqual({ j1: '1842 · Riverside' })
    expect(argsOf(table('jobs_ledger')[0]!.steps, 'in')).toEqual([['id', ['j1']]])
    route = () => {
      throw new Error('rls')
    }
    expect(await fetchJobFollowupJobLabels(['j1'])).toEqual({})
  })
  it('recording a review inserts the job, the reviewer and the snooze; a failed insert throws', async () => {
    await recordJobFollowupReview('j1', 'u1', '2026-09-10')
    expect(argsOf(table('job_followup_reviews')[0]!.steps, 'insert')).toEqual([[{ job_id: 'j1', reviewed_by: 'u1', snoozed_until: '2026-09-10' }]])
    route = () => {
      throw new Error('read only')
    }
    await expect(recordJobFollowupReview('j1', null, null)).rejects.toThrow('read only')
  })
  it('un-review deletes only the newest review of the job, reports false when there is none or the read fails', async () => {
    route = (_kind, name, steps) => (name === 'job_followup_reviews' && steps.some((s) => s.method === 'select') ? [{ id: 'r-new' }] : [])
    expect(await deleteLatestJobFollowupReview('j1')).toBe(true)
    const [find, del] = table('job_followup_reviews')
    expect(argsOf(find!.steps, 'eq')).toEqual([['job_id', 'j1']])
    expect(argsOf(find!.steps, 'order')).toEqual([['reviewed_at', { ascending: false }]])
    expect(argsOf(find!.steps, 'limit')).toEqual([[1]])
    expect(del!.steps.some((s) => s.method === 'delete')).toBe(true)
    expect(argsOf(del!.steps, 'eq')).toEqual([['id', 'r-new']])

    calls.length = 0
    route = () => []
    expect(await deleteLatestJobFollowupReview('j1')).toBe(false)
    expect(table('job_followup_reviews')).toHaveLength(1) // no delete issued
    route = () => {
      throw new Error('rls')
    }
    expect(await deleteLatestJobFollowupReview('j1')).toBe(false)
  })
})

describe('candidates (uncached)', () => {
  const jobs = [
    { id: 'j1', hcp_number: '1842', job_name: 'Riverside', job_address: '1 Main', status: 'working', customer_name: 'Acme', pct_complete: 40, revenue: 1000, payments_made: 250 },
    { id: 'j2', hcp_number: '1843', job_name: 'Elm', job_address: '2 Elm', status: 'billed', customer_name: null, pct_complete: null, revenue: null, payments_made: null },
  ]
  it('reads the open-stage jobs and the activity RPC for today, and merges activity onto each job', async () => {
    route = (kind) => (kind === 'rpc' ? [{ job_id: 'j1', latest_activity_at: '2026-09-01T10:00:00Z', next_scheduled_on: '2026-09-12' }] : jobs)
    const out = await fetchJobFollowupCandidates('2026-09-07', { force: true })
    expect(argsOf(table('jobs_ledger')[0]!.steps, 'in')).toEqual([['status', JOB_FOLLOWUP_STAGES]])
    const rpc = calls.find((c) => c.kind === 'rpc')!
    expect(rpc.name).toBe('list_job_followup_activity')
    expect(rpc.args).toEqual([{ p_today: '2026-09-07' }])
    expect(out).toEqual([
      { id: 'j1', stage: 'working', hcpNumber: '1842', jobName: 'Riverside', address: '1 Main', customerName: 'Acme', pctComplete: 40, revenue: 1000, paymentsMade: 250, latestActivityAt: '2026-09-01T10:00:00Z', nextScheduledOn: '2026-09-12' },
      // No activity row: treated as active right now so it never reads "quiet forever".
      { id: 'j2', stage: 'billed', hcpNumber: '1843', jobName: 'Elm', address: '2 Elm', customerName: null, pctComplete: null, revenue: null, paymentsMade: null, latestActivityAt: '2026-09-07T18:00:00.000Z', nextScheduledOn: null },
    ])
  })
  it('a failed activity RPC (migration not applied yet) still yields the jobs, all active now; a failed jobs read throws', async () => {
    route = (kind) => {
      if (kind === 'rpc') throw new Error('function does not exist')
      return jobs
    }
    const out = await fetchJobFollowupCandidates('2026-09-07', { force: true })
    expect(out.map((c) => c.latestActivityAt)).toEqual(['2026-09-07T18:00:00.000Z', '2026-09-07T18:00:00.000Z'])
    route = () => {
      throw new Error('rls')
    }
    await expect(fetchJobFollowupCandidates('2026-09-07', { force: true })).rejects.toThrow('rls')
  })
})
