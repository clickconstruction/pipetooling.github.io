// @vitest-environment jsdom
/**
 * Render smoke for the Invoice Modifications cards inside Bill Customer. The cards are their own files
 * (`BillCustomerStripeModifications`, `BillCustomerPhysicalModifications`) and own no state, so what the window
 * promises across its tabs is tested here, in the window: the typed line is one line for both channels, the two
 * shared disclosures stay open from tab to tab, a memo preset writes both memos, each channel keeps its own footer,
 * and none of it writes anything. The cards on their own are `BillCustomerInvoiceModifications.render.test.tsx`.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { makeInvoice, makeJob, renderWithProviders, SMOKE_AUTH_USER_ID } from '../../test/renderSmokeMocks'
import SendRecordInvoiceModal from './SendRecordInvoiceModal'
import { moneyText } from '../../test/moneyText'

const calls = vi.hoisted(() => ({ rpc: [] as string[], writes: [] as string[] }))

const detailJob = makeJob({
  id: 'job-978',
  hcp_number: '978',
  status: 'ready_to_bill',
  revenue: 3630,
  payments_made: 0,
  customer_id: 'cust-1',
  customer_name: 'Kestrin Contracting',
  customer_email: 'ap@kestrin.test',
  invoices: [makeInvoice({ id: 'partial-1', job_id: 'job-978', amount: 1000, is_primary_rtb_bundle: false })],
})

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as Record<string, unknown>
  const baseFrom = stub.from as (table: string) => Record<string, unknown>
  stub.from = (table: string) => {
    const b = baseFrom(table)
    for (const m of ['insert', 'update', 'upsert', 'delete'] as const) {
      const orig = b[m] as () => unknown
      b[m] = () => {
        calls.writes.push(`${table}.${m}`)
        return orig()
      }
    }
    return b
  }
  stub.rpc = (fn: string) => {
    calls.rpc.push(fn)
    return Promise.resolve({ data: null, error: null })
  }
  return { supabase: stub }
})

vi.mock('../../lib/fetchJobWithDetailsById', () => ({
  fetchJobWithDetailsById: async () => detailJob,
}))

vi.mock('./BillCustomerOwnerLine', () => ({
  default: ({ jobId }: { jobId: string }) => <div data-testid="owner-line-marker" data-job={jobId} />,
}))

// jsdom has no matchMedia; responsive children may ask for it.
beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
})

const IDS = {
  stripeLine: 'bill-customer-stripe-line-on-bill-section-panel',
  stripeMemo: 'bill-customer-stripe-memo-section-panel',
  stripeFooter: 'bill-customer-footer-section-panel',
  physicalLine: 'bill-customer-physical-line-on-bill-section-panel',
  physicalMemo: 'bill-customer-physical-memo-section-panel',
  physicalFooter: 'bill-customer-physical-footer-section-panel',
}

function toggleFor(panelId: string): HTMLButtonElement {
  const el = document.querySelector(`button[aria-controls="${panelId}"]`)
  if (!el) throw new Error(`no disclosure opens ${panelId}`)
  return el as HTMLButtonElement
}
function panel(panelId: string): HTMLElement {
  const el = document.getElementById(panelId)
  if (!el) throw new Error(`no panel ${panelId}`)
  return el
}
function memoBox(panelId: string): HTMLTextAreaElement {
  return within(panel(panelId)).getByRole('textbox', { hidden: true }) as HTMLTextAreaElement
}
async function goTo(tabName: 'Stripe bill' | 'Physical invoice', caption: string) {
  fireEvent.click(screen.getByRole('button', { name: tabName }))
  await waitFor(() => {
    expect(screen.getByTestId('bill-customer-channel-caption').textContent).toBe(caption)
  })
}
const STRIPE_CAPTION = 'An email with a Pay now button. They pay by card or bank on Stripe’s page.'
const PHYSICAL_CAPTION = 'An email with the invoice PDF attached. It has no pay link.'

describe('SendRecordInvoiceModal — the Invoice Modifications cards across the tabs', () => {
  it('one line for both channels, the shared disclosures stay open, a memo preset writes both memos, footers stay apart, nothing is written', async () => {
    renderWithProviders(
      <SendRecordInvoiceModal
        payload={{
          kind: 'job',
          job: { id: 'job-978', master_user_id: SMOKE_AUTH_USER_ID, hcp_number: '978', click_number: null, job_name: 'Penmoor demo', customer_id: 'cust-1', customer_name: 'Kestrin Contracting', customer_email: 'ap@kestrin.test' },
        }}
        onClose={() => {}}
        onSuccess={async () => {}}
        jobUpdating={false}
        invoiceUpdating={false}
      />,
    )
    await waitFor(() => {
      expect(screen.getByText(moneyText(/RTB \$2,630\.00/))).toBeTruthy()
    })

    // The Stripe card opens closed, on the Stripe tab.
    expect(screen.getAllByText('Invoice Modifications (optional)')).toHaveLength(1)
    for (const id of [IDS.stripeLine, IDS.stripeMemo, IDS.stripeFooter]) expect(panel(id).hidden).toBe(true)
    expect(document.getElementById(IDS.physicalLine)).toBeNull()

    // Open the line and the memo, type a line and a memo, and take the Electrical footer.
    fireEvent.click(toggleFor(IDS.stripeLine))
    fireEvent.click(toggleFor(IDS.stripeMemo))
    fireEvent.change(document.getElementById('bill-customer-stripe-line-description') as HTMLTextAreaElement, { target: { value: 'Rough-in, phase two' } })
    fireEvent.change(memoBox(IDS.stripeMemo), { target: { value: 'Typed on the Stripe tab' } })
    fireEvent.click(toggleFor(IDS.stripeFooter))
    fireEvent.click(within(panel(IDS.stripeFooter)).getByRole('button', { name: 'Electrical' }))
    expect(toggleFor(IDS.stripeFooter).textContent).toBe('▼FooterElectrical')
    // The typed line is the bill's line: the preview under the card draws it.
    expect(screen.getAllByText('Rough-in, phase two').length).toBeGreaterThan(1)

    // The Physical tab: the same line, the two shared disclosures still open, its own memo and its own closed footer.
    await goTo('Physical invoice', PHYSICAL_CAPTION)
    expect(screen.getAllByText('Invoice Modifications (optional)')).toHaveLength(1)
    expect(document.getElementById(IDS.stripeLine)).toBeNull()
    expect(panel(IDS.physicalLine).hidden).toBe(false)
    expect(panel(IDS.physicalMemo).hidden).toBe(false)
    expect(panel(IDS.physicalFooter).hidden).toBe(true)
    expect((document.getElementById('bill-customer-physical-line-description') as HTMLTextAreaElement).value).toBe('Rough-in, phase two')
    expect(memoBox(IDS.physicalMemo).value).not.toBe('Typed on the Stripe tab')
    expect(toggleFor(IDS.physicalFooter).textContent).not.toBe('▶FooterElectrical')

    // A line retyped here is the Stripe line too, and Clear on the memo presets empties both memos.
    fireEvent.change(document.getElementById('bill-customer-physical-line-description') as HTMLTextAreaElement, { target: { value: 'Final trim' } })
    fireEvent.change(memoBox(IDS.physicalMemo), { target: { value: 'Typed on the Physical tab' } })
    fireEvent.click(toggleFor(IDS.physicalMemo))
    expect(panel(IDS.physicalMemo).hidden).toBe(true)

    await goTo('Stripe bill', STRIPE_CAPTION)
    expect((document.getElementById('bill-customer-stripe-line-description') as HTMLTextAreaElement).value).toBe('Final trim')
    // The memo disclosure was closed on the other tab, and it is closed here.
    expect(panel(IDS.stripeMemo).hidden).toBe(true)
    expect(panel(IDS.stripeLine).hidden).toBe(false)
    // Each channel kept its own memo and its own footer.
    expect(memoBox(IDS.stripeMemo).value).toBe('Typed on the Stripe tab')
    expect(toggleFor(IDS.stripeFooter).textContent).toBe('▼FooterElectrical')
    fireEvent.click(within(panel(IDS.stripeMemo)).getByRole('button', { name: 'Clear', hidden: true }))
    expect(memoBox(IDS.stripeMemo).value).toBe('')

    await goTo('Physical invoice', PHYSICAL_CAPTION)
    expect(memoBox(IDS.physicalMemo).value).toBe('')

    // Looking and typing wrote nothing and asked the database for no bill row.
    expect(calls.writes).toEqual([])
    expect(calls.rpc.filter((fn) => fn === 'ensure_single_ready_to_bill_invoice_for_job')).toEqual([])
  })
})
