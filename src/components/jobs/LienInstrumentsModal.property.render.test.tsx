// @vitest-environment jsdom
/**
 * The Lien window's property kind: it is read from the job's own row, first and on its own, and the window says
 * nothing about the kind until that read lands. Job 891 (Tune 5- Liberty Hill, a GC job on a commercial record)
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
  customer_id: 'gc-brund',
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
    job_name: 'Tune 5- Liberty Hill',
    job_address: '11730 TX-29, Liberty Hill, TX 78642',
    status: 'billed',
    customer_id: null,
    customer_name: null,
    gc_customer_id: 'gc-brund',
    gcCustomer: { id: 'gc-brund', name: 'Brund & Assoc.' },
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
    customers: [{ id: 'gc-brund', name: 'Brund & Assoc.', address: '11805 Interstate 27, Ste B Amarillo, TX 79119', billing_email: null, contact_info: { email: 'crystal@burdassoc.test' } }],
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

describe('LienInstrumentsModal · the Mechanic’s lien tab prints the desk’s affidavit (v2.6809)', () => {
  // The report: a GC job never clocked, no day set by hand. The desk's affidavit read the creation month and the GC's
  // address; one press later this window's paper read *from — through —* and the contractor's name alone.
  it('a job with no clock hours swears its creation month, and the original contractor line carries the GC’s address', async () => {
    db.rows.clock_sessions = []
    // The affidavit's gate, cleared: the owner with a mailing address, the legal description, a § 53.056 notice on record.
    db.rows.customer_addresses = [{ ...SITE, legal_description: 'LOT 1 BLK 2 SAMPLE SUBD', owner_name: 'Pat Owner', owner_mailing_address: '4 Owner Ct, Liberty Hill, TX 78642', owner_mode: 'homeowner' }]
    db.rows.job_lien_filings = [{ id: 'f-n', job_id: 'job-891', kind: 'notice_53_056', filed_at: '2026-10-14', serve_due: null, served_at: null, voided_at: null, county: '', recording_number: null, months_covered: ['2026-08'], sends: [], fields: {}, created_at: '2026-10-14T15:00:00Z' }]
    // The period is the earlier form's paragraph 5: a paper approved before the short form (punch list #305), its desk item unmarked.
    db.rows.job_lien_desk_items = [{ id: 'd-1', job_id: 'job-891', kind: 'affidavit', status: 'approved', fields: { notice: {} }, voided_at: null, created_at: '2026-10-20T15:00:00Z' }]
    renderWithProviders(<LienInstrumentsModal {...props} initialTab="affidavit" job={job891({ last_work_date: null, created_at: '2026-08-18T05:40:28Z' })} />)
    await waitFor(() => expect(document.body.textContent).toContain('The name and address of the original contractor is: Brund & Assoc., 11805 Interstate 27, Ste B Amarillo, TX 79119.'))
    expect(document.body.textContent).toContain('during the period from August 1, 2026 through August 31, 2026.')
    expect(document.body.textContent).not.toContain('from — through —')
    // The strip above the paper names the same month.
    expect(stepText('last_work')).toContain('Aug 2026')
  })
})

describe('LienInstrumentsModal · the printed papers carry the desk’s claim', () => {
  // A job billed in stages: $5,000, a $2,000 bill out (the fixture's $350 bill is replaced), the rest not billed. The desk swears the bills,
  // less a claim set by hand; this window swore the job's $5,000 and never read the correction.
  const BILL = makeInvoice({ id: 'inv-s1', job_id: 'job-891', amount: 2000, sequence_order: 1, status: 'billed', billed_at: '2026-08-18T14:28:00Z', sent_to_customer_at: '2026-08-18T14:28:10Z' })
  const staged = () => job891({ status: 'working', revenue: 5000, payments_made: 0, invoices: [BILL], payments: [] })
  const ready = () => {
    db.rows.customer_addresses = [{ ...SITE, legal_description: 'LOT 1 BLK 2 SAMPLE SUBD', owner_name: 'Pat Owner', owner_mailing_address: '4 Owner Ct, Liberty Hill, TX 78642', owner_mode: 'homeowner' }]
    db.rows.job_lien_filings = [{ id: 'f-n', job_id: 'job-891', kind: 'notice_53_056', filed_at: '2026-10-14', serve_due: null, served_at: null, voided_at: null, county: '', recording_number: null, months_covered: ['2026-08'], sends: [], fields: {}, created_at: '2026-10-14T15:00:00Z' }]
  }
  const note = (key: string) => (document.querySelector(`[data-lien-window-claim-note="${key}"]`) as HTMLElement | null)?.textContent ?? ''

  it('the affidavit swears what the sent bills owe, and says what is not billed yet', async () => {
    ready()
    renderWithProviders(<LienInstrumentsModal {...props} initialTab="affidavit" job={staged()} />)
    await waitFor(() => expect(document.body.textContent).toContain('The amount of the claim is $2,000.00.'))
    // The short form swears the claim alone: the job's whole price is on no line of the paper.
    expect(document.body.textContent).not.toContain('$5,000.00')
    expect(note('unbilled')).toBe('Not billed yet · $3,000 of the job’s $5,000 · not claimed until it is billed')
    expect(note('by_hand')).toBe('')
  })

  it('a claim set by hand on the desk reaches the affidavit and the notice, with who set it and why', async () => {
    ready()
    db.rows.job_lien_claim_corrections = [{ job_id: 'job-891', amount_off: 500, per_month: null, reason: 'GC disputes a fixture', carry: true, set_by_name: 'Rey', set_at: '2026-10-20T16:00:00Z', looked_at: null, looked_by_name: '' }]
    const view = renderWithProviders(<LienInstrumentsModal {...props} initialTab="affidavit" job={staged()} />)
    await waitFor(() => expect(document.body.textContent).toContain('The amount of the claim is $1,500.00. Claimant claims a lien on the property for that amount.'))
    expect(note('by_hand')).toContain('Claim set by hand on the Lien desk: $1,500 · $500 under the $2,000 unpaid in the app · carries until cleared · Rey')
    expect(note('by_hand')).toContain('“GC disputes a fixture”')
    view.unmount()
    renderWithProviders(<LienInstrumentsModal {...props} initialTab="notice" job={staged()} />)
    await waitFor(() => expect(document.body.textContent).toContain('Claim amount: $1,500.00 (what the sent bills still owe, with the claim set by hand)'))
  })

  it('draws no paper until the claim is read, so a sworn amount is never drawn and then changed', async () => {
    ready()
    let land!: () => void
    db.slow.job_lien_claim_corrections = new Promise<void>((r) => (land = r))
    db.rows.job_lien_claim_corrections = [{ job_id: 'job-891', amount_off: 500, per_month: null, reason: 'GC disputes a fixture', carry: true, set_by_name: 'Rey', set_at: '2026-10-20T16:00:00Z', looked_at: null, looked_by_name: '' }]
    renderWithProviders(<LienInstrumentsModal {...props} initialTab="affidavit" job={staged()} />)
    await waitFor(() => expect(document.querySelector('[data-lien-window-claim-reading]')).toBeTruthy())
    expect(document.body.textContent).not.toContain('The amount of the claim is')
    land()
    await waitFor(() => expect(document.body.textContent).toContain('The amount of the claim is $1,500.00.'))
    expect(document.querySelector('[data-lien-window-claim-reading]')).toBeNull()
  })
})

describe('LienInstrumentsModal · a paper keeps the form it was drafted on (punch list #305)', () => {
  const ready = () => {
    db.rows.customer_addresses = [{ ...SITE, legal_description: 'LOT 1 BLK 2 SAMPLE SUBD', owner_name: 'Pat Owner', owner_mailing_address: '4 Owner Ct, Liberty Hill, TX 78642', owner_mode: 'homeowner' }]
    db.rows.job_lien_filings = [{ id: 'f-n', job_id: 'job-891', kind: 'notice_53_056', filed_at: null, serve_due: null, served_at: null, voided_at: null, county: '', recording_number: null, months_covered: ['2026-08'], sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9407 1', sent_on: '2026-10-14' }], fields: {}, created_at: '2026-10-14T15:00:00Z' }]
  }
  const draft = (fields: Record<string, unknown>, status = 'approved') => ({ id: 'd-1', job_id: 'job-891', kind: 'affidavit', status, fields, voided_at: null, created_at: '2026-10-20T15:00:00Z' })

  it('a job with no draft on the desk prints the short form, with the months and the notice from the record', async () => {
    ready()
    renderWithProviders(<LienInstrumentsModal {...props} initialTab="affidavit" job={job891()} />)
    await waitFor(() => expect(document.body.textContent).toContain('Payment is requested for work done and materials furnished in August 2026.'))
    expect(document.body.textContent).toContain('Notice of the claim was sent to the owner by certified mail on October 14, 2026.')
    expect(document.body.textContent).toContain('Claimant did so under a contract with Brund & Assoc., 11805 Interstate 27, Ste B Amarillo, TX 79119, the original contractor.')
    expect(document.querySelector('[data-lien-window-form-note]')).toBeNull()
  })

  it('an affidavit approved before the short form prints the ten paragraphs it was approved with, and the tab says so', async () => {
    ready()
    db.rows.job_lien_desk_items = [draft({ notice: {} })]
    renderWithProviders(<LienInstrumentsModal {...props} initialTab="affidavit" job={job891()} />)
    await waitFor(() => expect(document.body.textContent).toContain('All statutory notices required by the Texas Property Code have been sent'))
    expect(document.body.textContent).not.toContain('Payment is requested for work done')
    expect(document.querySelector('[data-lien-window-form-note="long"]')).toBeTruthy()
  })

  it('a draft redrawn on the desk carries the mark and prints the short form', async () => {
    ready()
    db.rows.job_lien_desk_items = [draft({ notice: {}, affidavitForm: 'short' }, 'drafted')]
    renderWithProviders(<LienInstrumentsModal {...props} initialTab="affidavit" job={job891()} />)
    await waitFor(() => expect(document.body.textContent).toContain('Payment is requested for work done and materials furnished in August 2026.'))
  })

  it('draws no paper until the form is read, so a sworn paper is never drawn on one form and then on the other', async () => {
    ready()
    let land!: () => void
    db.slow.job_lien_desk_items = new Promise<void>((r) => (land = r))
    db.rows.job_lien_desk_items = [draft({ notice: {} })]
    renderWithProviders(<LienInstrumentsModal {...props} initialTab="affidavit" job={job891()} />)
    await waitFor(() => expect(document.querySelector('[data-lien-window-form-reading]')).toBeTruthy())
    expect(document.body.textContent).not.toContain('BEFORE ME')
    land()
    await waitFor(() => expect(document.body.textContent).toContain('All statutory notices required by the Texas Property Code have been sent'))
    expect(document.querySelector('[data-lien-window-form-reading]')).toBeNull()
  })
})

