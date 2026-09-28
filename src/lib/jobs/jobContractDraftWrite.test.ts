import { beforeEach, describe, expect, it, vi } from 'vitest'

type Step = { op: 'update' | 'insert'; table: string; payload: Record<string, unknown>; filters: unknown[][] }
/** The client records every write; an update answers with the row it was told to write over. */
const db = vi.hoisted(() => ({ steps: [] as Step[], row: null as Record<string, unknown> | null, updateError: null as unknown }))
vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      const step: Step = { op: 'insert', table, payload: {}, filters: [] }
      const b = {
        update: (payload: Record<string, unknown>) => ((step.op = 'update'), (step.payload = payload), b),
        insert: (payload: Record<string, unknown>) => ((step.op = 'insert'), (step.payload = payload), b),
        eq: (col: string, val: unknown) => (step.filters.push([col, val]), b),
        select: () => b,
        single: async () => {
          db.steps.push(step)
          if (step.op === 'update' && db.updateError) return { data: null, error: db.updateError }
          return { data: step.op === 'update' ? { ...db.row, ...step.payload } : { id: 'new', ...step.payload }, error: null }
        },
      }
      return b
    },
  },
}))
vi.mock('../../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => PromiseLike<{ data: unknown; error: unknown }>) => {
    const r = await op()
    if (r.error) throw r.error
    return r.data
  },
}))

import { buildJobContractDraftPayload, refreshJobContractDraftTerms, saveJobContractDraft } from './jobContractDraftWrite'
import { DEFAULT_JOB_CONTRACT_TERMS_PLAIN, EMPTY_JOB_CONTRACT_FIELDS } from './jobContractDocument'
import type { JobContractRow } from './jobContractLifecycle'

const BOOK = { id: 't1', document_name: 'Service agreement', book_body_html: '<p>New wording</p>', book_body_format: 'html', book_version_date: '2026-09-27' }
const TERMS_NOW = { body_html: '<p>New wording</p>', body_format: 'html', template_document_id: 't1', template_name: 'Service agreement', template_version_date: '2026-09-27' }
function draftRow(p: Partial<JobContractRow> = {}): JobContractRow {
  return { id: 'd1', job_id: 'j1', status: 'draft', voided_at: null, revision: 1, fields: {}, body_html: '<p>Old wording</p>', body_format: 'html', template_document_id: 't1', template_name: 'Service agreement', template_version_date: '2026-09-20', ...p } as JobContractRow
}
function payloadWith(template: typeof BOOK | null) {
  return buildJobContractDraftPayload({ jobId: 'j1', fields: { ...EMPTY_JOB_CONTRACT_FIELDS, scope_lines: ['Water heater swap'] }, template, recipientName: 'May Lee', recipientEmail: 'may@corewellpartners.com', recipientPhone: null })
}
const TERMS_KEYS = ['body_html', 'body_format', 'template_document_id', 'template_name', 'template_version_date']

beforeEach(() => {
  db.steps = []
  db.row = null
  db.updateError = null
})

describe('buildJobContractDraftPayload', () => {
  it('carries the fields, the chosen terms and the recipient; blanks become null', () => {
    const p = buildJobContractDraftPayload({
      jobId: 'j1',
      fields: { ...EMPTY_JOB_CONTRACT_FIELDS, scope_lines: ['Water heater swap'], amount_cents: 240000 },
      template: { id: 't1', document_name: 'Residential service agreement', book_body_html: '<p>Terms</p>', book_body_format: 'html', book_version_date: '2026-09-01' },
      recipientName: ' May Lee ',
      recipientEmail: 'may@corewellpartners.com',
      recipientPhone: '',
    })
    expect(p).toMatchObject({
      job_id: 'j1',
      body_html: '<p>Terms</p>',
      body_format: 'html',
      template_document_id: 't1',
      template_name: 'Residential service agreement',
      template_version_date: '2026-09-01',
      recipient_name: 'May Lee',
      recipient_email: 'may@corewellpartners.com',
      recipient_phone: null,
    })
    expect((p.fields as { scope_lines: string[]; amount_cents: number }).scope_lines).toEqual(['Water heater swap'])
    expect((p.fields as { amount_cents: number }).amount_cents).toBe(240000)
  })

  it('with no template the built-in terms ride along as plain text', () => {
    const p = buildJobContractDraftPayload({ jobId: 'j1', fields: EMPTY_JOB_CONTRACT_FIELDS, template: null, recipientName: '', recipientEmail: '', recipientPhone: null })
    expect(p.body_html).toBe(DEFAULT_JOB_CONTRACT_TERMS_PLAIN)
    expect(p.body_format).toBe('plain')
    expect(p.template_document_id).toBeNull()
    expect(p.template_name).toBe('Built-in service agreement terms')
    expect(p.recipient_name).toBeNull()
  })
})

describe('saveJobContractDraft', () => {
  it('a draft from the same Book document takes the current wording with the edit', async () => {
    const existing = draftRow()
    db.row = existing
    const row = await saveJobContractDraft({ existing, payload: payloadWith(BOOK), authUserId: 'u1' })
    expect(db.steps).toHaveLength(1)
    expect(db.steps[0]!.op).toBe('update')
    expect(db.steps[0]!.filters).toEqual([['id', 'd1'], ['status', 'draft']])
    expect(db.steps[0]!.payload).toMatchObject({ ...TERMS_NOW, recipient_name: 'May Lee' })
    expect(row?.body_html).toBe('<p>New wording</p>')
    expect(row?.template_version_date).toBe('2026-09-27')
  })

  it('a draft from another document, or from the built-in wording, keeps its terms — only the edit is written', async () => {
    for (const existing of [draftRow({ template_document_id: 't2', template_name: 'Commercial agreement' }), draftRow({ template_document_id: null, template_name: 'Built-in service agreement terms' })]) {
      db.steps = []
      db.row = existing
      const row = await saveJobContractDraft({ existing, payload: payloadWith(BOOK), authUserId: 'u1' })
      expect(db.steps[0]!.op).toBe('update')
      for (const k of TERMS_KEYS) expect(k in db.steps[0]!.payload).toBe(false)
      expect(db.steps[0]!.payload.recipient_email).toBe('may@corewellpartners.com')
      expect(row?.body_html).toBe('<p>Old wording</p>')
    }
  })

  it('a Book draft saved while the sweep is on the built-in wording keeps its terms', async () => {
    const existing = draftRow()
    db.row = existing
    await saveJobContractDraft({ existing, payload: payloadWith(null), authUserId: 'u1' })
    for (const k of TERMS_KEYS) expect(k in db.steps[0]!.payload).toBe(false)
  })

  it('a draft already on the current wording writes no terms', async () => {
    const existing = draftRow(TERMS_NOW)
    db.row = existing
    await saveJobContractDraft({ existing, payload: payloadWith(BOOK), authUserId: 'u1' })
    for (const k of TERMS_KEYS) expect(k in db.steps[0]!.payload).toBe(false)
  })

  it('a caller holding an older version of the document writes the edit and leaves the newer terms alone', async () => {
    const existing = draftRow(TERMS_NOW)
    db.row = existing
    const row = await saveJobContractDraft({ existing, payload: payloadWith({ ...BOOK, book_body_html: '<p>Old wording</p>', book_version_date: '2026-09-20' }), authUserId: 'u1' })
    for (const k of TERMS_KEYS) expect(k in db.steps[0]!.payload).toBe(false)
    expect(db.steps[0]!.payload.recipient_name).toBe('May Lee')
    expect(row?.body_html).toBe('<p>New wording</p>')
    expect(row?.template_version_date).toBe('2026-09-27')
  })

  it('a sent row is locked: nothing is written and it comes back as it was', async () => {
    const existing = draftRow({ status: 'sent' })
    await expect(saveJobContractDraft({ existing, payload: payloadWith(BOOK), authUserId: 'u1' })).resolves.toBe(existing)
    expect(db.steps).toEqual([])
  })

  it('no row: a fresh draft is inserted with the template’s terms', async () => {
    await saveJobContractDraft({ existing: null, payload: payloadWith(BOOK), authUserId: 'u1' })
    expect(db.steps).toHaveLength(1)
    expect(db.steps[0]!.op).toBe('insert')
    expect(db.steps[0]!.payload).toMatchObject({ ...TERMS_NOW, job_id: 'j1', status: 'draft', created_by: 'u1' })
  })
})

describe('refreshJobContractDraftTerms', () => {
  it('writes the terms alone, guarded to drafts, and returns the refreshed row', async () => {
    const existing = draftRow()
    db.row = existing
    const row = await refreshJobContractDraftTerms({ existing, template: BOOK })
    expect(db.steps).toEqual([{ op: 'update', table: 'job_contracts', payload: TERMS_NOW, filters: [['id', 'd1'], ['status', 'draft']] }])
    expect(row.body_html).toBe('<p>New wording</p>')
  })

  it('writes nothing for a current draft, another document’s draft, a built-in draft or a sent row', async () => {
    for (const existing of [draftRow(TERMS_NOW), draftRow({ template_document_id: 't2' }), draftRow({ template_document_id: null }), draftRow({ status: 'sent' })]) {
      await expect(refreshJobContractDraftTerms({ existing, template: BOOK })).resolves.toBe(existing)
    }
    expect(db.steps).toEqual([])
  })

  it('writes nothing when the template in hand is older than the draft', async () => {
    const existing = draftRow(TERMS_NOW)
    await expect(refreshJobContractDraftTerms({ existing, template: { ...BOOK, book_body_html: '<p>Old wording</p>', book_version_date: '2026-09-20' } })).resolves.toBe(existing)
    expect(db.steps).toEqual([])
  })

  it('a failed write throws, so the caller stops instead of sending the old wording', async () => {
    db.updateError = new Error('row is locked')
    await expect(refreshJobContractDraftTerms({ existing: draftRow(), template: BOOK })).rejects.toThrow('row is locked')
  })
})
