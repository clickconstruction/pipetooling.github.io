/**
 * The writes under the stage checklist items (punch list #237, PR 1), over a stubbed client: a take off the database's
 * rule filtered away (no error, no row) reads as a refusal and never as saved, and two presses racing to make one
 * answer row read the row the other made. Refusals are plain objects, as supabase-js answers them.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Result = { data: unknown; error: { message: string; code?: string } | null; status?: number }

const calls = vi.hoisted(() => ({ results: [] as Result[], log: [] as Array<{ table: string; ops: Array<[string, unknown[]]> }> }))

vi.mock('../supabase', () => {
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
    builder.then = (resolve: (r: Result) => unknown) => resolve(calls.results.shift() ?? { data: null, error: { message: 'no result queued' } })
    return builder
  }
  return { supabase: { from } }
})

import { formatErrorMessage } from '../../utils/errorHandling'
import { addJobItem, retireJobItem } from './stageChecklistIo'
import { TAKE_OFF_WORDS } from './stageChecklistItems'
import { saveAnswerPick } from './stageChecklistSheetIo'

const row = { id: 'a1', fixture_id: 'f1', question_id: 'q1', pick: 'yes', note: '', answered_by_name: 'Jo Sample', answered_at: '2026-11-01T15:00:00.000Z', photo_file_name: null, photo_taken_at: null, photo_storage_path: null, photo_drive_file_id: null, photo_filed_at: null, photo_fail_why: null }
const KEY = { jobId: 'job-1', fixtureId: 'f1', questionId: 'q1' }

beforeEach(() => {
  calls.results = []
  calls.log = []
})

describe('retireJobItem', () => {
  it('writes who took it off, on a job item alone, and asks for the row back', async () => {
    calls.results = [{ data: [{ id: 'j1' }], error: null }]
    await retireJobItem('j1', { userId: 'u-pat' })
    const ops = calls.log[0]!.ops
    const update = ops.find(([m]) => m === 'update')![1][0] as Record<string, unknown>
    expect(update.retired_by).toBe('u-pat')
    expect(typeof update.retired_at).toBe('string')
    expect(ops).toContainEqual(['eq', ['id', 'j1']])
    expect(ops).toContainEqual(['not', ['job_id', 'is', null]])
    expect(ops).toContainEqual(['select', ['id']])
  })
  it('reads a write the rule filtered away as a refusal, never as saved', async () => {
    calls.results = [{ data: [], error: null }]
    await expect(retireJobItem('j1', { userId: 'u-other' })).rejects.toThrow(TAKE_OFF_WORDS.refused)
  })
  it('reads a refused write with its reason', async () => {
    calls.results = [{ data: null, error: { message: 'new row violates row-level security policy', code: '42501' }, status: 403 }]
    const e = await retireJobItem('j1', { userId: 'u-other' }).catch((err: unknown) => err)
    expect(formatErrorMessage(e)).toBe("You don't have permission to take the check off.")
  })
})

describe('addJobItem', () => {
  it('names the adder and reads a refusal with its reason', async () => {
    calls.results = [{ data: { id: 'j1', stage_kind: 'trim_set', sort_order: 0, words: 'Is the pan drain run?', asks_photo: false, job_id: 'job-1', fixture_id: 'f1', created_by: 'u-pat', created_by_name: 'Pat Sample', created_at: '2026-11-01T15:00:00.000Z' }, error: null }]
    const q = await addJobItem({ jobId: 'job-1', fixtureId: 'f1', kind: 'trim_set', words: '  Is the  pan drain run? ', asksPhoto: false }, { userId: 'u-pat', name: 'Pat Sample' })
    expect(q).toMatchObject({ id: 'j1', fixtureId: 'f1', addedById: 'u-pat', addedBy: 'Pat Sample', words: 'Is the pan drain run?' })
    const insert = calls.log[0]!.ops.find(([m]) => m === 'insert')![1][0] as Record<string, unknown>
    expect(insert).toMatchObject({ job_id: 'job-1', fixture_id: 'f1', created_by: 'u-pat', created_by_name: 'Pat Sample', words: 'Is the pan drain run?', stage_kind: 'trim_set' })

    calls.results = [{ data: null, error: { message: 'new row violates row-level security policy', code: '42501' }, status: 403 }]
    const e = await addJobItem({ jobId: 'job-2', fixtureId: 'f2', kind: 'trim_set', words: 'x', asksPhoto: false }, { userId: 'u-pat', name: 'Pat Sample' }).catch((err: unknown) => err)
    expect(formatErrorMessage(e)).toBe("You don't have permission to add the check.")
  })
})

describe('saveAnswerPick', () => {
  it('reads the row another press made first, then writes the pick on it', async () => {
    calls.results = [
      { data: null, error: null }, // no row yet
      { data: null, error: { message: 'duplicate key value violates unique constraint', code: '23505' }, status: 409 }, // the note beat it
      { data: { ...row, pick: null, answered_at: null }, error: null }, // the row the note made
      { data: row, error: null }, // the pick
    ]
    const a = await saveAnswerPick(KEY, 'yes', { userId: 'u-jo', name: 'Jo Sample' })
    expect(a).toMatchObject({ id: 'a1', pick: 'yes', answeredBy: 'Jo Sample' })
    expect(calls.log).toHaveLength(4)
    expect(calls.log[3]!.ops).toContainEqual(['eq', ['id', 'a1']])
  })
  it('still fails on any other refusal', async () => {
    calls.results = [
      { data: null, error: null },
      { data: null, error: { message: 'new row violates row-level security policy', code: '42501' }, status: 403 },
    ]
    const e = await saveAnswerPick(KEY, 'yes', { userId: 'u-jo', name: 'Jo Sample' }).catch((err: unknown) => err)
    expect(formatErrorMessage(e)).toBe("You don't have permission to save the answer.")
  })
})
