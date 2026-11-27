import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Every function the client called, in order, with what each answers in turn. `viaSchema` says which went through `.schema('public')`. */
const db = vi.hoisted(() => ({
  rpcs: [] as Array<{ fn: string; args: unknown; viaSchema: boolean }>,
  answers: [] as Array<{ data: unknown; error: unknown }>,
}))

vi.mock('./supabase', () => {
  const rpc = (viaSchema: boolean) => (fn: string, args: unknown) => {
    db.rpcs.push({ fn, args, viaSchema })
    return Promise.resolve(db.answers.shift() ?? { data: null, error: null })
  }
  return { supabase: { rpc: rpc(false), schema: () => ({ rpc: rpc(true) }) } }
})

import { restoreDeletedRecords } from './deletedRecordsArchive'
import { RESTORE_BUNDLE_FUNCTION, RESTORE_TEST_PERSON_FUNCTION, restoreFunctionFor } from './deletedRecordsRestoreDoor'

beforeEach(() => {
  db.rpcs.length = 0
  db.answers.length = 0
})

describe('restoreDeletedRecords (punch list #443, row 12)', () => {
  it('with no function named, calls restore_deleted_records exactly as before', async () => {
    db.answers.push({ data: { ok: true, dry_run: true, total: 3 }, error: null })
    const result = await restoreDeletedRecords('job-1', true)
    expect(result).toEqual({ ok: true, dry_run: true, total: 3 })
    expect(db.rpcs).toEqual([{ fn: 'restore_deleted_records', args: { p_group_key: 'job-1', p_dry_run: true }, viaSchema: true }])
  })

  it('a job’s bundle keeps the old function on the preview and on the restore', async () => {
    const fn = restoreFunctionFor({ kind: 'job', tables: ['jobs_ledger', 'jobs_ledger_invoices'] })
    expect(fn).toBe(RESTORE_BUNDLE_FUNCTION)
    await restoreDeletedRecords('job-1', true, fn)
    await restoreDeletedRecords('job-1', false, fn)
    expect(db.rpcs.map((r) => [r.fn, r.args])).toEqual([
      ['restore_deleted_records', { p_group_key: 'job-1', p_dry_run: true }],
      ['restore_deleted_records', { p_group_key: 'job-1', p_dry_run: false }],
    ])
  })

  it('a person’s bundle with a users copy goes to restore_deleted_test_person, with the same two arguments', async () => {
    const fn = restoreFunctionFor({ kind: 'person', tables: ['people', 'users'] })
    expect(fn).toBe(RESTORE_TEST_PERSON_FUNCTION)
    db.answers.push({ data: { ok: true, dry_run: true, total: 4, inserted: { users: 1, people: 1 } }, error: null }, { data: { ok: true, dry_run: false, total: 4 }, error: null })
    const preview = await restoreDeletedRecords('person-1', true, fn)
    const done = await restoreDeletedRecords('person-1', false, fn)
    expect(preview).toMatchObject({ ok: true, dry_run: true, total: 4 })
    expect(done).toMatchObject({ ok: true, dry_run: false })
    expect(db.rpcs.map((r) => [r.fn, r.args])).toEqual([
      ['restore_deleted_test_person', { p_group_key: 'person-1', p_dry_run: true }],
      ['restore_deleted_test_person', { p_group_key: 'person-1', p_dry_run: false }],
    ])
  })

  it('passes the function’s refusal on as its answer', async () => {
    db.answers.push({ data: { ok: false, code: 'blocked', error: 'ZZ Test Ana is on the roster already. Nothing was put back.', blockers: ['ZZ Test Ana is on the roster already.'] }, error: null })
    const refused = await restoreDeletedRecords('person-1', false, RESTORE_TEST_PERSON_FUNCTION)
    expect(refused).toMatchObject({ ok: false, code: 'blocked', blockers: ['ZZ Test Ana is on the roster already.'] })
    expect(db.rpcs).toHaveLength(1)
  })

  it('sends the test person’s real run once: a lost answer is thrown, not sent again', async () => {
    db.answers.push({ data: null, error: { message: 'TypeError: Failed to fetch' } }, { data: { ok: true }, error: null })
    await expect(restoreDeletedRecords('person-1', false, RESTORE_TEST_PERSON_FUNCTION)).rejects.toThrow()
    expect(db.rpcs).toHaveLength(1)
  })

  it('no answer at all reads as a failed restore, through either function', async () => {
    expect(await restoreDeletedRecords('person-1', true, RESTORE_TEST_PERSON_FUNCTION)).toEqual({ ok: false, error: 'No response from restore.' })
    expect(await restoreDeletedRecords('job-1', true)).toEqual({ ok: false, error: 'No response from restore.' })
  })
})
