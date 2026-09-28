import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  draftInvoiceErrorMessage,
  draftInvoiceInsertRow,
  insertDraftInvoice,
  linkFixturesToInvoiceByPositions,
  resyncRemainderAfterDraft,
  writeDraftInvoice,
} from './draftInvoiceWrite'

vi.mock('../../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => PromiseLike<{ data: unknown; error: unknown }>) => {
    const r = await op()
    if (r.error) throw r.error
    return r.data
  },
}))

type Step = { step: string; table?: string; payload?: unknown; filters?: unknown[] }

/** A client that records every write in the order it ran. */
function makeClient(opts: { insertError?: unknown; linkError?: unknown; ensure?: { data: unknown; error: unknown } } = {}) {
  const steps: Step[] = []
  const client = {
    from: (table: string) => ({
      insert: (payload: unknown) => ({
        select: () => ({
          single: async () => {
            steps.push({ step: 'insert', table, payload })
            return opts.insertError ? { data: null, error: opts.insertError } : { data: { id: 'inv-new' }, error: null }
          },
        }),
      }),
      update: (payload: unknown) => ({
        eq: (col: string, val: unknown) => ({
          in: async (inCol: string, vals: unknown) => {
            steps.push({ step: 'link', table, payload, filters: [col, val, inCol, vals] })
            return { error: opts.linkError ?? null }
          },
        }),
      }),
    }),
    rpc: async (name: string, params: unknown) => {
      steps.push({ step: 'ensure', table: name, payload: params })
      return opts.ensure ?? { data: { ok: true }, error: null }
    },
  }
  return { steps, client: client as unknown as SupabaseClient }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('draftInvoiceInsertRow', () => {
  it('is a ready_to_bill draft, never the primary bundle, with no bill date', () => {
    expect(draftInvoiceInsertRow({ jobId: 'job-1', amount: 250.5, sequenceOrder: 2 })).toEqual({
      job_id: 'job-1',
      amount: 250.5,
      status: 'ready_to_bill',
      sequence_order: 2,
      estimated_bill_date: null,
      is_primary_rtb_bundle: false,
    })
  })

  it('carries the memo only when one is given', () => {
    expect(draftInvoiceInsertRow({ jobId: 'job-1', amount: 75, sequenceOrder: 0, memo: 'Biohazard remediation fee' }).stripe_invoice_memo).toBe('Biohazard remediation fee')
    expect('stripe_invoice_memo' in draftInvoiceInsertRow({ jobId: 'job-1', amount: 75, sequenceOrder: 0 })).toBe(false)
  })
})

describe('insertDraftInvoice', () => {
  it('writes the row to jobs_ledger_invoices and returns the new id', async () => {
    const { client, steps } = makeClient()
    await expect(insertDraftInvoice(client, { jobId: 'job-1', amount: 100, sequenceOrder: 1 })).resolves.toBe('inv-new')
    expect(steps).toEqual([{ step: 'insert', table: 'jobs_ledger_invoices', payload: draftInvoiceInsertRow({ jobId: 'job-1', amount: 100, sequenceOrder: 1 }) }])
  })

  it('throws the database’s error as it came', async () => {
    const dbError = { message: 'new row violates row-level security', details: 'd', hint: 'h' }
    const { client } = makeClient({ insertError: dbError })
    await expect(insertDraftInvoice(client, { jobId: 'job-1', amount: 100, sequenceOrder: 1 })).rejects.toBe(dbError)
  })
})

describe('linkFixturesToInvoiceByPositions', () => {
  it('attaches the job’s rows at those positions', async () => {
    const { client, steps } = makeClient()
    await expect(linkFixturesToInvoiceByPositions(client, { jobId: 'job-1', invoiceId: 'inv-new', positions: [0, 3] })).resolves.toEqual({ error: null })
    expect(steps).toEqual([{ step: 'link', table: 'jobs_ledger_fixtures', payload: { invoice_id: 'inv-new' }, filters: ['job_id', 'job-1', 'sequence_order', [0, 3]] }])
  })

  it('writes nothing with no positions', async () => {
    const { client, steps } = makeClient()
    await expect(linkFixturesToInvoiceByPositions(client, { jobId: 'job-1', invoiceId: 'inv-new', positions: [] })).resolves.toEqual({ error: null })
    expect(steps).toEqual([])
  })

  it('hands the error back instead of throwing', async () => {
    const linkError = { message: 'nope' }
    const { client } = makeClient({ linkError })
    await expect(linkFixturesToInvoiceByPositions(client, { jobId: 'job-1', invoiceId: 'inv-new', positions: [1] })).resolves.toEqual({ error: linkError })
  })
})

describe('resyncRemainderAfterDraft', () => {
  it('runs only on a Ready to Bill job', async () => {
    const { client, steps } = makeClient()
    for (const jobStatus of ['working', 'billed', 'paid', null, undefined]) {
      await expect(resyncRemainderAfterDraft(client, { jobId: 'job-1', jobStatus, label: 'x' })).resolves.toBeNull()
    }
    expect(steps).toEqual([])
    await expect(resyncRemainderAfterDraft(client, { jobId: 'job-1', jobStatus: 'ready_to_bill', label: 'x' })).resolves.toBeNull()
    expect(steps).toEqual([{ step: 'ensure', table: 'ensure_single_ready_to_bill_invoice_for_job', payload: { p_job_id: 'job-1' } }])
  })

  it('a fully allocated job is success; a real failure comes back in its words', async () => {
    const full = makeClient({ ensure: { data: { error: 'Nothing left to bill; invoice amount would be zero' }, error: null } })
    await expect(resyncRemainderAfterDraft(full.client, { jobId: 'job-1', jobStatus: 'ready_to_bill', label: 'x' })).resolves.toBeNull()
    const failed = makeClient({ ensure: { data: { error: 'Job not found' }, error: null } })
    await expect(resyncRemainderAfterDraft(failed.client, { jobId: 'job-1', jobStatus: 'ready_to_bill', label: 'x' })).resolves.toBe('Job not found')
  })

  it('a call that fails outright throws', async () => {
    const down = makeClient({ ensure: { data: null, error: { message: 'timeout' } } })
    await expect(resyncRemainderAfterDraft(down.client, { jobId: 'job-1', jobStatus: 'ready_to_bill', label: 'x' })).rejects.toEqual({ message: 'timeout' })
  })
})

describe('writeDraftInvoice', () => {
  const base = { jobId: 'job-1', amount: 400, sequenceOrder: 1, resyncLabel: 'ensure RTB remainder after segment invoice' }

  it('insert → the door’s attach step → re-sync, in that order', async () => {
    const { client, steps } = makeClient()
    const out = await writeDraftInvoice(client, {
      ...base,
      jobStatus: 'ready_to_bill',
      afterInsert: async (invoiceId) => {
        const { error } = await linkFixturesToInvoiceByPositions(client, { jobId: 'job-1', invoiceId, positions: [2] })
        if (error) throw error
        steps.push({ step: 'mirror' })
      },
    })
    expect(out).toEqual({ invoiceId: 'inv-new', ensureFailure: null })
    expect(steps.map((s) => s.step)).toEqual(['insert', 'link', 'mirror', 'ensure'])
  })

  it('off Ready to Bill there is no re-sync; with no attach step it is the insert alone', async () => {
    const { client, steps } = makeClient()
    await expect(writeDraftInvoice(client, { ...base, jobStatus: 'working' })).resolves.toEqual({ invoiceId: 'inv-new', ensureFailure: null })
    expect(steps.map((s) => s.step)).toEqual(['insert'])
  })

  it('a failed insert stops everything', async () => {
    const { client, steps } = makeClient({ insertError: { message: 'denied' } })
    const afterInsert = vi.fn()
    await expect(writeDraftInvoice(client, { ...base, jobStatus: 'ready_to_bill', afterInsert })).rejects.toEqual({ message: 'denied' })
    expect(afterInsert).not.toHaveBeenCalled()
    expect(steps.map((s) => s.step)).toEqual(['insert'])
  })

  it('a throw from the attach step skips the re-sync; the draft is already written', async () => {
    const { client, steps } = makeClient({ linkError: { message: 'link failed' } })
    await expect(
      writeDraftInvoice(client, {
        ...base,
        jobStatus: 'ready_to_bill',
        afterInsert: async (invoiceId) => {
          const { error } = await linkFixturesToInvoiceByPositions(client, { jobId: 'job-1', invoiceId, positions: [2] })
          if (error) throw error
        },
      }),
    ).rejects.toEqual({ message: 'link failed' })
    expect(steps.map((s) => s.step)).toEqual(['insert', 'link'])
  })

  it('a failed re-sync is reported beside the created invoice', async () => {
    const { client } = makeClient({ ensure: { data: { error: 'Job not found' }, error: null } })
    await expect(writeDraftInvoice(client, { ...base, jobStatus: 'ready_to_bill' })).resolves.toEqual({ invoiceId: 'inv-new', ensureFailure: 'Job not found' })
  })
})

describe('draftInvoiceErrorMessage', () => {
  it('is the message, then the details and the hint', () => {
    expect(draftInvoiceErrorMessage({ message: 'Denied', details: 'row-level security', hint: 'ask a dev' }, 'Failed to create invoice')).toBe('Denied. row-level security ask a dev')
    expect(draftInvoiceErrorMessage({ message: 'Denied' }, 'Failed to create invoice')).toBe('Denied')
    expect(draftInvoiceErrorMessage(new Error('Boom'), 'Failed to create invoice')).toBe('Boom')
  })

  it('falls back when the error says nothing', () => {
    expect(draftInvoiceErrorMessage({}, 'Failed to create invoice')).toBe('Failed to create invoice')
    expect(draftInvoiceErrorMessage(null, 'Failed to create invoice')).toBe('Failed to create invoice')
    expect(draftInvoiceErrorMessage({ details: 'only details' }, 'Failed to create invoice')).toBe('Failed to create invoice. only details')
  })
})
