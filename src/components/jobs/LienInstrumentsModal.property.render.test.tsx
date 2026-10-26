// @vitest-environment jsdom
/**
 * The Lien window's property kind: it is read from the job's own row, first and on its own, and the window says
 * nothing about the kind until that read lands. Job 891 (Take 5- Liberty Hill, a GC job on a commercial record)
 * opened on "Property kind not set" with the residential dates, the affidavit Nov 16 for Dec 15: the kind was the
 * last of five reads, behind the full job, the payers and the contracts, and the link came from the opener's copy
 * of the row, which can lag a link made since the board loaded.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { makeInvoice, makeJob, renderWithProviders } from '../../test/renderSmokeMocks'
import { LIEN_KIND_UNKNOWN_WORDS } from '../../lib/jobs/lienTimeline'
import LienInstrumentsModal from './LienInstrumentsModal'
// The § Rules door's lazy chunk, loaded outside every case's clock (see LienInstrumentsModal.render.test.tsx).
import './LienRulesModal'

const db = vi.hoisted(() => ({
  rows: {} as Record<string, Array<Record<string, unknown>>>,
  /** A table whose reads wait on this promise: a slow read. */
  slow: {} as Record<string, Promise<void>>,
  fullJob: (): Promise<unknown> => Promise.resolve(null),
}))

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  // Answers each read with the table's rows that pass its eq / in filters.
  function builder(table: string): Record<string, unknown> {
    const keep: Array<(r: Record<string, unknown>) => boolean> = []
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'or', 'not', 'contains', 'filter', 'order', 'range', 'limit', 'abortSignal']) b[m] = () => b
    b.eq = (col: string, v: unknown) => {
      keep.push((r) => r[col] === v)
      return b
    }
    b.in = (col: string, vs: unknown[]) => {
      keep.push((r) => vs.includes(r[col]))
      return b
    }
    const read = async () => {
      await (db.slow[table] ?? Promise.resolve())
      return (db.rows[table] ?? []).filter((r) => keep.every((k) => k(r)))
    }
    b.maybeSingle = () => read().then((rows) => ({ data: rows[0] ?? null, error: null }))
    b.single = b.maybeSingle
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => read().then((rows) => ({ data: rows, error: null })).then(ok, bad)
    return b
  }
  return { supabase: { ...makeSupabaseStub(), from: (table: string) => builder(table) } }
})
vi.mock('../../lib/fetchJobWithDetailsById', () => ({ fetchJobWithDetailsById: () => db.fullJob() }))
vi.mock('../../lib/jobs/lienNoticePayPageAssets', () => ({ buildPayPageAssets: async () => ({}) }))
vi.mock('../../lib/supabaseAccessTokenForEdge', () => ({ getAccessTokenForEdgeFunctions: async () => null }))

const SITE = {
  id: 'site-891',
  customer_id: 'gc-burd',
  address: '11730 TX-29, Liberty Hill, TX 78642',
  property_kind: 'non_residential',
  homestead: false,
  county: 'Williamson',
  legal_description: '',
  owner_name: '',
  owner_company: '',
  owner_mailing_address: '',
}

const INV = makeInvoice({ id: 'inv-891', job_id: 'job-891', amount: 350, sequence_order: 1, status: 'billed', billed_at: '2026-08-18T14:28:00Z', sent_to_customer_at: '2026-08-18T14:28:10Z' })

function job891(over: Record<string, unknown> = {}) {
  return makeJob({
    id: 'job-891',
    hcp_number: '891',
    job_name: 'Take 5- Liberty Hill',
    job_address: '11730 TX-29, Liberty Hill, TX 78642',
    status: 'billed',
    customer_id: null,
    customer_name: null,
    gc_customer_id: 'gc-burd',
    gcCustomer: { id: 'gc-burd', name: 'Burd & Assoc.' },
    bill_to_party: 'gc',
    customer_address_id: 'site-891',
    last_work_date: '2026-08-11',
    created_at: '2026-07-01T17:14:10Z',
    invoices: [INV],
    payments: [],
    ...over,
  })
}

const props = { open: true, onClose: () => {}, invoice: null, signerNameFallback: 'Malachi Whites, Master Plumber', authEmail: 'office@clickplumbing.test' }

const header = () => document.getElementById('lien-instruments-title')?.parentElement?.textContent ?? ''
const stepText = (key: string) => (document.querySelector(`[data-lien-window-timeline] [data-lien-timeline-step="${key}"]`) as HTMLElement | null)?.textContent ?? ''

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-24T17:00:00Z'))
  db.rows = {
    jobs_ledger: [{ id: 'job-891', customer_address_id: 'site-891' }],
    customer_addresses: [SITE],
    customers: [{ id: 'gc-burd', name: 'Burd & Assoc.', address: '11805 Interstate 27, Ste B Amarillo, TX 79119', billing_email: null, contact_info: { email: 'crystal@burdassoc.test' } }],
    // An approved August day: the forecast's months carry their own notice dates.
    clock_sessions: [{ job_ledger_id: 'job-891', user_id: 'u-1', work_date: '2026-08-11', clocked_in_at: '2026-08-11T13:00:00Z', clocked_out_at: '2026-08-11T21:00:00Z', approved_at: '2026-08-12T00:00:00Z' }],
  }
  db.slow = {}
  db.fullJob = () => Promise.resolve(null)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('LienInstrumentsModal · the property kind is the job’s own, read first', () => {
  it('reads the kind without waiting on the full job: commercial, the affidavit Dec 15 and the suit Dec 15, 2027', async () => {
    // The full job with every embed is the slowest read; it never comes back here.
    db.fullJob = () => new Promise(() => {})
    renderWithProviders(<LienInstrumentsModal {...props} job={job891()} />)
    await waitFor(() => expect(header()).toContain('commercial'))
    await waitFor(() => expect(stepText('affidavit')).toContain('Dec 15'))
    expect(stepText('suit')).toContain('Dec 15, 2027')
    expect(document.body.textContent).not.toContain(LIEN_KIND_UNKNOWN_WORDS)
  })

  it('says nothing about the kind while the property is being read, then draws the commercial dates', async () => {
    let land!: () => void
    db.slow.customer_addresses = new Promise<void>((resolve) => {
      land = resolve
    })
    renderWithProviders(<LienInstrumentsModal {...props} job={job891()} />)
    await waitFor(() => expect(screen.getByRole('dialog', { name: /^Liens on job 891/ })).toBeTruthy())
    expect(document.body.textContent).not.toContain(LIEN_KIND_UNKNOWN_WORDS)
    expect(stepText('affidavit')).toBe('')
    expect(document.querySelector('[data-lien-window-property-reading]')).toBeTruthy()
    land()
    await waitFor(() => expect(stepText('affidavit')).toContain('Dec 15'))
    expect(document.querySelector('[data-lien-window-property-reading]')).toBeNull()
    expect(header()).toContain('commercial')
  })

  it('reads the job’s own link when the opener’s row has none: the notice, the affidavit and the suit run commercial', async () => {
    // A board row painted before the job was linked to its property.
    renderWithProviders(<LienInstrumentsModal {...props} job={job891({ customer_address_id: null })} />)
    await waitFor(() => expect(header()).toContain('commercial'))
    await waitFor(() => expect(stepText('notice:2026-08')).toContain('Nov 16'))
    expect(stepText('affidavit')).toContain('Dec 15')
    expect(stepText('suit')).toContain('Dec 15, 2027')
    expect(document.body.textContent).not.toContain(LIEN_KIND_UNKNOWN_WORDS)
    // The Mechanic's lien tab reads the same record: its county is there, nothing asks to link one.
    fireEvent.click(screen.getByRole('button', { name: "Mechanic's lien" }))
    await waitFor(() => expect(document.body.textContent).toContain('County + legal description — missing legal description'))
    expect(document.body.textContent).not.toContain('link a property record')
  })

  it('a job with no property record still says the kind is not set, once the read is in', async () => {
    db.rows.jobs_ledger = [{ id: 'job-891', customer_address_id: null }]
    renderWithProviders(<LienInstrumentsModal {...props} job={job891({ customer_address_id: null })} />)
    await waitFor(() => expect(document.body.textContent).toContain(LIEN_KIND_UNKNOWN_WORDS))
    expect(stepText('affidavit')).toContain('Nov 16')
    expect(header()).not.toContain('commercial')
  })
})
