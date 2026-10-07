// @vitest-environment jsdom
/**
 * Closing a Stripe bill in full (v2.4521): Stripe is paid at once, our ledger a moment later
 * when the webhook runs. The window waits until the bill reads paid before it refreshes the
 * board, so the row leaves Billed or Collections with no page reload. A part payment's row is
 * written by the function itself and waits for nothing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders, useAuthModuleMock } from '../../test/renderSmokeMocks'
import BilledPaymentConfirmationModal, { type InvoiceWithJobLike } from './BilledPaymentConfirmationModal'

vi.mock('../../hooks/useAuth', async () => useAuthModuleMock())

const db = vi.hoisted(() => ({ statuses: [] as string[], reads: 0, invoked: [] as Array<Record<string, unknown>>, partial: false }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as unknown as {
    from: (t: string) => unknown
    functions: { invoke: (name: string, opts: { body: Record<string, unknown> }) => Promise<unknown> }
    auth: { getSession: () => Promise<unknown> }
  }
  const realFrom = stub.from.bind(stub)
  stub.from = (table: string) => {
    if (table !== 'jobs_ledger_invoices') return realFrom(table)
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq']) builder[m] = () => builder
    // Each read of the bill takes the next status; the last one repeats.
    builder.maybeSingle = () => {
      db.reads += 1
      const status = db.statuses.length > 1 ? db.statuses.shift() : db.statuses[0]
      return Promise.resolve({ data: { status }, error: null })
    }
    return builder
  }
  stub.functions.invoke = (_name, opts) => {
    db.invoked.push(opts.body)
    return Promise.resolve({ data: db.partial ? { success: true, partial: true } : { success: true }, error: null })
  }
  stub.auth.getSession = () => Promise.resolve({ data: { session: { access_token: 't' } }, error: null })
  return { supabase: stub }
})

const invoice = {
  id: 'inv-s',
  job_id: 'job102',
  amount: 5355,
  status: 'billed',
  stripe_invoice_id: 'in_123',
  external_send_channel: 'stripe',
  hosted_invoice_url: 'https://invoice.stripe.com/i/x',
  sent_to_customer_at: '2026-08-04T12:00:00Z',
  job: { id: 'job102', hcp_number: '', click_number: '102', job_name: 'Samantha Coyle', revenue: 8355, payments_made: 3000 },
} as unknown as InvoiceWithJobLike

function renderWindow(onSuccess: () => void, onClose: () => void = () => {}) {
  return renderWithProviders(
    <BilledPaymentConfirmationModal mode="invoice" invoice={invoice} payments={[]} job={null} stripeModeForBilling="live" onClose={onClose} onSuccess={onSuccess} />,
  )
}

afterEach(() => {
  cleanup()
  db.statuses = []
  db.reads = 0
  db.invoked = []
  db.partial = false
})

describe('BilledPaymentConfirmationModal — a Stripe bill closed in full waits for the ledger (v2.4521)', () => {
  it('refreshes the board only once the bill reads paid, and says it is confirming meanwhile', async () => {
    db.statuses = ['billed', 'billed', 'paid']
    const order: string[] = []
    const onSuccess = vi.fn(() => void order.push(`refresh after ${db.reads} reads`))
    const onClose = vi.fn(() => void order.push('close'))
    renderWindow(onSuccess, onClose)
    fireEvent.click(screen.getByText('Record $5,355.00'))
    expect(await screen.findByText('Confirming with Stripe…')).toBeTruthy()
    expect(onSuccess).not.toHaveBeenCalled()
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1), { timeout: 3000 })
    expect(db.invoked[0]).toMatchObject({ jobs_ledger_invoice_id: 'inv-s', amount_dollars: 5355 })
    expect(order).toEqual(['refresh after 3 reads', 'close'])
  })

  it('a part payment waits for nothing: its row is already written', async () => {
    db.partial = true
    db.statuses = ['billed']
    const onSuccess = vi.fn()
    renderWindow(onSuccess)
    fireEvent.change(screen.getAllByRole('textbox')[0]!, { target: { value: '1000' } })
    fireEvent.click(screen.getByText('Record $1,000.00 · $4,355.00 stays due'))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(db.reads).toBe(0)
    expect(screen.queryByText('Confirming with Stripe…')).toBeNull()
  })
})
