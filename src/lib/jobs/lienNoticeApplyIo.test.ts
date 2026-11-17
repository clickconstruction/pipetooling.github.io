/**
 * Applying a notice that already went (v2.7508): one row on this job, the waiting notice set aside with its reason,
 * and an undo that voids the row and puts the notice back. The paper's own row is never written.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LienRecordedPaper } from './lienNoticeApply'

const db = vi.hoisted(() => ({
  inserts: [] as Array<{ table: string; payload: Record<string, unknown> }>,
  updates: [] as Array<{ table: string; patch: Record<string, unknown>; id: unknown }>,
  failItemUpdate: false,
  voidedItems: [] as Array<{ id: string; fields: unknown }>,
}))

vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => ({
      insert: (payload: Record<string, unknown>) => {
        db.inserts.push({ table, payload })
        return { select: () => ({ single: async () => ({ data: { id: 'new' }, error: null }) }) }
      },
      update: (patch: Record<string, unknown>) => {
        const run = (id: unknown) => {
          db.updates.push({ table, patch, id })
          const fail = table === 'job_lien_desk_items' && db.failItemUpdate
          return { data: null, error: fail ? { message: 'refused' } : null }
        }
        return {
          eq: (_col: string, id: unknown) => {
            const out = run(id)
            return { is: async () => out, then: (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve(out).then(ok, bad) }
          },
        }
      },
      select: () => {
        const b: Record<string, unknown> = {
          then: (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve({ data: table === 'job_lien_desk_items' ? db.voidedItems : [], error: null }).then(ok, bad),
        }
        for (const k of ['eq', 'is', 'in', 'not']) b[k] = () => b
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

import { applyLienNoticePaper, undoLienNoticeApply } from './lienNoticeApplyIo'

const paper: LienRecordedPaper = {
  key: 'sent:2026-09-22:certified_mail:11',
  sourceFilingId: 'f1',
  sourceJobId: 'j4101',
  sourceJobLabel: '4101',
  sentOn: '2026-09-22',
  method: 'certified_mail',
  tracking: '11',
  toOwner: true,
  toContractor: false,
  claimAsPrinted: 12_400,
  monthsPrinted: ['2026-06', '2026-07', '2026-08'],
  jobLabels: ['4101', '4112'],
  documentUrl: '',
  sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '11', sent_on: '2026-09-22' }],
  packetId: 'p1',
  fields: {},
}
const input = { paper, job: { id: 'j4107', amount: 1_900 }, months: ['2026-09'], reason: 'Its total held this job’s unpaid bill.', userId: 'u1', userName: 'Dana' }

beforeEach(() => {
  db.inserts.length = 0
  db.updates.length = 0
  db.failItemUpdate = false
  db.voidedItems = []
})

describe('applying a notice already on record (v2.7508)', () => {
  it('writes one row on this job and sets the waiting notice aside, kept with its fields', async () => {
    const out = await applyLienNoticePaper({ ...input, setAside: { id: 'it1', fields: { gcEmail: 'gc@example.com' } } })
    expect(out).toEqual({ filingId: 'new', setAside: true })
    expect(db.inserts).toHaveLength(1)
    expect(db.inserts[0]).toMatchObject({ table: 'job_lien_filings', payload: { job_id: 'j4107', months_covered: ['2026-09'], applied_from: 'f1', applied_from_label: '4101', applied_by_name: 'Dana' } })
    expect(db.updates).toHaveLength(1)
    const u = db.updates[0]!
    expect(u).toMatchObject({ table: 'job_lien_desk_items', id: 'it1' })
    expect(typeof u.patch.voided_at).toBe('string')
    expect(u.patch.fields).toMatchObject({ gcEmail: 'gc@example.com', setAsideNoticed: { filingId: 'new', by: 'u1', byName: 'Dana', sentOn: '2026-09-22', fromLabel: '4101' } })
    // The paper's own row is never written.
    expect(db.updates.some((x) => x.id === 'f1')).toBe(false)
  })

  it('leaves the desk alone when no notice is to be set aside', async () => {
    expect(await applyLienNoticePaper({ ...input, setAside: null })).toEqual({ filingId: 'new', setAside: false })
    expect(db.updates).toEqual([])
  })

  it('voids the new row again when the notice cannot be set aside', async () => {
    db.failItemUpdate = true
    await expect(applyLienNoticePaper({ ...input, setAside: { id: 'it1', fields: {} } })).rejects.toThrow('refused')
    const last = db.updates[db.updates.length - 1]!
    expect(last).toMatchObject({ table: 'job_lien_filings', id: 'new' })
    expect(typeof last.patch.voided_at).toBe('string')
  })

  it('undo voids the applied row and puts back the notice it set aside', async () => {
    db.voidedItems = [
      { id: 'other', fields: { runClosedPaid: { at: 'x' } } },
      { id: 'it1', fields: { gcEmail: 'gc@example.com', setAsideNoticed: { filingId: 'new' } } },
    ]
    expect(await undoLienNoticeApply({ id: 'new', job_id: 'j4107' })).toEqual({ restored: true })
    expect(db.updates[0]).toMatchObject({ table: 'job_lien_filings', id: 'new' })
    expect(db.updates[1]).toEqual({ table: 'job_lien_desk_items', id: 'it1', patch: { voided_at: null, fields: { gcEmail: 'gc@example.com' } } })
  })

  it('undo says so when there is nothing to put back, or it cannot stand beside a newer notice', async () => {
    expect(await undoLienNoticeApply({ id: 'new', job_id: 'j4107' })).toEqual({ restored: false })
    db.voidedItems = [{ id: 'it1', fields: { setAsideNoticed: { filingId: 'new' } } }]
    db.failItemUpdate = true
    expect(await undoLienNoticeApply({ id: 'new', job_id: 'j4107' })).toEqual({ restored: false })
  })
})
