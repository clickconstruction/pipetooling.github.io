import { describe, expect, it } from 'vitest'
import {
  BACKFILL_BATCH_DEFAULT,
  BACKFILL_BATCH_MAX,
  BACKFILL_JOBS_MAX,
  backfillAfterFilter,
  backfillApplyReply,
  backfillBatch,
  backfillCommitment,
  backfillJobPassedReply,
  backfillJobsQuery,
  backfillPlanReply,
  cursorLostWords,
  nextBackfillJob,
  parseBackfillPlan,
  statusReading,
  type BackfillJob,
} from '../../../supabase/functions/_shared/devMcpIndexBackfill'

/** The dev seat's backfill door (punch list #240, PR 2): the plan's shape, its commitment, the cursor and the words. Made-up jobs. */
const JOB = '00000000-0000-4000-8000-0000000001a1'
const jobs: BackfillJob[] = [
  { id: 'j1', number: '1001', name: 'Maple Court townhomes', status: 'working', rows: 12 },
  { id: 'j2', number: '1002', name: 'Ridgeway shell', status: 'working', rows: 0 },
  { id: 'j3', number: '1003', name: 'Boerne retail', status: null, rows: null },
]

describe('parseBackfillPlan', () => {
  it('takes the three scopes, a job id with scope job alone, a limit within the cap and the retry switch', () => {
    expect(parseBackfillPlan({ scope: 'live' })).toEqual({ ok: true, plan: { scope: 'live', job_id: null, limit: BACKFILL_JOBS_MAX, retry: false, after_job: null } })
    expect(parseBackfillPlan({ scope: 'paid', limit: 20, retry: true })).toEqual({ ok: true, plan: { scope: 'paid', job_id: null, limit: 20, retry: true, after_job: null } })
    expect(parseBackfillPlan({ scope: 'job', job_id: JOB })).toEqual({ ok: true, plan: { scope: 'job', job_id: JOB, limit: BACKFILL_JOBS_MAX, retry: false, after_job: null } })
    expect(parseBackfillPlan({ scope: 'live', limit: 9999 })).toMatchObject({ ok: true, plan: { limit: BACKFILL_JOBS_MAX } })
  })

  it('refuses a scope it does not know, a job scope with no id, an id on another scope, and a limit under one', () => {
    expect(parseBackfillPlan({ scope: 'all' }).ok).toBe(false)
    expect(parseBackfillPlan({ scope: 'job' }).ok).toBe(false)
    expect(parseBackfillPlan({ scope: 'job', job_id: 'not-a-uuid' }).ok).toBe(false)
    expect(parseBackfillPlan({ scope: 'live', job_id: JOB })).toMatchObject({ ok: false, error: expect.stringContaining('job_id goes with scope job alone') })
    expect(parseBackfillPlan({ scope: 'live', limit: 0 }).ok).toBe(false)
    expect(parseBackfillPlan(null).ok).toBe(false)
  })

  it('reads the jobs by scope: live oldest number first, paid newest first, one job alone', () => {
    expect(backfillJobsQuery({ scope: 'live', job_id: null, limit: 50, retry: false, after_job: null })).toEqual({ status: 'live', jobId: null, afterJob: null, ascending: true, limit: 50 })
    expect(backfillJobsQuery({ scope: 'paid', job_id: null, limit: 500, retry: false, after_job: null })).toEqual({ status: 'paid', jobId: null, afterJob: null, ascending: false, limit: 500 })
    expect(backfillJobsQuery({ scope: 'job', job_id: JOB, limit: 500, retry: true, after_job: null })).toEqual({ status: 'one', jobId: JOB, afterJob: null, ascending: true, limit: 1 })
  })
})

describe('the plan, the cursor and the apply', () => {
  const plan = { scope: 'live' as const, job_id: null, limit: 500, retry: false, after_job: null }

  it('commits to the scope, the switches and the job ids in order, and replies with the counts and the how', () => {
    expect(backfillCommitment(plan, jobs)).toEqual({ scope: 'live', job_id: null, limit: 500, retry: false, after_job: null, job_ids: ['j1', 'j2', 'j3'] })
    const reply = backfillPlanReply(plan, jobs, '2026-11-02T04:13:00Z')
    expect(reply).toMatchObject({ scope: 'live', jobs: 3, jobs_with_rows: 1, jobs_without_rows: 2, sweep_last_at: '2026-11-02T04:13:00Z' })
    expect(reply.first_jobs).toEqual([
      { id: 'j1', job: '1001', rows: 12 },
      { id: 'j2', job: '1002', rows: 0 },
      { id: 'j3', job: '1003', rows: null },
    ])
    expect(String(reply.how)).toContain(`batch ${BACKFILL_BATCH_DEFAULT}`)
  })

  it('walks the jobs with a cursor: no cursor starts at the first, a cursor moves past it, a cursor off the plan is lost, never a start over', () => {
    expect(nextBackfillJob(jobs, null)).toEqual({ job: jobs[0], position: 0, left: 3, lost: false })
    expect(nextBackfillJob(jobs, 'j1')).toEqual({ job: jobs[1], position: 1, left: 2, lost: false })
    expect(nextBackfillJob(jobs, 'j3')).toEqual({ job: null, position: 3, left: 0, lost: false })
    expect(nextBackfillJob(jobs, 'not-in-plan')).toEqual({ job: null, position: -1, left: 3, lost: true })
    expect(cursorLostWords('not-in-plan')).toContain('after_job = "not-in-plan" inside the plan')
  })

  it('takes a batch within the cap', () => {
    expect(backfillBatch(undefined)).toBe(BACKFILL_BATCH_DEFAULT)
    expect(backfillBatch(10)).toBe(10)
    expect(backfillBatch(999)).toBe(BACKFILL_BATCH_MAX)
    expect(backfillBatch('x')).toBe(BACKFILL_BATCH_DEFAULT)
  })

  it('answers where the loop goes next: the same job while files remain, the next job once done, the end after the last', () => {
    const held = [{ id: 'f1', name: 'Scan.pdf', why: 'scan' }]
    const going = backfillApplyReply(jobs[1]!, { indexed: 25, held, remaining: 7, planned: 32, skipped: 3 }, 35, 1, 3)
    expect(going).toMatchObject({ job: { id: 'j2', job: '1002' }, files: 35, indexed: 25, held, skipped_current: 3, remaining: 7, job_done: false, next_after: null, jobs_done: 1, jobs_left: 2 })
    expect(String(going.next)).toContain('7 files to go')
    const done = backfillApplyReply(jobs[1]!, { indexed: 7, held: [], remaining: 0, planned: 7, skipped: 28 }, 35, 1, 3)
    expect(done).toMatchObject({ job_done: true, next_after: 'j2', jobs_done: 2, jobs_left: 1 })
    expect(String(done.next)).toContain('after_job = "j2"')
    const last = backfillApplyReply(jobs[2]!, { indexed: 0, held: [], remaining: 0, planned: 0, skipped: 0 }, 0, 2, 3)
    expect(last).toMatchObject({ job_done: true, jobs_done: 3, jobs_left: 0 })
    expect(String(last.next)).toContain('last in the plan')
  })

  it('a job Drive refused is passed over with its reason and the cursor moves on; the last one ends the plan', () => {
    const passed = backfillJobPassedReply(jobs[1]!, 'Drive refused its folder (Drive answered 404)', 1, 3)
    expect(passed).toMatchObject({ job: { id: 'j2' }, files: 0, indexed: 0, held: [], remaining: 0, job_done: true, job_passed: 'Drive refused its folder (Drive answered 404)', next_after: 'j2', jobs_done: 2, jobs_left: 1 })
    expect(String(passed.next)).toContain('passed over: Drive refused its folder (Drive answered 404). Its files are not indexed; name it in the card. Call apply_index_backfill again with after_job = "j2"')
    const last = backfillJobPassedReply(jobs[2]!, 'no Drive folder the account can open', 2, 3)
    expect(last).toMatchObject({ job_done: true, next_after: 'j3', jobs_done: 3, jobs_left: 0 })
    expect(String(last.next)).toContain('last in the plan')
  })

  it('opens a status reply with one line', () => {
    expect(statusReading({ rows: 0 })).toBe('The index is empty: nothing has been indexed yet.')
    expect(statusReading({ rows: 1200, with_text: 900, live_jobs_with_folder: 101, live_jobs_without_rows: 4 })).toBe('1200 files indexed, 900 with text; 97 of 101 live jobs with a folder have rows, 4 have none yet.')
    expect(statusReading({ rows: '12', with_text: '12', live_jobs_with_folder: '2', live_jobs_without_rows: '0' })).toBe('12 files indexed, 12 with text; 2 of 2 live jobs with a folder have rows.')
  })
})

describe('the plan’s own start', () => {
  it('reads after_job as a job id on the live and paid scopes, never with scope job, and commits to it', () => {
    const r = parseBackfillPlan({ scope: 'paid', after_job: JOB })
    expect(r.ok && r.plan).toEqual({ scope: 'paid', job_id: null, limit: BACKFILL_JOBS_MAX, retry: false, after_job: JOB })
    expect(r.ok && backfillJobsQuery(r.plan)).toMatchObject({ status: 'paid', afterJob: JOB, ascending: false })
    expect(parseBackfillPlan({ scope: 'live', after_job: 'j9' }).ok).toBe(false)
    expect(parseBackfillPlan({ scope: 'job', job_id: JOB, after_job: JOB }).ok).toBe(false)
    const plan = r.ok ? r.plan : null
    expect(plan && backfillCommitment(plan, jobs)).toMatchObject({ after_job: JOB })
    const same = { scope: 'paid' as const, job_id: null, limit: BACKFILL_JOBS_MAX, retry: false, after_job: null }
    expect(JSON.stringify(backfillCommitment(same, jobs))).not.toBe(JSON.stringify(plan && backfillCommitment(plan, jobs)))
  })

  it('the filter starts strictly after the job on its stamp, or on its id among jobs stamped alike, in the walk’s direction', () => {
    expect(backfillAfterFilter('2026-03-04T05:06:07.123456+00:00', 'j2', true)).toBe('created_at.gt."2026-03-04T05:06:07.123456+00:00",and(created_at.eq."2026-03-04T05:06:07.123456+00:00",id.gt."j2")')
    expect(backfillAfterFilter('2026-03-04T05:06:07.123456+00:00', 'j2', false)).toBe('created_at.lt."2026-03-04T05:06:07.123456+00:00",and(created_at.eq."2026-03-04T05:06:07.123456+00:00",id.lt."j2")')
  })

  it('a plan as long as its cap says more may follow and names the last job to plan after; a shorter one does not', () => {
    const capped = { scope: 'live' as const, job_id: null, limit: 3, retry: false, after_job: null }
    const reply = backfillPlanReply(capped, jobs, null)
    expect(reply).toMatchObject({ may_be_more: true, last_job: { id: 'j3', job: '1003' }, after_job: null })
    expect(String(reply.how)).toContain('plan again with after_job = "j3" inside the plan')
    const open = backfillPlanReply({ ...capped, limit: 50, after_job: 'j0' }, jobs, null)
    expect(open).toMatchObject({ may_be_more: false, after_job: 'j0' })
    expect(String(open.how)).not.toContain('plan again')
  })
})
