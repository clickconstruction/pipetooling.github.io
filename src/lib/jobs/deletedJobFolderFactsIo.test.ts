/**
 * Recently deleted's read of the deleted jobs' Drive links (punch list #443, row 18): one statement on the archive,
 * three columns of the kept row and no more, by the bundles' ids. Made-up ids.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  answer: { data: [] as unknown, error: null as unknown },
  statements: [] as Array<{ table: string; calls: Array<[string, unknown[]]> }>,
}))

vi.mock('../supabase', () => {
  const builder = (table: string) => {
    const statement = { table, calls: [] as Array<[string, unknown[]]> }
    db.statements.push(statement)
    const b: Record<string, unknown> = new Proxy(
      {},
      {
        get: (_t, op: string) => {
          if (op === 'then') return (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(db.answer).then(resolve, reject)
          return (...args: unknown[]) => {
            statement.calls.push([op, args])
            return b
          }
        },
      },
    )
    return b
  }
  return { supabase: { from: (table: string) => builder(table), functions: { invoke: async () => ({ data: null, error: null }) } } }
})

import { readDeletedJobFolderFacts } from './jobDriveFoldersIo'

const LINK = 'https://drive.google.com/drive/folders/job-folder-id'

beforeEach(() => {
  db.answer = { data: [], error: null }
  db.statements.length = 0
})

describe('readDeletedJobFolderFacts', () => {
  it('reads three columns of each deleted job’s kept row, by id, the newest copy first, and never a restored one', async () => {
    db.answer = {
      data: [
        { record_id: 'job-a', job_name: 'ZZ Test Payoff 1', customer_name: 'ZZ Test Payoff Customer', google_drive_link: LINK },
        { record_id: 'job-b', job_name: 'Cedar Bend', customer_name: 'Ridge Builders', google_drive_link: null },
      ],
      error: null,
    }
    const facts = await readDeletedJobFolderFacts(['job-a', 'job-b', 'job-a', ''])
    expect(facts.get('job-a')).toEqual({ job_name: 'ZZ Test Payoff 1', customer_name: 'ZZ Test Payoff Customer', google_drive_link: LINK })
    expect(facts.get('job-b')?.google_drive_link).toBeNull()
    expect(db.statements).toHaveLength(1)
    expect(db.statements[0]?.table).toBe('deleted_records_archive')
    expect(db.statements[0]?.calls).toEqual([
      ['select', ['record_id, job_name:row_data->>job_name, customer_name:row_data->>customer_name, google_drive_link:row_data->>google_drive_link']],
      ['eq', ['table_name', 'jobs_ledger']],
      ['in', ['record_id', ['job-a', 'job-b']]],
      ['is', ['restored_at', null]],
      ['order', ['deleted_at', { ascending: false }]],
    ])
  })
  it('reads nothing when no job is listed', async () => {
    expect((await readDeletedJobFolderFacts([])).size).toBe(0)
    expect((await readDeletedJobFolderFacts(['', ''])).size).toBe(0)
    expect(db.statements).toEqual([])
  })
  it('throws when the archive does not read', async () => {
    db.answer = { data: null, error: { message: 'permission denied', code: '42501' } }
    await expect(readDeletedJobFolderFacts(['job-a'])).rejects.toBeTruthy()
  })
})
