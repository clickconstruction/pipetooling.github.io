import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: { rpc: vi.fn() } }))

import { supabase } from './supabase'
import { setJobUncollectible } from './setJobUncollectible'

const rpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>

describe('setJobUncollectible — the client side of set_job_uncollectible', () => {
  beforeEach(() => rpc.mockReset())

  it('marks with the trimmed reason and reads the RPC\'s ok', async () => {
    rpc.mockResolvedValue({ data: { ok: true, flagged: true }, error: null })
    const res = await setJobUncollectible('job-1', true, '  Customer refused the bill and will not answer.  ')
    expect(res).toEqual({ ok: true })
    expect(rpc).toHaveBeenCalledWith('set_job_uncollectible', { p_job_id: 'job-1', p_flagged: true, p_reason: 'Customer refused the bill and will not answer.' })
  })

  it('refuses a short reason before asking the database', async () => {
    const res = await setJobUncollectible('job-1', true, 'no money')
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/Write the reason/)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('unmarks without a reason', async () => {
    rpc.mockResolvedValue({ data: { ok: true, flagged: false }, error: null })
    expect(await setJobUncollectible('job-1', false)).toEqual({ ok: true })
    expect(rpc).toHaveBeenCalledWith('set_job_uncollectible', { p_job_id: 'job-1', p_flagged: false })
  })

  it('surfaces the RPC\'s own refusal and a transport error as plain words', async () => {
    rpc.mockResolvedValue({ data: { error: 'Move the job to Collections first' }, error: null })
    expect(await setJobUncollectible('job-1', true, 'A long enough reason for the row.')).toEqual({ ok: false, error: 'Move the job to Collections first' })
    rpc.mockResolvedValue({ data: null, error: { message: 'network down' } })
    expect(await setJobUncollectible('job-1', false)).toEqual({ ok: false, error: 'network down' })
  })
})
