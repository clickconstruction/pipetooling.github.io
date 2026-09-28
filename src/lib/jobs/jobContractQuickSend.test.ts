import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

type Step = { op: 'read' | 'update' | 'insert' | 'invoke'; table: string; payload?: Record<string, unknown>; filters?: unknown[][] }
/** The client records the read, every write and the send in the order they ran. */
const db = vi.hoisted(() => ({ steps: [] as Step[], row: null as Record<string, unknown> | null, updateError: null as unknown }))
vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      const step: Step = { op: 'read', table, filters: [] }
      const run = async () => {
        db.steps.push(step)
        if (step.op === 'read') return { data: db.row, error: null }
        if (step.op === 'update' && db.updateError) return { data: null, error: db.updateError }
        return { data: step.op === 'update' ? { ...db.row, ...step.payload } : { id: 'new', ...step.payload }, error: null }
      }
      const b = {
        select: () => b,
        update: (payload: Record<string, unknown>) => ((step.op = 'update'), (step.payload = payload), b),
        insert: (payload: Record<string, unknown>) => ((step.op = 'insert'), (step.payload = payload), b),
        eq: (col: string, val: unknown) => (step.filters!.push([col, val]), b),
        in: () => b,
        is: () => b,
        limit: () => b,
        single: run,
        maybeSingle: run,
      }
      return b
    },
    functions: {
      invoke: async (name: string, opts: { body: Record<string, unknown> }) => {
        db.steps.push({ op: 'invoke', table: name, payload: opts.body })
        return { data: { ok: true, emailed: true, sign_url: 'https://app.test/contract/sign?t=x' }, error: null }
      },
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

import type { JobWithDetails } from '../../types/jobWithDetails'
import { quickSendJobContract } from './jobContractQuickSend'

const BOOK = { id: 't1', document_name: 'Service agreement', book_body_html: '<p>New wording</p>', book_body_format: 'html', book_version_date: '2026-09-27' }
const TERMS_NOW = { body_html: '<p>New wording</p>', body_format: 'html', template_document_id: 't1', template_name: 'Service agreement', template_version_date: '2026-09-27' }
const STALE_DRAFT = { id: 'd1', job_id: 'j1', status: 'draft', voided_at: null, body_html: '<p>Old wording</p>', body_format: 'html', template_document_id: 't1', template_name: 'Service agreement', template_version_date: '2026-09-20' }
const JOB = { id: 'j1', job_name: 'Mission Hills', customer_name: 'TF Harper', customer_phone: null, revenue: 1200, fixtures: [{ name: 'Water closet', count: 14, line_description: null }] } as unknown as JobWithDetails

function send(template: typeof BOOK | null = BOOK) {
  return quickSendJobContract({ job: JOB, template, recipientEmail: 'kcallison@tfharper.com', recipientName: 'TF Harper', authUserId: 'u1' })
}
const ops = () => db.steps.map((s) => s.op)

beforeAll(() => vi.stubGlobal('window', { location: { origin: 'https://app.test' } }))
afterAll(() => vi.unstubAllGlobals())
beforeEach(() => {
  db.steps = []
  db.row = null
  db.updateError = null
})

describe('quickSendJobContract', () => {
  it('a reused draft behind its Book document takes the current wording before the send', async () => {
    db.row = STALE_DRAFT
    await expect(send()).resolves.toMatchObject({ ok: true, emailed: true })
    expect(ops()).toEqual(['read', 'update', 'invoke'])
    expect(db.steps[1]).toMatchObject({ table: 'job_contracts', payload: TERMS_NOW, filters: [['id', 'd1'], ['status', 'draft']] })
    expect(db.steps[2]).toMatchObject({ table: 'send-job-contract', payload: { contract_id: 'd1', mode: 'email' } })
  })

  it('the refresh failing stops the send — the old wording never goes out', async () => {
    db.row = STALE_DRAFT
    db.updateError = new Error('row is locked')
    await expect(send()).resolves.toEqual({ ok: false, error: 'row is locked' })
    expect(ops()).toEqual(['read', 'update'])
  })

  it('a stale template never overwrites a newer draft: nothing is written and the draft goes out as it reads', async () => {
    // The sweep was opened on Sep 20 and still holds that wording; the draft was saved since on the Sep 27 edit.
    const held = { ...BOOK, book_body_html: '<p>Old wording</p>', book_version_date: '2026-09-20' }
    db.row = { ...STALE_DRAFT, ...TERMS_NOW }
    await expect(send(held)).resolves.toMatchObject({ ok: true, emailed: true })
    expect(ops()).toEqual(['read', 'invoke'])
    expect(db.steps[1]).toMatchObject({ table: 'send-job-contract', payload: { contract_id: 'd1' } })
    // The row the function reads is untouched: still the newer wording and its date.
    expect(db.row).toMatchObject({ body_html: '<p>New wording</p>', template_version_date: '2026-09-27' })
  })

  it('a draft from another document, a built-in draft and a current draft go out as they are', async () => {
    for (const row of [{ ...STALE_DRAFT, template_document_id: 't2' }, { ...STALE_DRAFT, template_document_id: null }, { ...STALE_DRAFT, ...TERMS_NOW }]) {
      db.steps = []
      db.row = row
      await expect(send()).resolves.toMatchObject({ ok: true })
      expect(ops()).toEqual(['read', 'invoke'])
      expect(db.steps[1]!.payload!.contract_id).toBe('d1')
    }
  })

  it('a row already sent is reused untouched', async () => {
    db.row = { ...STALE_DRAFT, status: 'sent' }
    await expect(send()).resolves.toMatchObject({ ok: true })
    expect(ops()).toEqual(['read', 'invoke'])
  })

  it('no live row: the draft is minted with the template’s terms, then sent', async () => {
    await expect(send()).resolves.toMatchObject({ ok: true })
    expect(ops()).toEqual(['read', 'insert', 'invoke'])
    expect(db.steps[1]!.payload).toMatchObject({ ...TERMS_NOW, job_id: 'j1', status: 'draft', recipient_email: 'kcallison@tfharper.com', created_by: 'u1' })
    expect(db.steps[2]!.payload!.contract_id).toBe('new')
  })

  it('with no Book document the minted draft carries the built-in wording', async () => {
    await send(null)
    expect(db.steps[1]!.payload).toMatchObject({ body_format: 'plain', template_document_id: null, template_name: 'Built-in service agreement terms' })
  })

  it('a bad address stops before anything is read', async () => {
    await expect(quickSendJobContract({ job: JOB, template: BOOK, recipientEmail: 'nobody', recipientName: '', authUserId: 'u1' })).resolves.toEqual({ ok: false, error: 'Needs a valid email.' })
    expect(db.steps).toEqual([])
  })
})
