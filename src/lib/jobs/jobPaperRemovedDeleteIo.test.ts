/**
 * The read and the delete of a test job's taken-off papers (punch list #443, row 10), against a fake client: each is
 * one call of its function by name, the delete is sent once, and a refusal comes through as the database said it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Every function called, in order, and what each call answers in turn. `tables` is every table statement: none is expected. */
const db = vi.hoisted(() => ({
  rpcs: [] as Array<{ fn: string; args: unknown }>,
  rpcAnswers: [] as Array<{ data: unknown; error: unknown }>,
  tables: [] as string[],
}))

vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      db.tables.push(table)
      throw new Error(`no table is read or written here: ${table}`)
    },
    rpc: (fn: string, args: unknown) => {
      db.rpcs.push({ fn, args })
      return Promise.resolve(db.rpcAnswers.shift() ?? { data: null, error: null })
    },
  },
}))

import { formatErrorMessage } from '../../utils/errorHandling'
import { JobPaperDeleteRefused, supabaseJobPaperRemovedDeleteIo as io } from './jobPaperRemovedDeleteIo'

const JOB = 'cccccccc-3333-4333-8333-333333333333'
const PAPER = 'aaaaaaaa-1111-4111-8111-111111111111'
const row = (over: Record<string, unknown> = {}) => ({ id: PAPER, paper_name: 'ZZ Test site rules', required_at: '2026-11-20T15:00:00Z', removed_at: '2026-11-24T20:00:00Z', copies: 0, proposals: 0, taken_as: 0, revisions: 0, ...over })

beforeEach(() => {
  db.rpcs.length = 0
  db.rpcAnswers.length = 0
  db.tables.length = 0
})

describe('readRemoved', () => {
  it('calls list_test_job_removed_papers once with the job, and hands back its papers in its order', async () => {
    db.rpcAnswers.push({ data: { ok: true, job_id: JOB, papers: [row({ id: 'p2', copies: 1 }), row()] }, error: null })
    const papers = await io.readRemoved(JOB)
    expect(db.rpcs).toEqual([{ fn: 'list_test_job_removed_papers', args: { p_job_id: JOB } }])
    expect(papers.map((p) => `${p.id}:${p.copies}`)).toEqual(['p2:1', `${PAPER}:0`])
    expect(db.tables).toEqual([])
  })
  it('throws a missing function as the refusal it is, without asking again', async () => {
    // Before the migration is pushed PostgREST answers the name with PGRST202. The fold reads that as no list.
    db.rpcAnswers.push({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.list_test_job_removed_papers(p_job_id) in the schema cache' } })
    await expect(io.readRemoved(JOB)).rejects.toMatchObject({ code: 'PGRST202' })
    expect(db.rpcs).toHaveLength(1)
  })
  it('throws the function’s own refusal', async () => {
    db.rpcAnswers.push({ data: null, error: { code: 'P0001', message: 'Only a test job’s taken-off papers are listed. This job is a real one.' } })
    await expect(io.readRemoved(JOB)).rejects.toThrow('Only a test job’s taken-off papers are listed. This job is a real one.')
  })
  it('throws on an answer that is not the function’s', async () => {
    db.rpcAnswers.push({ data: { ok: false }, error: null })
    await expect(io.readRemoved(JOB)).rejects.toThrow('The taken-off papers could not be read.')
  })
})

describe('deletePaper', () => {
  it('calls delete_test_job_required_paper once with the paper', async () => {
    db.rpcAnswers.push({ data: { ok: true, job_id: JOB, paper_name: 'ZZ Test site rules' }, error: null })
    await io.deletePaper(PAPER)
    expect(db.rpcs).toEqual([{ fn: 'delete_test_job_required_paper', args: { p_paper_id: PAPER } }])
    expect(db.tables).toEqual([])
  })
  it('throws the function’s refusal in its own words, and sends nothing twice', async () => {
    db.rpcAnswers.push({ data: null, error: { code: 'P0001', message: 'A copy on a person’s file names this paper. It stays.' } })
    const refusal = await io.deletePaper(PAPER).then(
      () => null,
      (e: unknown) => e,
    )
    expect(db.rpcs).toHaveLength(1)
    // A refusal is a JobPaperDeleteRefused, and the screen shows the sentence alone, as the database raised it.
    expect(refusal).toBeInstanceOf(JobPaperDeleteRefused)
    expect(formatErrorMessage(refusal, 'The paper was not deleted.')).toBe('A copy on a person’s file names this paper. It stays.')
  })
  it('anything else that goes wrong is not a refusal', async () => {
    db.rpcAnswers.push({ data: null, error: { code: '42501', message: 'permission denied for function delete_test_job_required_paper' } })
    const failure = await io.deletePaper(PAPER).then(
      () => null,
      (e: unknown) => e,
    )
    expect(failure).toBeTruthy()
    expect(failure).not.toBeInstanceOf(JobPaperDeleteRefused)
  })
  it('never sends a delete twice, even when the signal is lost', async () => {
    db.rpcAnswers.push({ data: null, error: { message: 'TypeError: Failed to fetch' } })
    await expect(io.deletePaper(PAPER)).rejects.toBeTruthy()
    expect(db.rpcs).toHaveLength(1)
  })
  it('throws when the database gave no answer', async () => {
    db.rpcAnswers.push({ data: null, error: null })
    await expect(io.deletePaper(PAPER)).rejects.toThrow('The paper was not deleted. The database gave no answer.')
    db.rpcAnswers.push({ data: { ok: false }, error: null })
    await expect(io.deletePaper(PAPER)).rejects.toThrow('The paper was not deleted. The database gave no answer.')
  })
})
