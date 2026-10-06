/**
 * Recording the run (punch list #87 B): the notice is written first, then the
 * original contractor's courtesy PDF goes by email beside the paper copy. A
 * courtesy email failing never un-records the notice; an envelope sent by
 * email gets no second email.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RunNotice } from './lienDeskRun'
import type { CombinedRunNotice } from './lienNoticeCombine'

const db = vi.hoisted(() => ({
  events: [] as string[],
  inserts: [] as unknown[],
  invokes: [] as { name: string; body: Record<string, unknown> }[],
  insertError: null as string | null,
  invokeError: null as string | null,
}))

vi.mock('../supabase', () => ({
  supabase: {
    functions: {
      invoke: async (name: string, { body }: { body: Record<string, unknown> }) => {
        db.events.push(`email ${String(body.to_email)}`)
        db.invokes.push({ name, body })
        return db.invokeError ? { data: { error: db.invokeError }, error: null } : { data: { success: true, resend_email_id: 're_1' }, error: null }
      },
    },
    from: () => ({
      insert: (payload: unknown) => {
        db.events.push('insert')
        db.inserts.push(payload)
        const rows = (Array.isArray(payload) ? payload : [payload]).map((p, i) => ({ id: `f${i + 1}`, job_id: (p as { job_id: string }).job_id }))
        const res = db.insertError ? { data: null, error: { message: db.insertError } } : { data: rows, error: null }
        return {
          select: () => ({
            single: async () => (res.error ? res : { data: rows[0], error: null }),
            then: (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve(res).then(ok, bad),
          }),
        }
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
vi.mock('../jobsDocuments/lienFilingDocuments', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../jobsDocuments/lienFilingDocuments')>()),
  filingDocPdfBlob: async () => new Blob(['%PDF-1.4 notice']),
}))
vi.mock('./lienDeskIo', () => ({ markLienDeskItemSent: async (itemId: string) => void db.events.push(`sent ${itemId}`) }))
vi.mock('./lienClaimCorrectionIo', () => ({ clearOneShotLienClaimCorrection: async () => undefined }))

import { recordLienDeskRun } from './lienDeskRunIo'

function notice(partial: Partial<RunNotice> = {}): RunNotice {
  return {
    itemId: 'it1',
    jobId: 'j650',
    kind: 'notice_53_056',
    label: '650 · ATI Schertz',
    jobNumber: '650',
    months: ['2026-06', '2026-07'],
    amount: 33_500,
    fields: { noticeDate: '2026-10-06', projectDescription: 'ATI Schertz — 1204 Elbel Rd', claimantName: 'Click Plumbing and Electrical', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'Loberg Contracting', contractedWithIfDifferent: '', claimAmount: '33500.00', contactPerson: 'Robert', claimantAddress: '5501 Balcones Dr' },
    extras: { refItems: ['Job #650'] },
    coverLetter: null,
    coverNote: null,
    ownerUnconfirmed: false,
    recipients: [
      { key: 'owner', label: 'Owner of record', name: 'Elbel Holdings LLC', address: '4 Example Way, Schertz, TX', email: 'owner@elbel.test', method: 'certified_mail', tracking: '9407 1' },
      { key: 'original_contractor', label: 'Original contractor', name: 'Loberg Contracting', address: '2904 Corporate Cr', email: 'office@loberg.test', method: 'certified_mail', tracking: '9407 2', courtesy: true },
    ],
    ...partial,
  }
}

const gcWith = (n: RunNotice, patch: Partial<RunNotice['recipients'][number]>): RunNotice => ({ ...n, recipients: n.recipients.map((r) => (r.key === 'original_contractor' ? { ...r, ...patch } : r)) })
const OPTS = { userId: 'u1', todayYmd: '2026-10-06' }

beforeEach(() => {
  db.events = []
  db.inserts = []
  db.invokes = []
  db.insertError = null
  db.invokeError = null
})

describe('recordLienDeskRun · the courtesy PDF (punch list #87 B)', () => {
  it('writes the notice first, then emails the GC its copy with words for the form and the mail', async () => {
    const result = await recordLienDeskRun([notice()], OPTS)
    expect(db.events).toEqual(['insert', 'sent it1', 'email office@loberg.test'])
    expect(db.invokes).toHaveLength(1)
    expect(db.invokes[0]!.name).toBe('send-lien-filing-email')
    expect(db.invokes[0]!.body).toMatchObject({
      job_id: 'j650',
      to_email: 'office@loberg.test',
      recipient_label: 'original_contractor',
      subject: 'Courtesy copy: notice of claim for unpaid labor or materials — 650 · ATI Schertz',
      email_text: 'Attached is a courtesy copy of our notice of claim for unpaid labor or materials (Tex. Prop. Code § 53.056). The notice itself is being delivered by certified mail.',
    })
    // The statutory record is the paper: the courtesy email is not one of the sends.
    expect((db.inserts[0] as { sends: { recipient: string; method: string; tracking: string }[] }).sends).toEqual([
      { recipient: 'owner', method: 'certified_mail', tracking: '9407 1', sent_on: '2026-10-06' },
      { recipient: 'original_contractor', method: 'certified_mail', tracking: '9407 2', sent_on: '2026-10-06' },
    ])
    expect(result).toEqual({ recorded: ['it1'], failed: [], courtesySent: [{ itemId: 'it1', label: '650 · ATI Schertz', email: 'office@loberg.test' }], courtesyFailed: [] })
  })

  it('a courtesy email that fails leaves the notice recorded and says why', async () => {
    db.invokeError = 'Resend 502'
    const result = await recordLienDeskRun([notice()], OPTS)
    expect(result.recorded).toEqual(['it1'])
    expect(result.failed).toEqual([])
    expect(result.courtesySent).toEqual([])
    expect(result.courtesyFailed).toEqual([{ itemId: 'it1', label: '650 · ATI Schertz', email: 'office@loberg.test', reason: 'Resend 502' }])
  })

  it('a notice that fails to record sends no courtesy email', async () => {
    db.insertError = 'lock timeout'
    const result = await recordLienDeskRun([notice()], OPTS)
    expect(result.failed.map((f) => f.itemId)).toEqual(['it1'])
    expect(db.invokes).toEqual([])
    expect(result.courtesySent).toEqual([])
  })

  it('an unticked copy sends nothing, and an envelope sent by email gets one email, not two', async () => {
    await recordLienDeskRun([gcWith(notice(), { courtesy: false })], OPTS)
    expect(db.events).toEqual(['insert', 'sent it1'])
    expect(db.invokes).toEqual([])
    db.events = []
    db.inserts = []
    const result = await recordLienDeskRun([gcWith(notice(), { method: 'email', tracking: '' })], OPTS)
    expect(db.invokes).toHaveLength(1)
    // the email method's own send, before the record, with the function's own words
    expect(db.events.slice(0, 2)).toEqual(['email office@loberg.test', 'insert'])
    expect(db.invokes[0]!.body.subject).toBeUndefined()
    expect((db.inserts[0] as { sends: { recipient: string; tracking: string }[] }).sends[1]!.tracking).toBe('resend:re_1 → office@loberg.test')
    expect(result.courtesySent).toEqual([])
  })

  it('one notice for the jobs at a property emails its courtesy copy once, after every part is recorded', async () => {
    const combined: CombinedRunNotice = {
      ...notice({ label: 'ATI Schertz · 650 + 651', jobNumber: '650 + 651', amount: 38_000 }),
      parts: [
        { itemId: 'it1', jobId: 'j650', jobNumber: '650', label: '650 · ATI Schertz', amount: 33_500, months: ['2026-06', '2026-07'] },
        { itemId: 'it2', jobId: 'j651', jobNumber: '651', label: '651 · ATI Schertz annex', amount: 4_500, months: ['2026-08'] },
      ],
    }
    const result = await recordLienDeskRun([combined], OPTS)
    expect(db.events).toEqual(['insert', 'sent it1', 'sent it2', 'email office@loberg.test'])
    expect(result.recorded).toEqual(['it1', 'it2'])
    expect(result.courtesySent).toEqual([{ itemId: 'it1', label: 'ATI Schertz · 650 + 651', email: 'office@loberg.test' }])
  })
})
