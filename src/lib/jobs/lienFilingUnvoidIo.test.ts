import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Every function called and every table touched, in order, and what each call answers in turn. */
const db = vi.hoisted(() => ({
  rpcs: [] as Array<{ fn: string; args: unknown }>,
  rpcAnswers: [] as Array<{ data: unknown; error: unknown }>,
  tables: [] as string[],
}))

vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      db.tables.push(table)
      throw new Error(`no statement is expected on ${table}`)
    },
    rpc: (fn: string, args: unknown) => {
      db.rpcs.push({ fn, args })
      return Promise.resolve(db.rpcAnswers.shift() ?? { data: { ok: true, job_id: 'cccccccc-3333-4333-8333-333333333333', kind: 'notice_53_056', papers_restored: 1, papers_unset_aside: 0 }, error: null })
    },
  },
}))

import { LienUnvoidRefused, unvoidLienFiling } from './lienFilingUnvoidIo'

const REC = 'aaaaaaaa-1111-4111-8111-111111111111'
const row = (over: Record<string, unknown> = {}) => ({ id: REC, voided_at: '2026-11-24T20:00:00Z', applied_from: null, ...over })
/** A refusal the function raised, as PostgREST hands it back. */
const raised = (message: string) => ({ data: null, error: { message, code: 'P0001', details: null, hint: null } })

beforeEach(() => {
  db.rpcs.length = 0
  db.rpcAnswers.length = 0
  db.tables.length = 0
})

describe('unvoidLienFiling', () => {
  it('calls the function once with the record’s id, writes to no table itself, and answers what became of the papers', async () => {
    expect(await unvoidLienFiling(row())).toEqual({ restored: 1, unsetAside: 0 })
    expect(db.rpcs).toEqual([{ fn: 'unvoid_test_lien_filing', args: { p_filing_id: REC } }])
    expect(db.tables).toEqual([])
  })

  it('answers the counts for a paper set aside, and for a record with no paper', async () => {
    db.rpcAnswers.push({ data: { ok: true, papers_restored: 0, papers_unset_aside: 1 }, error: null }, { data: { ok: true, papers_restored: 0, papers_unset_aside: 0 }, error: null })
    expect(await unvoidLienFiling(row())).toEqual({ restored: 0, unsetAside: 1 })
    expect(await unvoidLienFiling(row())).toEqual({ restored: 0, unsetAside: 0 })
  })

  it('refuses a live record and a record that applied a paper already on record before anything is sent', async () => {
    await expect(unvoidLienFiling(row({ voided_at: null }))).rejects.toMatchObject({ name: 'LienUnvoidRefused', message: 'This record is not voided.' })
    await expect(unvoidLienFiling(row({ applied_from: 'bbbbbbbb-2222-4222-8222-222222222222' }))).rejects.toMatchObject({
      name: 'LienUnvoidRefused',
      message: 'This record applied a paper already on record. Undo was its take-back. It stays voided.',
    })
    expect(db.rpcs).toEqual([])
  })

  it('passes the function’s refusal on as its own sentence, with no “Failed to” in front', async () => {
    for (const sentence of [
      'Only a developer can put a voided record back.',
      'Only a record on a test job can be put back. This job is a real one.',
      'The paper this record sent has moved on since the void. The record stays voided.',
      'This record was voided before the app kept what a void does to its desk paper. It stays voided.',
    ]) {
      db.rpcAnswers.push(raised(sentence))
      const caught = await unvoidLienFiling(row()).then(
        () => null,
        (e: unknown) => e,
      )
      expect(caught).toBeInstanceOf(LienUnvoidRefused)
      expect((caught as Error).message).toBe(sentence)
    }
    expect(db.rpcs).toHaveLength(4)
  })

  it('does not read another error as a refusal, and sends the call once', async () => {
    db.rpcAnswers.push({ data: null, error: { message: 'Could not find the function public.unvoid_test_lien_filing(p_filing_id) in the schema cache', code: 'PGRST202', details: null, hint: null } })
    const caught = await unvoidLienFiling(row()).then(
      () => null,
      (e: unknown) => e,
    )
    expect(caught).toBeInstanceOf(Error)
    expect(caught).not.toBeInstanceOf(LienUnvoidRefused)
    expect(db.rpcs).toHaveLength(1)
  })

  it('throws when the database gives no answer it can read', async () => {
    for (const data of [null, {}, { ok: false }, { ok: true }]) {
      db.rpcAnswers.push({ data, error: null })
      const caught = await unvoidLienFiling(row()).then(
        () => null,
        (e: unknown) => e,
      )
      expect((caught as Error).message).toBe('The record was not put back. The database gave no answer.')
      expect(caught).not.toBeInstanceOf(LienUnvoidRefused)
    }
  })
})
