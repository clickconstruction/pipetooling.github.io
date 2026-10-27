import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls: Array<{ fn: string; job: string }> = []
vi.mock('../supabase', () => ({
  supabase: {
    rpc: async (fn: string, args: { p_job_id: string }) => {
      calls.push({ fn, job: args.p_job_id })
      if (fn === 'add_job_payment_promise' && args.p_job_id === 'j2') return { error: { message: 'new row violates row-level security policy', code: '42501' } }
      if (fn === 'add_payment_chase_touch' && args.p_job_id === 'j3') return { error: { message: 'timeout', code: '57014' } }
      return { error: null }
    },
  },
}))

import { recordPromiseForJobs, recordPromiseForJobsSettled } from './paymentChaseIo'

beforeEach(() => {
  calls.length = 0
})

const args = { customerId: 'c1', jobYmds: [['j1', '2026-11-01'], ['j2', '2026-11-01'], ['j3', '2026-11-01']] as const }

describe('recordPromiseForJobsSettled — every job is written (punch list #184)', () => {
  it('goes on past a job whose promise fails, and says which and why', async () => {
    const out = await recordPromiseForJobsSettled(args)
    expect(out.saved).toEqual(['j1', 'j3'])
    expect(out.failed.map((f) => f.jobId)).toEqual(['j2'])
    expect(out.failed[0]!.why).toContain('The promise did not save')
    // j3's date took; its chase touch did not.
    expect(out.untouched.map((f) => f.jobId)).toEqual(['j3'])
    // j2's touch was never written: no touch for a promise that did not save.
    expect(calls.filter((c) => c.fn === 'add_payment_chase_touch').map((c) => c.job)).toEqual(['j1', 'j3'])
  })
})

describe('recordPromiseForJobs — the throwing form still writes every job first', () => {
  it('throws after the last job with the count and the first reason', async () => {
    await expect(recordPromiseForJobs(args)).rejects.toThrow(/^The promise did not take on 2 of 3 jobs\. The promise did not save/)
    expect(calls.filter((c) => c.fn === 'add_job_payment_promise').map((c) => c.job)).toEqual(['j1', 'j2', 'j3'])
  })
  it('resolves when every job took', async () => {
    await expect(recordPromiseForJobs({ customerId: 'c1', jobYmds: [['j1', '2026-11-01']] })).resolves.toBeUndefined()
  })
})
