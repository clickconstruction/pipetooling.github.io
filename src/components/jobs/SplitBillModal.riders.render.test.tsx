// @vitest-environment jsdom
/**
 * Split keeps a bill's riders (punch list #105, gap 2): a fee that rides on the bill (here a turnaway trip charge, a
 * `fee_lines` entry) moves onto a part, read from the bill on open and again before its row goes. Otherwise the next
 * rewrite of the job's total drops it while the parts still add up to it. A GC card fee, a fee no part can hold, a
 * failed read and a missing bill row each stop it in words before anything is voided (review on #5274). The void,
 * the clean-up and Stripe are stand-ins.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { installDomShims, settle } from '../../test/renderSmokeMocks'
import { ToastProvider } from '../../contexts/ToastContext'
import type { InvoiceWithJobForBillView } from './HostedStripeBillPanel'
import type { StripeInvoiceDetailsSuccess } from '../../lib/stripeInvoiceDetailsResponse'

const TRIP = { trip_charge: 'client_not_home', amount: 150 }
let feeLines: unknown = [TRIP]
let feeReadFails = false
let feeRowMissing = false
const inserted: Record<string, unknown>[][] = []
const voided = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            feeReadFails ? { data: null, error: { message: 'down' } } : feeRowMissing ? { data: null, error: null } : { data: { fee_lines: feeLines }, error: null },
        }),
      }),
      insert: (rows: Record<string, unknown>[]) => {
        inserted.push(rows)
        return { select: async () => ({ data: rows.map((_, i) => ({ id: `part-${i + 1}` })), error: null }) }
      },
    }),
    functions: { invoke: async () => ({ data: { ok: true }, error: null }) },
  },
}))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: 'dev' }) }))
vi.mock('../../lib/supabaseAccessTokenForEdge', () => ({ getAccessTokenForEdgeFunctions: async () => 'token' }))
vi.mock('../../lib/voidStripeInvoiceForRevert', () => ({
  invokeVoidStripeInvoiceForRevert: async () => {
    voided()
    return { ok: true }
  },
  ensureLedgerInvoiceRemovedAfterStripeSendBack: async () => ({ ok: true }),
  stripeModeForBillingFromRole: () => 'test',
}))
vi.mock('../../lib/syncJobToReadyToBillIfNoBilledInvoicesRemain', () => ({ syncJobToReadyToBillIfNoBilledInvoicesRemain: async () => ({ ok: true }) }))
vi.mock('../../lib/promoteJobToBilledIfFullyInvoiced', () => ({ maybePromoteJobToBilledAfterCustomerInvoice: async () => ({ ok: true }) }))

const { SplitBillModal } = await import('./SplitBillModal')

const invoice = {
  id: 'inv-trip',
  amount: 250,
  status: 'billed',
  stripe_invoice_id: 'in_trip',
  stripe_invoice_memo: 'Trip charge — client not home',
  stripe_invoice_footer: null,
  stripe_mode: 'test',
  job: { id: 'job-1', customer_id: 'cust-1', customer_email: 'c@example.com', customer_name: 'Customer', invoices: [], payments: [] },
} as unknown as InvoiceWithJobForBillView
const stripeDetail = { success: true, due_date: null, customer_email: 'c@example.com', customer_name: 'Customer', memo: null, footer: null, lines: [] } as unknown as StripeInvoiceDetailsSuccess

const split = async (part1: string) => {
  installDomShims()
  render(
    <ToastProvider>
      <SplitBillModal open invoice={invoice} stripeDetail={stripeDetail} onClose={() => {}} onDone={() => {}} />
    </ToastProvider>,
  )
  await settle()
  fireEvent.change(screen.getByLabelText('Part 1 amount'), { target: { value: part1 } })
  fireEvent.click(screen.getByRole('button', { name: 'Split into 2 bills' }))
}

beforeEach(() => {
  feeLines = [TRIP]
  feeReadFails = false
  feeRowMissing = false
  inserted.length = 0
  voided.mockClear()
})
afterEach(cleanup)

describe('SplitBillModal · the bill’s riders', () => {
  it('a $150 trip charge on a $250 bill split $100 / $150 rides on the part that can hold it', async () => {
    await split('100')
    await waitFor(() => expect(inserted).toHaveLength(1))
    const [first, second] = inserted[0]!
    expect(first).not.toHaveProperty('fee_lines')
    expect(second!.fee_lines).toEqual([TRIP])
    expect(voided).toHaveBeenCalledTimes(1)
  })

  it('a fee that fits the first part rides on it', async () => {
    feeLines = [{ trip_charge: 'client_not_home', amount: 60 }]
    await split('100')
    await waitFor(() => expect(inserted).toHaveLength(1))
    expect(inserted[0]![0]!.fee_lines).toEqual([{ trip_charge: 'client_not_home', amount: 60 }])
    expect(inserted[0]![1]).not.toHaveProperty('fee_lines')
  })

  it('when the fees cannot be read, nothing is voided and it says so', async () => {
    feeReadFails = true
    await split('100')
    expect(await screen.findByText(/Could not read the bill's fees, so nothing was split/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Split into 2 bills' }) as HTMLButtonElement).disabled).toBe(true)
    expect(voided).not.toHaveBeenCalled()
    expect(inserted).toHaveLength(0)
  })

  it('a bill row that is not there stops it too, though the read raised no error', async () => {
    feeRowMissing = true
    await split('100')
    expect(await screen.findByText(/The bill is not on the job any more, so nothing was split/)).toBeTruthy()
    expect(voided).not.toHaveBeenCalled()
  })

  it('a bill carrying a GC card fee is not split, in words', async () => {
    feeLines = [{ card_bill: 'cb-1', amount: 30, description: 'Credit card fee (3%)' }]
    await split('100')
    expect(await screen.findByText(/carries the GC’s card fee, so it cannot be split/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Split into 2 bills' }) as HTMLButtonElement).disabled).toBe(true)
    expect(voided).not.toHaveBeenCalled()
  })

  it('no part holds more fees than its own amount: a $200 charge split $100 / $150 is refused in words', async () => {
    feeLines = [{ trip_charge: 'site_not_ready', amount: 200 }]
    await split('100')
    expect(await screen.findByText('The $200.00 trip charge on this bill needs a part of at least $200.00.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Split into 2 bills' }) as HTMLButtonElement).disabled).toBe(true)
    expect(voided).not.toHaveBeenCalled()
  })
})
