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
  personBackfillApplyReply,
  personBackfillCommitment,
  personBackfillPlanReply,
  recordsBatch,
  statusReading,
  type BackfillJob,
  type PersonBackfillFile,
} from '../../../supabase/functions/_shared/devMcpIndexBackfill'
import { readFileSync } from 'node:fs'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const PERSON = '11111111-2222-4333-8444-555555555555'

/** The dev seat's backfill door (punch list #240, PR 2): the plan's shape, its commitment, the cursor and the words. Made-up jobs. */
const JOB = '00000000-0000-4000-8000-0000000001a1'
const jobs: BackfillJob[] = [
  { id: 'j1', number: '1001', name: 'Maple Court townhomes', status: 'working', rows: 12 },
  { id: 'j2', number: '1002', name: 'Ridgeway shell', status: 'working', rows: 0 },
  { id: 'j3', number: '1003', name: 'Boerne retail', status: null, rows: null },
]

describe('parseBackfillPlan', () => {
  it('takes the three scopes, a job id with scope job alone, a limit within the cap and the retry switch', () => {
    expect(parseBackfillPlan({ scope: 'live' })).toEqual({ ok: true, plan: { scope: 'live', job_id: null, person_id: null, limit: BACKFILL_JOBS_MAX, retry: false, after_job: null } })
    expect(parseBackfillPlan({ scope: 'paid', limit: 20, retry: true })).toEqual({ ok: true, plan: { scope: 'paid', job_id: null, person_id: null, limit: 20, retry: true, after_job: null } })
    expect(parseBackfillPlan({ scope: 'job', job_id: JOB })).toEqual({ ok: true, plan: { scope: 'job', job_id: JOB, person_id: null, limit: BACKFILL_JOBS_MAX, retry: false, after_job: null } })
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
    expect(backfillJobsQuery({ scope: 'live', job_id: null, person_id: null, limit: 50, retry: false, after_job: null })).toEqual({ status: 'live', jobId: null, afterJob: null, ascending: true, limit: 50 })
    expect(backfillJobsQuery({ scope: 'paid', job_id: null, person_id: null, limit: 500, retry: false, after_job: null })).toEqual({ status: 'paid', jobId: null, afterJob: null, ascending: false, limit: 500 })
    expect(backfillJobsQuery({ scope: 'job', job_id: JOB, person_id: null, limit: 500, retry: true, after_job: null })).toEqual({ status: 'one', jobId: JOB, afterJob: null, ascending: true, limit: 1 })
  })
})

describe('the plan, the cursor and the apply', () => {
  const plan = { scope: 'live' as const, job_id: null, person_id: null, limit: 500, retry: false, after_job: null }

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
    expect(r.ok && r.plan).toEqual({ scope: 'paid', job_id: null, person_id: null, limit: BACKFILL_JOBS_MAX, retry: false, after_job: JOB })
    expect(r.ok && backfillJobsQuery(r.plan)).toMatchObject({ status: 'paid', afterJob: JOB, ascending: false })
    expect(parseBackfillPlan({ scope: 'live', after_job: 'j9' }).ok).toBe(false)
    expect(parseBackfillPlan({ scope: 'job', job_id: JOB, person_id: null, after_job: JOB }).ok).toBe(false)
    const plan = r.ok ? r.plan : null
    expect(plan && backfillCommitment(plan, jobs)).toMatchObject({ after_job: JOB })
    const same = { scope: 'paid' as const, job_id: null, person_id: null, limit: BACKFILL_JOBS_MAX, retry: false, after_job: null }
    expect(JSON.stringify(backfillCommitment(same, jobs))).not.toBe(JSON.stringify(plan && backfillCommitment(plan, jobs)))
  })

  it('the filter starts strictly after the job on its stamp, or on its id among jobs stamped alike, in the walk’s direction', () => {
    expect(backfillAfterFilter('2026-03-04T05:06:07.123456+00:00', 'j2', true)).toBe('created_at.gt."2026-03-04T05:06:07.123456+00:00",and(created_at.eq."2026-03-04T05:06:07.123456+00:00",id.gt."j2")')
    expect(backfillAfterFilter('2026-03-04T05:06:07.123456+00:00', 'j2', false)).toBe('created_at.lt."2026-03-04T05:06:07.123456+00:00",and(created_at.eq."2026-03-04T05:06:07.123456+00:00",id.lt."j2")')
  })

  it('a plan as long as its cap says more may follow and names the last job to plan after; a shorter one does not', () => {
    const capped = { scope: 'live' as const, job_id: null, person_id: null, limit: 3, retry: false, after_job: null }
    const reply = backfillPlanReply(capped, jobs, null)
    expect(reply).toMatchObject({ may_be_more: true, last_job: { id: 'j3', job: '1003' }, after_job: null })
    expect(String(reply.how)).toContain('plan again with after_job = "j3" inside the plan')
    const open = backfillPlanReply({ ...capped, limit: 50, after_job: 'j0' }, jobs, null)
    expect(open).toMatchObject({ may_be_more: false, after_job: 'j0' })
    expect(String(open.how)).not.toContain('plan again')
  })
})

describe('the person scope (#285, PR 3, v2.6721)', () => {
  const plan = { scope: 'person' as const, job_id: null, person_id: PERSON, limit: 500, retry: false, after_job: null }
  const person = { id: PERSON, name: 'Pat Doe' }
  const files: PersonBackfillFile[] = [
    { id: 'a1', source: 'hr_attachment', name: 'Call 2026-10-03.md', record_kind: 'evidence', record_title: 'Recording of the call', where: 'bucket', state: 'due' },
    { id: 'a2', source: 'hr_attachment', name: 'Transcript', record_kind: 'evidence', record_title: 'Recording of the call', where: 'drive', state: 'read' },
    { id: 'a3', source: 'hr_attachment', name: 'scan.pdf', record_kind: 'file', record_title: null, where: 'bucket', state: 'held' },
    { id: 'd1', source: 'matter_document', name: 'claims.eml', record_kind: 'matter_document', record_title: 'Claims matrix', where: 'bucket', state: 'due' },
  ]

  it('parses scope person with its person_id alone, never with after_job or a job id', () => {
    expect(parseBackfillPlan({ scope: 'person', person_id: PERSON, retry: true })).toEqual({ ok: true, plan: { ...plan, retry: true } })
    expect(parseBackfillPlan({ scope: 'person' }).ok).toBe(false)
    expect(parseBackfillPlan({ scope: 'person', person_id: 'nope' }).ok).toBe(false)
    expect(parseBackfillPlan({ scope: 'live', person_id: PERSON })).toMatchObject({ ok: false, error: expect.stringContaining('person_id goes with scope person alone') })
    expect(parseBackfillPlan({ scope: 'person', person_id: PERSON, after_job: JOB })).toMatchObject({ ok: false, error: expect.stringContaining('after_job has no place with scope person') })
    expect(parseBackfillPlan({ scope: 'person', person_id: PERSON, job_id: JOB })).toMatchObject({ ok: false })
  })

  it('commits to the person, the switch and every file they carry, sorted, so an apply that indexed files still matches and a new file refuses', () => {
    expect(personBackfillCommitment(plan, ['d1', 'a1', 'a2'])).toEqual({ scope: 'person', person_id: PERSON, retry: false, file_ids: ['a1', 'a2', 'd1'] })
    expect(personBackfillCommitment(plan, ['a1', 'a2', 'd1'])).toEqual(personBackfillCommitment(plan, ['d1', 'a2', 'a1']))
  })

  it('the plan replies with the counts by state, where and record, the first files due, and the how; retry counts the held ones as due', () => {
    const reply = personBackfillPlanReply(plan, person, files)
    expect(reply).toMatchObject({ scope: 'person', person, retry: false, files: 4, files_read: 1, files_held: 1, files_due: 2, by_record: { evidence: 2, file: 1, matter_document: 1 }, by_where: { bucket: 3, drive: 1 } })
    expect(reply.first_due).toEqual([
      { id: 'a1', name: 'Call 2026-10-03.md', record: 'evidence', title: 'Recording of the call', where: 'bucket' },
      { id: 'd1', name: 'claims.eml', record: 'matter_document', title: 'Claims matrix', where: 'bucket' },
    ])
    expect(String(reply.how)).toContain('batch 10 (at most 25)')
    expect(personBackfillPlanReply({ ...plan, retry: true }, person, files)).toMatchObject({ files_due: 3 })
    const nothing = personBackfillPlanReply(plan, person, files.filter((f) => f.state !== 'due'))
    expect(nothing).toMatchObject({ files_due: 0 })
    expect(String(nothing.how)).toContain('Nothing to apply')
    expect(String(nothing.how)).toContain('retry: true')
  })

  it('the apply answers what it did and where the loop goes: again while files remain, the status and the search once done', () => {
    const again = personBackfillApplyReply(person, { due: 5, tried: 2, indexed: 2, held: [], remaining: 3 }, 9)
    expect(again).toMatchObject({ scope: 'person', files: 9, due: 5, tried: 2, indexed: 2, remaining: 3, done: false })
    expect(String(again.next)).toContain('3 files to go')
    const done = personBackfillApplyReply(person, { due: 1, tried: 1, indexed: 1, held: [{ id: 'a3', name: 'scan.pdf', why: 'scan' }], remaining: 0 }, 9)
    expect(done).toMatchObject({ done: true, held: [{ id: 'a3', name: 'scan.pdf', why: 'scan' }] })
    expect(String(done.next)).toContain('1 held')
    expect(String(done.next)).toContain('in: files')
  })

  it('takes a records batch within its cap, and the server and the docs carry the scope', () => {
    expect(recordsBatch(undefined)).toBe(10)
    expect(recordsBatch(3)).toBe(3)
    expect(recordsBatch(99)).toBe(25)
    expect(SERVER).toContain("if (plan.scope === 'person') {")
    expect(SERVER).toContain('personBackfillCommitment(plan, allIds)')
    expect(SERVER).toContain('recordsPass(admin, { n: recordsBatch(args.batch), personId, retry: plan.retry, dropGone: true')
    expect(SERVER).toContain('scope: live | paid | job | person')
    expect(README).toContain("scope: 'person'")
  })
})
