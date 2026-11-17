import { describe, expect, it } from 'vitest'
import { CONTRACT_RECORD_ROLES, papersAmong, withPaperMark } from '../../../supabase/functions/_shared/driveLinkPapers'

const mark = { paper: 'signed' as const, contractId: 'c1', jobId: 'j1' }

describe('a found file that is a signed contract’s Drive copy (punch list #377)', () => {
  it('sends the record to the four roles that read job_contracts', () => {
    for (const role of CONTRACT_RECORD_ROLES) {
      expect(withPaperMark({ id: 'f1' }, mark, role)).toEqual({ id: 'f1', paper: 'signed', contract_id: 'c1', contract_job_id: 'j1' })
    }
  })
  it('sends an estimator the mark and never the record', () => {
    expect(withPaperMark({ id: 'f1' }, mark, 'estimator')).toEqual({ id: 'f1', paper: 'signed' })
    expect(withPaperMark({ id: 'f1' }, mark, null)).toEqual({ id: 'f1', paper: 'signed' })
  })
  it('leaves any other file as it was', () => {
    const hit = { id: 'f2', name: 'Permit.pdf' }
    expect(withPaperMark(hit, undefined, 'dev')).toBe(hit)
  })
})

describe('reading the papers among the hits', () => {
  /** A stand-in for the service client: one read of job_contracts, answered or refused. */
  const client = (answer: { data: unknown; error: unknown }, seen: { ids?: string[] } = {}) =>
    ({
      from: () => ({
        select: () => ({
          in: (_col: string, ids: string[]) => {
            seen.ids = ids
            return { limit: () => Promise.resolve(answer) }
          },
        }),
      }),
    }) as never

  it('asks once for the distinct ids and marks what the rows say', async () => {
    const seen: { ids?: string[] } = {}
    const marks = await papersAmong(client({ data: [{ id: 'c1', job_id: 'j1', status: 'signed', voided_at: null, drive_file_id: 'f1', drive_file_origin: 'filed' }], error: null }, seen), ['f1', 'f1', '', 'f2'])
    expect(seen.ids).toEqual(['f1', 'f2'])
    expect(marks.get('f1')).toEqual(mark)
    expect(marks.has('f2')).toBe(false)
  })
  it('marks nothing when the read is refused, as a database from before the Drive columns refuses it', async () => {
    expect((await papersAmong(client({ data: null, error: { message: 'column job_contracts.drive_file_id does not exist' } }), ['f1'])).size).toBe(0)
  })
  it('asks nothing when there are no hits', async () => {
    const seen: { ids?: string[] } = {}
    expect((await papersAmong(client({ data: [], error: null }, seen), [])).size).toBe(0)
    expect(seen.ids).toBeUndefined()
  })
})
