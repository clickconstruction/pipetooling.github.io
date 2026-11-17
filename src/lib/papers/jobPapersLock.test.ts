import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  JOB_PAPERS_LOCK_WORDS,
  jobShutToUser,
  jobsShutToUser,
  recipientsNotShut,
  refuseShutJob,
  type PapersLockAdmin,
} from '../../../supabase/functions/_shared/jobPapersLock'
import { blankShutShareBlocks, buildShareEmail, SHARE_PAPERS_FIRST_WORDS, type ShareBlockRow } from '../../../supabase/functions/_shared/scheduleShareCore'

// Papers before a job opens, step 5: the lock asked about a named person by the edge functions that read with the
// service role. The database's answer is faked here; the bed in the migration's own test holds the SQL.

type Answer = { data: unknown; error: { message: string } | null }

/** A service-role client whose two lock functions answer from a map of job → the people locked out of it. */
function adminOf(shut: Record<string, string[]>, calls: Array<{ fn: string; args: Record<string, unknown> }> = []): PapersLockAdmin {
  return {
    rpc: (fn, args = {}) => {
      calls.push({ fn, args })
      if (fn === 'job_shut_to_user') return Promise.resolve<Answer>({ data: (shut[String(args.p_job_id)] ?? []).includes(String(args.p_user_id)), error: null })
      if (fn === 'jobs_shut_to_user') return Promise.resolve<Answer>({ data: Object.keys(shut).filter((job) => shut[job]!.includes(String(args.p_user_id))), error: null })
      return Promise.resolve<Answer>({ data: null, error: { message: `no function ${fn}` } })
    },
  }
}

const refusing: PapersLockAdmin = { rpc: () => Promise.resolve<Answer>({ data: null, error: { message: 'function public.job_shut_to_user does not exist' } }) }
const throwing: PapersLockAdmin = { rpc: () => Promise.reject(new Error('network down')) }

afterEach(() => vi.restoreAllMocks())

describe('jobPapersLock: the lock about a named person', () => {
  const admin = adminOf({ 'job-1': ['crew-a', 'crew-b'], 'job-2': ['crew-a'] })

  it('a person who owes the job a paper is locked out, and nobody else', async () => {
    expect(await jobShutToUser(admin, 'job-1', 'crew-a')).toBe(true)
    expect(await jobShutToUser(admin, 'job-2', 'crew-b')).toBe(false)
    expect(await jobShutToUser(admin, 'job-3', 'crew-a')).toBe(false)
  })

  it('no job or no person asks nothing and reads as not locked', async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = []
    const counted = adminOf({ 'job-1': ['crew-a'] }, calls)
    expect(await jobShutToUser(counted, null, 'crew-a')).toBe(false)
    expect(await jobShutToUser(counted, 'job-1', undefined)).toBe(false)
    expect([...(await jobsShutToUser(counted, null))]).toEqual([])
    expect(calls).toEqual([])
  })

  it('the jobs a person is locked out of come back as a set', async () => {
    expect([...(await jobsShutToUser(admin, 'crew-a'))].sort()).toEqual(['job-1', 'job-2'])
    expect([...(await jobsShutToUser(admin, 'office'))]).toEqual([])
  })

  it('the recipients not locked out keep their order', async () => {
    expect(await recipientsNotShut(admin, 'job-1', ['lead', 'crew-b', 'office', 'crew-a'])).toEqual(['lead', 'office'])
    expect(await recipientsNotShut(admin, 'job-2', ['crew-b', 'crew-a'])).toEqual(['crew-b'])
  })

  it('with no job every recipient stays, and nothing is asked', async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = []
    expect(await recipientsNotShut(adminOf({ 'job-1': ['crew-a'] }, calls), null, ['crew-a', 'crew-b'])).toEqual(['crew-a', 'crew-b'])
    expect(calls).toEqual([])
  })

  it('a locked caller is refused with a 403 in the lock’s words, and anyone else carries on', async () => {
    const refusal = await refuseShutJob(admin, 'job-1', 'crew-a', { 'Access-Control-Allow-Origin': '*' })
    expect(refusal?.status).toBe(403)
    expect(refusal?.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(await refusal?.json()).toEqual({ error: JOB_PAPERS_LOCK_WORDS })
    expect(await refuseShutJob(admin, 'job-1', 'office', {})).toBeNull()
  })

  it('fails open: a read the database refuses reads as not locked, with one line logged', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await jobShutToUser(refusing, 'job-1', 'crew-a')).toBe(false)
    expect(log).toHaveBeenCalledTimes(1)
    expect([...(await jobsShutToUser(refusing, 'crew-a'))]).toEqual([])
    expect(await recipientsNotShut(refusing, 'job-1', ['crew-a', 'crew-b'])).toEqual(['crew-a', 'crew-b'])
    expect(await refuseShutJob(refusing, 'job-1', 'crew-a', {})).toBeNull()
  })

  it('fails open: a read that throws reads as not locked', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await jobShutToUser(throwing, 'job-1', 'crew-a')).toBe(false)
    expect([...(await jobsShutToUser(throwing, 'crew-a'))]).toEqual([])
    expect(await recipientsNotShut(throwing, 'job-1', ['crew-a'])).toEqual(['crew-a'])
    expect(log).toHaveBeenCalled()
  })
})

describe('blankShutShareBlocks: the shared schedule board', () => {
  const block = (over: Partial<ShareBlockRow>): ShareBlockRow => ({
    id: 'blk-1',
    job_id: 'job-1',
    assignee_user_id: 'crew-a',
    work_date: '2026-11-18',
    time_start: '07:00:00',
    time_end: '15:00:00',
    note: 'Gate code on the box',
    assignee_name: 'Ana Lead',
    job_hcp_number: '1042',
    job_name: 'Cedar Bluff Lofts',
    job_address: '12 Cedar Bluff',
    ...over,
  })
  const blocks = [block({}), block({ id: 'blk-2', job_id: 'job-2', job_hcp_number: '1058', job_name: 'Repipe estimate', job_address: '410 Elm Grove', note: null })]

  it('with no locked job the board is handed back as it came', () => {
    expect(blankShutShareBlocks(blocks, new Set())).toBe(blocks)
  })

  it('a locked job keeps its number and times and loses its name, address and note', () => {
    const out = blankShutShareBlocks(blocks, new Set(['job-1']))
    expect(out[0]).toEqual({ ...blocks[0], job_name: SHARE_PAPERS_FIRST_WORDS, job_address: null, note: null })
    expect(out[1]).toBe(blocks[1])
    expect(blocks[0]!.job_name).toBe('Cedar Bluff Lofts')
  })

  it('the email names the number and the papers line, never the job', () => {
    const { html, text } = buildShareEmail({ dates: ['2026-11-18'], blocks: blankShutShareBlocks(blocks, new Set(['job-1'])) })
    for (const part of [html, text]) {
      expect(part).toContain(`1042 · ${SHARE_PAPERS_FIRST_WORDS}`)
      expect(part).not.toContain('Cedar Bluff')
      expect(part).not.toContain('Gate code')
      expect(part).toContain('1058 · Repipe estimate')
      expect(part).toContain('410 Elm Grove')
    }
  })
})
