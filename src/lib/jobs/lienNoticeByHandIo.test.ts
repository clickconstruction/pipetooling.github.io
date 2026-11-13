/**
 * Recording a notice that went out by hand (punch list #243, PR 2): the covered job's live desk
 * item is marked sent on the mailing day the office typed, so letter two, the courtesy notice and
 * the desk's day count run from it; a notice recorded the day it went leaves the stamp to the trigger.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LienNoticeFields } from '../jobsDocuments/lienFilingDocuments'
import type { ByHandInput } from './lienNoticeByHand'

const db = vi.hoisted(() => ({
  inserts: [] as unknown[],
  updates: [] as { table: string; patch: Record<string, unknown>; id: unknown }[],
  reads: [] as string[],
}))

vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => ({
      insert: (payload: unknown) => {
        db.inserts.push(payload)
        const rows = (Array.isArray(payload) ? payload : [payload]).map((p, i) => ({ id: `f${i + 1}`, job_id: (p as { job_id: string }).job_id }))
        return { select: () => ({ then: (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(ok, bad) }) }
      },
      update: (patch: Record<string, unknown>) => ({
        eq: async (_col: string, id: unknown) => {
          db.updates.push({ table, patch, id })
          return { data: null, error: null }
        },
      }),
      select: () => {
        db.reads.push(table)
        const b: Record<string, unknown> = {
          then: (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok, bad),
        }
        for (const k of ['eq', 'is', 'in', 'not', 'order', 'limit']) b[k] = () => b
        return b
      },
    }),
  },
}))
vi.mock('../../utils/errorHandling', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/errorHandling')>()),
  withSupabaseRetry: async (op: () => PromiseLike<{ data: unknown; error: { message: string } | null }>) => {
    const r = await op()
    if (r.error) throw new Error(r.error.message)
    return r.data
  },
}))

import { recordLienNoticeByHand } from './lienNoticeByHandIo'

const fields: LienNoticeFields = { noticeDate: '2026-09-22', projectDescription: 'Dunmere (Linmoor) — 9703 Linmor Hl', claimantName: 'Click Plumbing and Electrical', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'RLC-Dunmere Mallin', contractedWithIfDifferent: '', claimAmount: '17585.00', contactPerson: 'Malachi Whites', claimantAddress: '5501 Balcones Dr' }

const input = (sentOn: string): ByHandInput => ({
  sentOn,
  method: 'mail',
  tracking: '',
  recipients: ['owner', 'original_contractor'],
  printedClaim: 28_987,
  printedMonths: ['2026-04', '2026-06'],
  documentUrl: '',
  documentNote: '',
  jobs: [
    { jobId: 'j273', label: '273 · Dunmere (Linmoor)', amount: 17_585, itemId: 'it273' },
    { jobId: 'j858', label: '858 · Service visit', amount: 7_902, itemId: null },
  ],
})

beforeEach(() => {
  db.inserts = []
  db.updates = []
  db.reads = []
})

describe('recordLienNoticeByHand', () => {
  it('mailed 2026-09-22 and recorded 2026-10-06: the item is marked sent at noon of the mailing day, and every clock reads day 14', async () => {
    const r = await recordLienNoticeByHand(input('2026-09-22'), { userId: 'u1', fields, todayYmd: '2026-10-06' })
    expect(r.filingIds).toEqual(['f1', 'f2'])
    const filings = db.inserts[0] as Array<{ job_id: string; sends: Array<{ sent_on: string }> }>
    expect(filings.map((f) => f.job_id)).toEqual(['j273', 'j858'])
    expect(filings[0]!.sends.map((s) => s.sent_on)).toEqual(['2026-09-22', '2026-09-22'])
    expect(db.updates).toEqual([{ table: 'job_lien_desk_items', patch: { status: 'sent', sent_filing_id: 'f1', sent_at: '2026-09-22T17:00:00.000Z' }, id: 'it273' }])
    // The job with no live item goes through the desk's sync, which reads and finds nothing to move.
    expect(db.reads).toContain('job_lien_desk_items')
  })
  it('mailed and recorded the same day: the write carries no sent_at, and the trigger stamps the moment', async () => {
    await recordLienNoticeByHand(input('2026-10-06'), { userId: 'u1', fields, todayYmd: '2026-10-06' })
    expect(db.updates).toEqual([{ table: 'job_lien_desk_items', patch: { status: 'sent', sent_filing_id: 'f1' }, id: 'it273' }])
  })
})
