/**
 * The writes under what the walks added (punch list #237, PR 1b), over a stubbed client: who authors reads false on any
 * failure and never throws; a skip keeps who and why, and a press that lost the race reads the row that won; a put back
 * the database's rule filtered away (no error, no row) reads as a refusal and never as saved; the order and the promote
 * go through their functions and read a refusal with its reason. Refusals are plain objects, as supabase-js answers them.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Result = { data: unknown; error: { message: string; code?: string } | null; status?: number }

const calls = vi.hoisted(() => ({ results: [] as Result[], log: [] as Array<{ table: string; ops: Array<[string, unknown[]]> }>, rpcs: [] as Array<[string, unknown]> }))

vi.mock('../supabase', () => {
  const next = () => calls.results.shift() ?? { data: null, error: { message: 'no result queued' } }
  const from = (table: string) => {
    const entry = { table, ops: [] as Array<[string, unknown[]]> }
    calls.log.push(entry)
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'insert', 'update', 'eq', 'is', 'not', 'in', 'or', 'order', 'range', 'single', 'maybeSingle']) {
      builder[m] = (...args: unknown[]) => {
        entry.ops.push([m, args])
        return builder
      }
    }
    builder.then = (resolve: (r: Result) => unknown) => resolve(next())
    return builder
  }
  const rpc = (fn: string, args: unknown) => {
    calls.rpcs.push([fn, args])
    return Promise.resolve(next())
  }
  return { supabase: { from, rpc } }
})

import { formatErrorMessage } from '../../utils/errorHandling'
import { addJobItem, loadJobSkips, loadQuestionsForJob, mayAuthorOnJob, promoteJobItem, putBackQuestion, reorderJobItems, skipQuestion } from './stageChecklistIo'
import { PUT_BACK_REFUSED } from './stageChecklistItems'

const WHO = { userId: 'u-pat', name: 'Pat Sample' }
const SKIP = { id: 's1', fixture_id: 'f3', question_id: 'q1', why: 'The owner took these out', skipped_by: 'u-pat', skipped_by_name: 'Pat Sample', skipped_at: '2026-11-02T15:14:00.000Z' }
const QUESTION = { id: 'q1', stage_kind: 'trim_set', sort_order: 1, words: 'Did the final water test hold?', asks_photo: false, job_id: null, fixture_id: null, created_by: 'u-jo', created_by_name: '', created_at: '2026-11-01T10:00:00.000Z', plan_sheet: null, why: null }
const REFUSED = { data: null, error: { message: 'new row violates row-level security policy', code: '42501' }, status: 403 }

beforeEach(() => {
  calls.results = []
  calls.log = []
  calls.rpcs = []
})

describe('loadQuestionsForJob', () => {
  it('reads the live skips of the job and hangs each on its question', async () => {
    calls.results = [
      { data: [QUESTION, { ...QUESTION, id: 'j1', job_id: 'job-1', fixture_id: 'f3', plan_sheet: 'P-201', why: 'The slab pours Thursday' }], error: null },
      { data: [SKIP], error: null },
    ]
    const q = await loadQuestionsForJob('job-1')
    expect(q[0]!.skips).toEqual([{ id: 's1', fixtureId: 'f3', why: 'The owner took these out', by: 'Pat Sample', byId: 'u-pat', at: '2026-11-02T15:14:00.000Z' }])
    expect(q[1]).toMatchObject({ id: 'j1', sheet: 'P-201', why: 'The slab pours Thursday' })
    expect(q[1]!.skips).toBeUndefined()
    const skips = calls.log.find((e) => e.table === 'stage_checklist_skips')!
    expect(skips.ops).toContainEqual(['eq', ['job_id', 'job-1']])
    expect(skips.ops).toContainEqual(['is', ['put_back_at', null]])
  })
  it('fails the read with its reason when the skips will not read, rather than count a skipped question', async () => {
    calls.results = [{ data: [QUESTION], error: null }, REFUSED]
    const e = await loadQuestionsForJob('job-1').catch((err: unknown) => err)
    expect(formatErrorMessage(e)).toBe("You don't have access to this skip list.")
  })
})

describe('loadJobSkips', () => {
  it('reads nothing for no jobs, and the live skips of a set', async () => {
    expect(await loadJobSkips([])).toEqual([])
    expect(calls.log).toHaveLength(0)
    calls.results = [{ data: [SKIP], error: null }]
    expect(await loadJobSkips(['job-1'])).toEqual([{ id: 's1', fixtureId: 'f3', questionId: 'q1', why: 'The owner took these out', by: 'Pat Sample', byId: 'u-pat', at: '2026-11-02T15:14:00.000Z' }])
    expect(calls.log[0]!.ops).toContainEqual(['is', ['put_back_at', null]])
  })
})

describe('mayAuthorOnJob', () => {
  it('reads yes only from a true answer, and a failure draws no press', async () => {
    calls.results = [{ data: true, error: null }]
    expect(await mayAuthorOnJob('job-1')).toBe(true)
    expect(calls.rpcs[0]).toEqual(['stage_checklist_may_author', { p_job_id: 'job-1' }])
    calls.results = [{ data: false, error: null }]
    expect(await mayAuthorOnJob('job-1')).toBe(false)
    calls.results = [REFUSED]
    expect(await mayAuthorOnJob('job-1')).toBe(false)
  })
})

describe('addJobItem', () => {
  it('writes its place, the plan sheet and the why as the row keeps them, and reads them back', async () => {
    calls.results = [{ data: { ...QUESTION, id: 'j1', job_id: 'job-1', fixture_id: 'f3', sort_order: 4, plan_sheet: 'P-201 detail 4', why: 'The slab pours Thursday' }, error: null }]
    const q = await addJobItem({ jobId: 'job-1', fixtureId: 'f3', kind: 'trim_set', words: 'Is the pan drain run?', asksPhoto: false, order: 4, sheet: '  P-201   detail 4 ', why: ' The slab pours Thursday ' }, WHO)
    expect(q).toMatchObject({ order: 4, sheet: 'P-201 detail 4', why: 'The slab pours Thursday' })
    expect(calls.log[0]!.ops.find(([m]) => m === 'insert')![1][0]).toMatchObject({ sort_order: 4, plan_sheet: 'P-201 detail 4', why: 'The slab pours Thursday' })
  })
  it('writes no plan sheet and no why when none was typed', async () => {
    calls.results = [{ data: { ...QUESTION, id: 'j1', job_id: 'job-1', fixture_id: 'f3' }, error: null }]
    await addJobItem({ jobId: 'job-1', fixtureId: 'f3', kind: 'trim_set', words: 'Is the pan drain run?', asksPhoto: false, sheet: '  ', why: '' }, WHO)
    expect(calls.log[0]!.ops.find(([m]) => m === 'insert')![1][0]).toMatchObject({ plan_sheet: null, why: null })
  })
})

describe('skipQuestion', () => {
  it('writes who and why, and returns the skip', async () => {
    calls.results = [{ data: SKIP, error: null }]
    const s = await skipQuestion({ jobId: 'job-1', fixtureId: 'f3', questionId: 'q1', why: '  The owner  took these out ' }, WHO)
    expect(s).toMatchObject({ id: 's1', questionId: 'q1', by: 'Pat Sample' })
    expect(calls.log[0]!.ops.find(([m]) => m === 'insert')![1][0]).toEqual({ job_id: 'job-1', fixture_id: 'f3', question_id: 'q1', why: 'The owner took these out', skipped_by: 'u-pat', skipped_by_name: 'Pat Sample' })
  })
  it('reads the row another press made first', async () => {
    calls.results = [{ data: null, error: { message: 'duplicate key value violates unique constraint', code: '23505' }, status: 409 }, { data: { ...SKIP, skipped_by_name: 'Jo Sample' }, error: null }]
    const s = await skipQuestion({ jobId: 'job-1', fixtureId: 'f3', questionId: 'q1', why: 'Slab on grade' }, WHO)
    expect(s.by).toBe('Jo Sample')
    expect(calls.log[1]!.ops).toContainEqual(['is', ['put_back_at', null]])
  })
  it('reads a refusal with its reason', async () => {
    calls.results = [REFUSED]
    const e = await skipQuestion({ jobId: 'job-2', fixtureId: 'f9', questionId: 'q1', why: 'Slab on grade' }, WHO).catch((err: unknown) => err)
    expect(formatErrorMessage(e)).toBe("You don't have permission to skip the question.")
  })
})

describe('putBackQuestion', () => {
  it('closes the live row in the presser’s name, and asks for it back', async () => {
    calls.results = [{ data: [{ id: 's1' }], error: null }]
    await putBackQuestion('s1', WHO)
    const ops = calls.log[0]!.ops
    const update = ops.find(([m]) => m === 'update')![1][0] as Record<string, unknown>
    expect(update.put_back_by).toBe('u-pat')
    expect(typeof update.put_back_at).toBe('string')
    expect(ops).toContainEqual(['is', ['put_back_at', null]])
    expect(ops).toContainEqual(['select', ['id']])
  })
  it('reads a write the rule filtered away as a refusal, never as saved', async () => {
    calls.results = [{ data: [], error: null }]
    await expect(putBackQuestion('s1', WHO)).rejects.toThrow(PUT_BACK_REFUSED)
  })
})

describe('reorderJobItems', () => {
  it('sends the stage and the order', async () => {
    calls.results = [{ data: 2, error: null }]
    await reorderJobItems('f3', ['j2', 'j1'])
    expect(calls.rpcs[0]).toEqual(['reorder_stage_checklist_items', { p_fixture_id: 'f3', p_item_ids: ['j2', 'j1'] }])
  })
  it('reads a refusal with its reason', async () => {
    calls.results = [REFUSED]
    const e = await reorderJobItems('f3', ['j2', 'j1']).catch((err: unknown) => err)
    expect(formatErrorMessage(e)).toBe("You don't have permission to move the check.")
  })
})

describe('promoteJobItem', () => {
  it('returns the company’s row as the kernel takes it', async () => {
    calls.results = [{ data: { ...QUESTION, id: 'q-new', sort_order: 3, words: 'Is the pan drain run?' }, error: null }]
    const q = await promoteJobItem('j1')
    expect(calls.rpcs[0]).toEqual(['promote_stage_checklist_item', { p_item_id: 'j1' }])
    expect(q).toMatchObject({ id: 'q-new', order: 3, fixtureId: null, words: 'Is the pan drain run?' })
  })
  it('reads a refusal and the database’s own reason', async () => {
    calls.results = [REFUSED]
    const refused = await promoteJobItem('j1').catch((err: unknown) => err)
    expect(formatErrorMessage(refused)).toBe("You don't have permission to add the check to the company's list.")
    calls.results = [{ data: null, error: { message: "The company's list already asks that.", code: 'P0001' }, status: 400 }]
    const asked = await promoteJobItem('j1').catch((err: unknown) => err)
    expect(formatErrorMessage(asked)).toContain("The company's list already asks that.")
  })
})
