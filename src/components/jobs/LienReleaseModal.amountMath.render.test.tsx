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

  it('Waive the paid asks first; Stay conditional leaves the form where it was (v2.4582)', async () => {
    renderWithProviders(<LienReleaseModal open onClose={() => undefined} job={job} invoice={bill1} signerNameFallback="Malachi Whites" />)
    const note = await screen.findByTestId('lien-waiver-paid-unwaived')
    fireEvent.click(within(note).getByRole('button', { name: 'Waive the $17,777.51 paid ›' }))
    fireEvent.click(within(await screen.findByRole('alertdialog', { name: 'Are you sure you meant to choose Unconditional?' })).getByRole('button', { name: 'Stay conditional' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(within(screen.getByTestId('lien-waiver-form')).getByRole('button', { name: 'Conditional' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('Waive the paid switches to the unconditional progress for the money in hand; typing over the amount offers the way back', async () => {
    renderWithProviders(<LienReleaseModal open onClose={() => undefined} job={job} invoice={bill1} signerNameFallback="Malachi Whites" />)
    const note = await screen.findByTestId('lien-waiver-paid-unwaived')
    fireEvent.click(within(note).getByRole('button', { name: 'Waive the $17,777.51 paid ›' }))
    // It asks first, as the step 2 switch does (v2.4582).
    fireEvent.click(await screen.findByRole('button', { name: 'Acknowledge and choose Unconditional' }))
    const form = screen.getByTestId('lien-waiver-form')
    await waitFor(() => expect(within(form).getByRole('button', { name: 'Unconditional' }).getAttribute('aria-pressed')).toBe('true'))
    const box = screen.getByTestId('lien-waiver-math')
    expect(box.textContent).toContain('How $17,777.51 is figured')
    expect(box.textContent).toContain('Paid so far')
    const amount = screen.getByLabelText('Amount ($)') as HTMLInputElement
    expect(amount.value).toBe('17,777.51')
    fireEvent.change(amount, { target: { value: '8000' } })
    const over = screen.getByTestId('lien-waiver-typed-over')
    expect(over.textContent).toContain('The bills say $17,777.51. You typed $8,000.00.')
    fireEvent.click(within(over).getByRole('button', { name: 'Use $17,777.51' }))
    expect((screen.getByLabelText('Amount ($)') as HTMLInputElement).value).toBe('17,777.51')
  })
})

// v2.4296: a reopened draft — the amount and through date follow the bills and the form; typed fields stay.
const DRAFT = {
  id: 'draft-1',
  job_id: 'j650',
  form_type: 'conditional_progress',
  status: 'draft',
  amount: 9022.49,
  invoice_ids: ['b1'],
  voided_at: null,
  created_at: '2026-10-01T16:31:20Z',
  minted_at: null,
  signed_at: null,
  fields: { amount: '9022.49', checkFrom: 'Typed by hand LLC', companyName: 'Click Plumbing and Electrical', projectDescription: 'ATI Schertz', throughDate: '2026-07-15', signedDate: '2026-10-01', signerName: 'Malachi Whites', signerTitle: '' },
}
const chip = (n: number) => screen.getAllByRole('button').find((b) => b.textContent?.trim().startsWith(`#${n} `))!
const amountBox = () => (screen.getByLabelText('Amount ($)') as HTMLInputElement).value

describe('LienReleaseModal — a reopened draft follows its bills (v2.4296)', () => {
  it('adding bill #2 refills the amount, the through date and the page; a typed field stays', async () => {
    db.releases = [DRAFT]
    renderWithProviders(<LienReleaseModal open onClose={() => undefined} job={job} invoice={bill1} signerNameFallback="Malachi Whites" />)
    await screen.findByTestId('lien-waiver-form')
    await settle()
    await waitFor(() => expect(amountBox()).toBe('9,022.49'))
    fireEvent.click(chip(2))
    await waitFor(() => expect(amountBox()).toBe('15,722.49'))
    expect(document.body.textContent).toContain('in the sum of $15,722.49')
    expect(document.body.textContent).not.toContain('in the sum of $9,022.49')
    expect(screen.queryByTestId('lien-waiver-typed-over')).toBeNull()
    expect(within(screen.getByTestId('lien-waiver-details')).getByText('Typed by hand LLC')).toBeTruthy()
    // The through date follows the newest bill picked: bill #2, billed Sep 10.
    expect(document.body.textContent).toContain('September 10, 2026')
    // Taking bill #2 off again goes back to bill #1 alone.
    fireEvent.click(chip(2))
    await waitFor(() => expect(amountBox()).toBe('9,022.49'))
  })

  it('switching the form refills the amount for that form', async () => {
    db.releases = [DRAFT]
    renderWithProviders(<LienReleaseModal open onClose={() => undefined} job={job} invoice={bill1} signerNameFallback="Malachi Whites" />)
    const form = await screen.findByTestId('lien-waiver-form')
    await settle()
    await waitFor(() => expect(amountBox()).toBe('9,022.49'))
    fireEvent.click(within(form).getByRole('button', { name: 'Unconditional' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Acknowledge and choose Unconditional' }))
    await waitFor(() => expect(amountBox()).toBe('17,777.51'))
    fireEvent.click(within(form).getByRole('button', { name: 'Conditional' }))
    await waitFor(() => expect(amountBox()).toBe('9,022.49'))
  })
})

