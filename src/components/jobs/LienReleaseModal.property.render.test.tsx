// @vitest-environment jsdom
/**
 * The Release of Lien window's property record is the one the job's own row names. The window read the link
 * from the opener's copy of the row, which can lag a link made since the board loaded, and then offered the
 * link picker instead of the linked record, and the waiver's *Check from* fell back to the GC instead of the
 * owner of record. The Lien window had the same gap (v2.5832).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { makeInvoice, makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import LienReleaseModal from './LienReleaseModal'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'assistant-1' }, role: 'assistant', profileName: 'Taunya' }) }))
// jsdom draws nothing: the signature line's canvas gets no 2D context.
HTMLCanvasElement.prototype.getContext = (() => null) as never

const db = vi.hoisted(() => ({ rows: {} as Record<string, Array<Record<string, unknown>>> }))
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
    const read = async () => (db.rows[table] ?? []).filter((r) => keep.every((k) => k(r)))
    b.maybeSingle = () => read().then((rows) => ({ data: rows[0] ?? null, error: null }))
    b.single = b.maybeSingle
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => read().then((rows) => ({ data: rows, error: null })).then(ok, bad)
    return b
  }
  return { supabase: { ...makeSupabaseStub(), from: (table: string) => builder(table) } }
})

const SITE = {
  id: 'site-891',
  customer_id: 'gc-burd',
  address: '11730 TX-29, Liberty Hill, TX 78642',
  sequence_order: 0,
  property_kind: 'non_residential',
  homestead: false,
  county: 'Williamson',
  legal_description: 'Lot 1, Block A, Sample Subdivision',
  owner_mode: 'building_owner',
  owner_name: '',
  owner_company: 'Sample Holdings LLC',
  owner_mailing_address: 'PO Box 1, Liberty Hill, TX 78642',
}

const INV = makeInvoice({ id: 'inv-891', job_id: 'job-891', status: 'billed', amount: 350, sequence_order: 0, billed_at: '2026-08-18T14:28:00Z' })

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
    customer_address_id: 'site-891',
    master_user_id: 'master-1',
    invoices: [INV],
    revenue: 2028.04,
    ...over,
  })
}

/** Step 4 holds the Property record line; a folded step opens in place with its own button. */
async function propertyStep(): Promise<HTMLElement> {
  const step = await screen.findByTestId('lien-step-4')
  const look = within(step).queryByRole('button', { name: '4 · Check the details' })
  if (look) fireEvent.click(look)
  return step
}

beforeEach(() => {
  db.rows = {
    jobs_ledger: [{ id: 'job-891', customer_address_id: 'site-891' }],
    customer_addresses: [SITE],
    customers: [{ id: 'gc-burd', name: 'Burd & Assoc.', billing_email: 'ap@burd.example' }],
    users: [{ id: 'master-1', name: 'Malachi Reyes', notes: 'Malachi Reyes, Master Plumber', role: 'master_technician', archived_at: null }],
  }
})

afterEach(cleanup)

describe('LienReleaseModal · the property record is the job’s own', () => {
  it('reads the job’s own link when the opener’s row has none: the record, not the picker, and the owner on Check from', async () => {
    // A board row painted before the job was linked to its property.
    renderWithProviders(<LienReleaseModal open onClose={() => undefined} job={job891({ customer_address_id: null })} invoice={INV} signerNameFallback="Malachi Reyes" />)
    await screen.findByTestId('lien-waiver-form')
    await settle()
    const step = await propertyStep()
    await waitFor(() => expect(step.textContent).toContain('Property record: 11730 TX-29, Liberty Hill, TX 78642'))
    expect(within(step).queryByRole('combobox', { name: 'Link a property record' })).toBeNull()
    await waitFor(() => expect(document.body.textContent).toContain('Sample Holdings LLC'))
  })

  it('a job its own row leaves unlinked still offers the picker, the matching record first in mind', async () => {
    db.rows.jobs_ledger = [{ id: 'job-891', customer_address_id: null }]
    renderWithProviders(<LienReleaseModal open onClose={() => undefined} job={job891({ customer_address_id: null })} invoice={INV} signerNameFallback="Malachi Reyes" />)
    await screen.findByTestId('lien-waiver-form')
    await settle()
    const step = await propertyStep()
    const pick = (await within(step).findByRole('combobox', { name: 'Link a property record' })) as HTMLSelectElement
    expect(pick.value).toBe('site-891')
    expect(step.textContent).not.toContain('Property record: 11730')
  })
})
