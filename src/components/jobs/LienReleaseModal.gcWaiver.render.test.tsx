// @vitest-environment jsdom
/**
 * Our lien waiver to the GC (v2.4274): the form is two toggles pre-set from the bill, with one
 * line of why; the signer block names the job's leader; "He signs now" mints the row as awaiting
 * his signature and opens the pad for him on this screen — his name on it, draw only; a signed
 * waiver offers Send to the GC.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { makeInvoice, makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import LienReleaseModal from './LienReleaseModal'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'assistant-1' }, role: 'assistant', profileName: 'Taunya' }) }))
// jsdom has no canvas: the pad is a stub with the handle's shape.
// jsdom draws nothing: the line's canvas gets no 2D context (and no "not implemented" noise).
HTMLCanvasElement.prototype.getContext = (() => null) as never
vi.mock('signature_pad', () => ({
  default: class {
    off() {}
    clear() {}
    isEmpty() {
      return true
    }
    toDataURL() {
      return null
    }
  },
}))

const db = vi.hoisted(() => ({ writes: [] as Array<{ table: string; op: string; payload: Record<string, unknown> }> }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as { from: (t: string) => unknown }
  const realFrom = stub.from.bind(stub)
  stub.from = (table: string) => {
    if (table === 'users') {
      const builder: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'order', 'in', 'is', 'limit']) builder[m] = () => builder
      builder.then = (ok: (v: unknown) => unknown) =>
        Promise.resolve({
          data: [
            { id: 'master-1', name: 'Malachi Reyes', notes: 'Malachi Reyes, Master Plumber', archived_at: null },
            { id: 'master-2', name: 'Robert Douglas', notes: null, archived_at: null },
          ],
          error: null,
        }).then(ok)
      return builder
    }
    if (table === 'customers') {
      const builder: Record<string, unknown> = {}
      for (const m of ['select', 'eq']) builder[m] = () => builder
      builder.maybeSingle = () => Promise.resolve({ data: { billing_email: 'ap@knight.example' }, error: null })
      return builder
    }
    if (table !== 'job_lien_releases') return realFrom(table)
    let wrote: Record<string, unknown> | null = null
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order', 'in', 'is', 'limit']) builder[m] = () => builder
    for (const op of ['insert', 'update']) {
      builder[op] = (payload: Record<string, unknown>) => {
        db.writes.push({ table, op, payload })
        wrote = payload
        return builder
      }
    }
    builder.single = () => Promise.resolve({ data: wrote ? { id: 'rel-1', voided_at: null, invoice_ids: [], ...wrote } : null, error: null })
    builder.maybeSingle = () => Promise.resolve({ data: null, error: null })
    builder.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok)
    return builder
  }
  return { supabase: stub }
})

const inv1 = makeInvoice({ id: 'inv-1', status: 'billed', amount: 11240, sequence_order: 0 })
const inv2 = makeInvoice({ id: 'inv-2', status: 'billed', amount: 15406, sequence_order: 1 })
const job = makeJob({
  id: 'j977',
  hcp_number: '977',
  job_name: 'Springtown',
  customer_name: 'Hospital',
  customer_email: 'owner@example.com',
  gc_customer_id: 'gc-knight',
  gcCustomer: { id: 'gc-knight', name: 'Knight Contracting' },
  master_user_id: 'master-1',
  invoices: [inv1, inv2],
  revenue: 36000,
})

afterEach(() => {
  cleanup()
  db.writes = []
})

describe('LienReleaseModal — our waiver to the GC (v2.4274)', () => {
  it('opens on the form the bill picks, says why in one line, and the toggles switch it', async () => {
    renderWithProviders(<LienReleaseModal open onClose={() => undefined} job={job} invoice={inv2} signerNameFallback="Malachi Reyes" />)
    await screen.findByTestId('lien-waiver-form')
    await settle()
    const form = screen.getByTestId('lien-waiver-form')
    expect(within(form).getByRole('button', { name: 'Conditional' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(form).getByRole('button', { name: 'Progress' }).getAttribute('aria-pressed')).toBe('true')
    expect(form.textContent).toContain('§ 53.284(b)')
    expect(form.textContent).toContain('picked from the bill · Not settled yet · Bill 2 of 2 · not the last')
    expect(screen.getByTestId('lien-waiver-why').textContent).toContain('Takes effect when Knight Contracting’s check clears')
    expect(screen.getByText('Conditional Waiver and Release on Progress Payment')).toBeTruthy()
    fireEvent.click(within(form).getByRole('button', { name: 'Final' }))
    expect(screen.getByText('Conditional Waiver and Release on Final Payment')).toBeTruthy()
    expect(form.textContent).toContain('§ 53.284(d)')
    fireEvent.click(within(form).getByRole('button', { name: 'Unconditional' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Acknowledge and choose Unconditional' }))
    expect(await screen.findByText('Unconditional Waiver and Release on Final Payment')).toBeTruthy()
    expect(screen.getByTestId('lien-waiver-why').textContent).toContain('Only after the last payment has settled')
  })

  it('Unconditional asks first: Stay conditional changes nothing, Acknowledge switches the form (v2.4507)', async () => {
    renderWithProviders(<LienReleaseModal open onClose={() => undefined} job={job} invoice={inv2} signerNameFallback="Malachi Reyes" />)
    const form = await screen.findByTestId('lien-waiver-form')
    await settle()
    const unconditional = () => within(form).getByRole('button', { name: 'Unconditional' })
    fireEvent.click(unconditional())
    const ask = await screen.findByRole('alertdialog', { name: 'Are you sure you meant to choose Unconditional?' })
    expect(ask.textContent).toContain('Have you spoken to your master plumber?')
    expect(ask.textContent).toContain('Most GCs will accept a conditional waiver, even when they ask for an unconditional one.')
    expect(ask.textContent).toContain('Signing an unconditional waiver gives up all your rights.')
    // Nothing moved yet, and the safe button holds the focus.
    expect(unconditional().getAttribute('aria-pressed')).toBe('false')
    const stay = within(ask).getByRole('button', { name: 'Stay conditional' })
    expect(document.activeElement).toBe(stay)
    fireEvent.click(stay)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(unconditional().getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByText('Conditional Waiver and Release on Progress Payment')).toBeTruthy()

    fireEvent.click(unconditional())
    fireEvent.click(await screen.findByRole('button', { name: 'Acknowledge and choose Unconditional' }))
    await waitFor(() => expect(unconditional().getAttribute('aria-pressed')).toBe('true'))
    expect(screen.getByText('Unconditional Waiver and Release on Progress Payment')).toBeTruthy()
    // Already unconditional: the button is a no-op, and Progress or Final never asks.
    fireEvent.click(unconditional())
    fireEvent.click(within(form).getByRole('button', { name: 'Final' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByText('Unconditional Waiver and Release on Final Payment')).toBeTruthy()
  })

  it('the signer block names the job’s leader; He signs now mints the row for him and opens the pad — his name, draw only', async () => {
    renderWithProviders(<LienReleaseModal open onClose={() => undefined} job={job} invoice={inv2} signerNameFallback="Malachi Reyes" />)
    await screen.findByTestId('lien-waiver-signer')
    await settle()
    const signer = screen.getByTestId('lien-waiver-signer')
    expect((within(signer).getByLabelText('Who signs') as HTMLSelectElement).value).toBe('master-1')
    expect(signer.textContent).toContain('drawn by Malachi Reyes on Taunya’s screen')
    fireEvent.click(screen.getByTestId('lien-waiver-sign-now'))
    await waitFor(() => expect(db.writes.some((w) => w.payload.status === 'awaiting_signature')).toBe(true))
    const mint = db.writes.find((w) => w.payload.status === 'awaiting_signature')!.payload
    expect(mint.signer_user_id).toBe('master-1')
    expect(mint.form_type).toBe('conditional_progress')
    const pad = await screen.findByRole('dialog', { name: 'Sign release of lien' })
    expect(pad.textContent).toContain('Malachi Reyes signs here — Job 977')
    expect(pad.textContent).toContain('on Taunya’s screen')
    // v2.4335: he signs on the page's own line; his name is printed under it, not typed in a box.
    expect(within(pad).queryByRole('button', { name: 'Type it instead' })).toBeNull()
    expect(within(pad).queryByRole('textbox')).toBeNull()
    expect(within(pad).getByTestId('lien-waiver-sign-foot').textContent).toContain('Malachi Reyes, Click')
    expect(within(pad).getByRole('button', { name: 'Sign it' })).toBeTruthy()
    // v2.4339: the checkbox sentence is short enough for one line, the row is centred under the page,
    // and the box sits level with the words.
    const agree = within(pad).getByTestId('lien-waiver-agree-row')
    expect(agree.textContent).toBe('I, Malachi Reyes, have read this release and agree to sign it.')
    expect(agree.style.justifyContent).toBe('center')
    expect(agree.style.alignItems).toBe('center')
    // …and Sign it / Not now sit centred under it, so the tick and the button line up.
    expect(within(pad).getByTestId('lien-waiver-sign-actions').style.justifyContent).toBe('center')
  })
})
