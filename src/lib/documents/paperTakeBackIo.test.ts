import { beforeEach, describe, expect, it, vi } from 'vitest'

/** What the database answers each statement in turn, and every call each statement made on its query, in order. */
const db = vi.hoisted(() => ({
  answers: [] as Array<{ data: unknown; error: unknown }>,
  statements: [] as Array<{ table: string; calls: Array<[string, unknown[]]> }>,
  rpcs: [] as Array<{ fn: string; args: unknown }>,
}))

vi.mock('../supabase', () => {
  const builder = (table: string) => {
    const statement = { table, calls: [] as Array<[string, unknown[]]> }
    db.statements.push(statement)
    const b: Record<string, unknown> = new Proxy(
      {},
      {
        get: (_t, op: string) => {
          if (op === 'then') {
            return (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(db.answers.shift() ?? { data: null, error: null }).then(resolve, reject)
          }
          return (...args: unknown[]) => {
            statement.calls.push([op, args])
            return b
          }
        },
      },
    )
    return b
  }
  return {
    supabase: {
      from: (table: string) => builder(table),
      rpc: (fn: string, args: unknown) => {
        db.rpcs.push({ fn, args })
        return Promise.resolve(db.answers.shift() ?? { data: null, error: null })
      },
    },
  }
})

import { PAPERS_TABLE, takeBackCompanyPaper, takeBackPartyPaper } from './paperTakeBackIo'

beforeEach(() => {
  db.answers.length = 0
  db.statements.length = 0
  db.rpcs.length = 0
})

describe('takeBackPartyPaper', () => {
  it('deletes in one statement that asks for a party’s unsigned paper no job requires', async () => {
    db.answers.push({ data: [{ id: 'd1' }], error: null })
    expect(await takeBackPartyPaper('d1')).toEqual({ kind: 'taken' })
    expect(db.statements).toHaveLength(1)
    expect(db.statements[0]?.table).toBe(PAPERS_TABLE)
    expect(db.statements[0]?.calls).toEqual([
      ['delete', []],
      ['eq', ['id', 'd1']],
      ['not', ['party_contact_id', 'is', null]],
      ['is', ['job_id', null]],
      ['in', ['status', ['unsent', 'sent']]],
      ['select', ['id']],
    ])
  })

  it('never asks the database to delete a signed paper', async () => {
    db.answers.push({ data: [{ id: 'd1' }], error: null })
    await takeBackPartyPaper('d1')
    const statuses = db.statements[0]?.calls.find(([op, args]) => op === 'in' && args[0] === 'status')?.[1][1]
    expect(statuses).not.toContain('signed')
    expect(statuses).not.toContain('received')
  })

  it('a paper signed a moment before the press is kept: nothing was removed, and it reads signed', async () => {
    db.answers.push({ data: [], error: null }, { data: { status: 'signed' }, error: null })
    expect(await takeBackPartyPaper('d1')).toEqual({ kind: 'signed-since' })
    expect(db.statements).toHaveLength(2)
    expect(db.statements[1]?.calls).toEqual([
      ['select', ['status']],
      ['eq', ['id', 'd1']],
      ['maybeSingle', []],
    ])
  })

  it('a paper that is not there any more was taken back already', async () => {
    db.answers.push({ data: [], error: null }, { data: null, error: null })
    expect(await takeBackPartyPaper('d1')).toEqual({ kind: 'gone' })
  })

  it('a paper still out that the database would not remove: the account may not delete it', async () => {
    db.answers.push({ data: [], error: null }, { data: { status: 'sent' }, error: null })
    expect(await takeBackPartyPaper('d1')).toEqual({ kind: 'refused' })
  })

  it('a refusal in words is thrown with its reason, and nothing is read after', async () => {
    db.answers.push({ data: null, error: { code: '42501', message: 'This account is read only.' } })
    await expect(takeBackPartyPaper('d1')).rejects.toBeTruthy()
    expect(db.statements).toHaveLength(1)
  })
})

describe('takeBackCompanyPaper', () => {
  it('goes through the function alone, with the paper’s key, and never deletes the row itself', async () => {
    db.answers.push({ data: 'taken', error: null })
    expect(await takeBackCompanyPaper('g1')).toEqual({ kind: 'taken' })
    expect(db.rpcs).toEqual([{ fn: 'take_back_company_paper', args: { p_document_id: 'g1' } }])
    expect(db.statements).toHaveLength(0)
  })

  it('reads a paper signed before the press, and one that is gone', async () => {
    db.answers.push({ data: 'signed', error: null }, { data: 'gone', error: null })
    expect(await takeBackCompanyPaper('g1')).toEqual({ kind: 'signed-since' })
    expect(await takeBackCompanyPaper('g1')).toEqual({ kind: 'gone' })
  })

  it('a refusal in words is thrown with those words: a paper GC mode is waiting on', async () => {
    const words = 'W-9 stays with Juniper Mechanical LLC, since GC mode asked for it by Nov 30. It is GC mode’s paper to chase.'
    db.answers.push({ data: null, error: { code: 'P0001', message: words } })
    await expect(takeBackCompanyPaper('g1')).rejects.toMatchObject({ message: expect.stringContaining('GC mode asked for it by Nov 30') })
  })

  it('an answer it does not know is a failure, never a paper taken back', async () => {
    db.answers.push({ data: null, error: null })
    await expect(takeBackCompanyPaper('g1')).rejects.toThrow('The app could not tell whether the paper was taken back. Read the list again.')
  })
})
