import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  reads: [] as Array<{ table: string; cols: string; isNull: string; order: string }>,
  calls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  read: (): { data: unknown[] | null; error: { code?: string } | null } => ({ data: [], error: null }),
  rpc: (): { data: unknown; error: { message?: string } | null } => ({ data: { ok: true, changed: true }, error: null }),
}))

vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: (cols: string) => ({
        is: (isNull: string) => ({
          order: (order: string) => {
            db.reads.push({ table, cols, isNull, order })
            return Promise.resolve(db.read())
          },
        }),
      }),
    }),
    rpc: (fn: string, args: Record<string, unknown>) => {
      db.calls.push({ fn, args })
      return Promise.resolve(db.rpc())
    },
  },
}))

import { lienPrintStandsFromRow, readLienPrintStands, writeLienPrintStands } from './lienPrintStandsIo'

const ROW = { id: 's1', job_id: 'j1', paper: 'affidavit', change_key: 'affidavit:1:abc', changes: [{ key: 'unpaidAmount', label: 'The amount unpaid', printed: '$610.00', now: '$310.00' }, { nothing: true }, null], sent_document_id: 'c1', stood_by: 'u1', stood_at: '2026-11-25T20:00:00Z' }

beforeEach(() => {
  db.reads = []
  db.calls = []
  db.read = () => ({ data: [], error: null })
  db.rpc = () => ({ data: { ok: true, changed: true }, error: null })
})

describe('readLienPrintStands', () => {
  it('reads the answers that stand, oldest first, and parses each row defensively', async () => {
    db.read = () => ({ data: [ROW, { ...ROW, id: 's2', paper: 'other' }, { ...ROW, id: '' }, null], error: null })
    const rows = await readLienPrintStands()
    expect(db.reads).toEqual([{ table: 'lien_print_stands', cols: 'id, job_id, paper, change_key, changes, sent_document_id, stood_by, stood_at', isNull: 'taken_back_at', order: 'stood_at' }])
    expect(rows).toEqual([{ id: 's1', jobId: 'j1', paper: 'affidavit', changeKey: 'affidavit:1:abc', changes: [{ key: 'unpaidAmount', label: 'The amount unpaid', printed: '$610.00', now: '$310.00' }], sentDocumentId: 'c1', stoodBy: 'u1', stoodAt: '2026-11-25T20:00:00Z' }])
    expect(lienPrintStandsFromRow({ ...ROW, sent_document_id: null })!.sentDocumentId).toBeNull()
  })

  it('is null when the table cannot be read, as before its migration is pushed', async () => {
    db.read = () => ({ data: null, error: { code: 'PGRST205' } })
    expect(await readLienPrintStands()).toBeNull()
  })
})

describe('writeLienPrintStands', () => {
  it('says a paper stands through one difference, with what had changed and the filed print', async () => {
    const out = await writeLienPrintStands({ jobId: 'j1', paper: 'affidavit', stands: true, changeKey: 'affidavit:1:abc', changes: [{ key: 'unpaidAmount', label: 'The amount unpaid', printed: '$610.00', now: '$310.00' }], sentDocumentId: 'c1' })
    expect(out).toEqual({ changed: true })
    expect(db.calls).toEqual([{ fn: 'set_lien_print_stands', args: { p_job_id: 'j1', p_paper: 'affidavit', p_stands: true, p_change_key: 'affidavit:1:abc', p_changes: [{ key: 'unpaidAmount', label: 'The amount unpaid', printed: '$610.00', now: '$310.00' }], p_sent_document_id: 'c1' } }])
  })

  it('takes the answer back by the paper alone', async () => {
    await writeLienPrintStands({ jobId: 'j1', paper: 'notice', stands: false })
    expect(db.calls).toEqual([{ fn: 'set_lien_print_stands', args: { p_job_id: 'j1', p_paper: 'notice', p_stands: false } }])
  })

  it('throws with the function’s own words when it refuses, and with plain words when it says nothing', async () => {
    db.rpc = () => ({ data: { error: 'Not authorized to say a lien paper stands as printed' }, error: null })
    await expect(writeLienPrintStands({ jobId: 'j1', paper: 'notice', stands: false })).rejects.toThrow('Not authorized to say a lien paper stands as printed')
    db.rpc = () => ({ data: null, error: null })
    await expect(writeLienPrintStands({ jobId: 'j1', paper: 'notice', stands: true, changeKey: 'k', changes: [], sentDocumentId: null })).rejects.toThrow('The answer was not kept.')
    await expect(writeLienPrintStands({ jobId: 'j1', paper: 'notice', stands: false })).rejects.toThrow('The answer was not taken back.')
    db.rpc = () => ({ data: null, error: { message: 'function does not exist' } })
    await expect(writeLienPrintStands({ jobId: 'j1', paper: 'notice', stands: false })).rejects.toMatchObject({ message: 'function does not exist' })
  })
})
