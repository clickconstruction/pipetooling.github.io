// @vitest-environment jsdom
/**
 * The Release of Lien window says how the amount is figured (v2.4296): the chips name what is
 * still owed, the box under Amount lists the bill and its checks to the total, a live waiver that
 * already covers the bill is said in plain words, and the paid money no unconditional covers gets
 * one door. Job 650's numbers.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { makeInvoice, makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import LienReleaseModal from './LienReleaseModal'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'assistant-1' }, role: 'assistant', profileName: 'Taunya' }) }))
vi.mock('signature_pad', () => ({ default: class { off() {} clear() {} isEmpty() { return true } toDataURL() { return null } } }))

const db = vi.hoisted(() => ({ releases: [] as Array<Record<string, unknown>> }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as { from: (t: string) => unknown }
  const realFrom = stub.from.bind(stub)
  stub.from = (table: string) => {
    if (table === 'users') {
      const builder: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'order', 'in', 'is', 'limit']) builder[m] = () => builder
      builder.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: [{ id: 'master-1', name: 'Malachi Whites', notes: null, archived_at: null }], error: null }).then(ok)
      return builder
    }
    if (table !== 'job_lien_releases') return realFrom(table)
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order', 'in', 'is', 'limit', 'insert', 'update']) builder[m] = () => builder
    builder.single = () => Promise.resolve({ data: null, error: null })
    builder.maybeSingle = () => Promise.resolve({ data: null, error: null })
    builder.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: db.releases, error: null }).then(ok)
    return builder
  }
  return { supabase: stub }
})

const bill1 = makeInvoice({ id: 'b1', status: 'billed', amount: 26800, sequence_order: 0, billed_at: '2026-07-15T22:05:23Z' })
const bill2 = makeInvoice({ id: 'b2', status: 'billed', amount: 6700, sequence_order: 1, billed_at: '2026-09-10T20:32:42Z' })
const job = makeJob({
  id: 'j650',
  hcp_number: '650',
  job_name: 'ATI Schertz — As per plans',
  customer_name: 'SCHERTZ STATION LTD',
  gc_customer_id: 'gc-loberg',
  gcCustomer: { id: 'gc-loberg', name: 'Loberg Contracting' },
  master_user_id: 'master-1',
  invoices: [bill1, bill2],
  revenue: 33500,
  payments: [
    { id: 'p1', job_id: 'j650', invoice_id: 'b1', amount: 11700, paid_on: '2026-09-14', sent_on: null, created_at: '2026-09-14T15:00:00Z', payment_type: 'checkDeposit', sequence_order: 0 },
    { id: 'p2', job_id: 'j650', invoice_id: 'b1', amount: 6077.51, paid_on: '2026-09-28', sent_on: null, created_at: '2026-09-28T15:00:00Z', payment_type: 'checkDeposit', sequence_order: 1 },
  ],
} as never)

const SIGNED = {
  id: 'signed-1',
  job_id: 'j650',
  form_type: 'conditional_final',
  status: 'signed',
  amount: 15722.49,
  invoice_ids: ['b1', 'b2'],
  voided_at: null,
  created_at: '2026-10-01T02:17:32Z',
  minted_at: '2026-10-01T02:17:40Z',
  signed_at: '2026-10-01T02:19:10Z',
  signer_printed_name: 'Malachi Whites',
  signer_signature_mode: 'draw',
  fields: {},
}

afterEach(() => {
  cleanup()
  db.releases = []
})

describe('LienReleaseModal — how the amount is figured (v2.4296)', () => {
  it('bill #1 part paid: the chip names what is owed and the box lists the bill, its two checks and the total', async () => {
    renderWithProviders(<LienReleaseModal open onClose={() => undefined} job={job} invoice={bill1} signerNameFallback="Malachi Whites" />)
    const box = await screen.findByTestId('lien-waiver-math')
    await settle()
    expect(screen.getByText('#1 · $9,022.49 owed')).toBeTruthy()
    expect(box.textContent).toContain('How $9,022.49 is figured')
    expect(box.textContent).toContain('Bill #1 · billed Jul 15')
    expect(box.textContent).toContain('Check · Sep 14')
    expect(box.textContent).toContain('− 11,700.00')
    expect(box.textContent).toContain('− 6,077.51')
    expect(box.textContent).toContain('Still owed on bill #1')
    // Nothing else covers it: no warning; the paid money gets its door.
    expect(screen.queryByTestId('lien-waiver-covered')).toBeNull()
    expect(screen.getByTestId('lien-waiver-paid-unwaived').textContent).toContain('$17,777.51 is paid and not waived yet.')
  })

  it('a signed waiver already covering the bill is said in plain words, with the way out', async () => {
    db.releases = [SIGNED]
    renderWithProviders(<LienReleaseModal open onClose={() => undefined} job={job} invoice={bill1} signerNameFallback="Malachi Whites" />)
    const warn = await screen.findByTestId('lien-waiver-covered')
    expect(warn.textContent).toContain('Bill #1 is already waived.')
    expect(warn.textContent).toContain('Malachi Whites signed a conditional · final on Sep 30 for $15,722.49.')
    expect(warn.textContent).toContain('It covers bill #1 and bill #2.')
    expect(within(warn).getByRole('button', { name: 'Open the signed one ›' })).toBeTruthy()
    expect(screen.getByText(/of \$26,800 · waiver on file/)).toBeTruthy()
  })

  it('Waive the paid switches to the unconditional progress for the money in hand; typing over the amount offers the way back', async () => {
    renderWithProviders(<LienReleaseModal open onClose={() => undefined} job={job} invoice={bill1} signerNameFallback="Malachi Whites" />)
    const note = await screen.findByTestId('lien-waiver-paid-unwaived')
    fireEvent.click(within(note).getByRole('button', { name: 'Waive the $17,777.51 paid ›' }))
    const form = screen.getByTestId('lien-waiver-form')
    await waitFor(() => expect(within(form).getByRole('button', { name: 'Unconditional' }).getAttribute('aria-pressed')).toBe('true'))
    const box = screen.getByTestId('lien-waiver-math')
    expect(box.textContent).toContain('How $17,777.51 is figured')
    expect(box.textContent).toContain('Paid so far')
    const amount = screen.getByLabelText('Amount ($)') as HTMLInputElement
    expect(amount.value).toBe('17777.51')
    fireEvent.change(amount, { target: { value: '8000' } })
    const over = screen.getByTestId('lien-waiver-typed-over')
    expect(over.textContent).toContain('The bills say $17,777.51. You typed $8,000.00.')
    fireEvent.click(within(over).getByRole('button', { name: 'Use $17,777.51' }))
    expect((screen.getByLabelText('Amount ($)') as HTMLInputElement).value).toBe('17777.51')
  })
})
