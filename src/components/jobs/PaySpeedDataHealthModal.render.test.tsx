// @vitest-environment jsdom
/**
 * Render smokes for the Data health drill-down (v2.2290/v2.2309): rows show
 * sent → paid once a sent date exists, and every row's line items render
 * always-expanded from the bulk lookup (bill lines when linked, job lines
 * as context when not; v2.2315).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import PaySpeedDataHealthModal from './PaySpeedDataHealthModal'

const rpc = vi.fn()
vi.mock('../../lib/supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a), from: vi.fn() },
}))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' }, profileName: 'Robert' }),
}))

const TXNS = {
  payments: [
    {
      paymentId: 'p1',
      paidYmd: '2026-03-12',
      sentYmd: '2026-03-10',
      amount: 9440,
      paymentType: 'check',
      customerName: 'Michael Palmer',
      jobId: 'j1',
      jobName: 'Michael Palmer',
      address: '180 Go Away Rd',
      billedYmd: '2026-03-10',
      gapDays: 2,
      status: 'measurable',
    },
    {
      paymentId: 'p2',
      paidYmd: '2026-08-11',
      sentYmd: null,
      amount: 1290,
      paymentType: null,
      customerName: 'Michael Holub',
      jobId: 'j2',
      jobName: 'Water softener install',
      address: '44 Cibolo Trace',
      billedYmd: null,
      gapDays: null,
      status: 'unlinked',
    },
  ],
  undatedInvoices: [],
  noCountDate: null,
}

beforeEach(() => {
  cleanup()
  rpc.mockReset()
  rpc.mockImplementation(async (fn: unknown, args: unknown) => {
    if (fn === 'get_pay_speed_transactions') return { data: TXNS }
    if (fn === 'get_payment_line_items_bulk') {
      const ids = (args as { p_payment_ids: string[] }).p_payment_ids
      const out: Record<string, unknown> = {}
      if (ids.includes('p1'))
        out.p1 = { linked: true, billAmount: 9440, items: [{ name: 'Water heater 50-gal', count: 1, unitPrice: 2150, description: null, amount: 2150 }] }
      if (ids.includes('p2'))
        out.p2 = { linked: false, billAmount: null, items: [{ name: 'Water softener', count: 1, unitPrice: 1290, description: null, amount: 1290 }] }
      return { data: out }
    }
    return { data: null }
  })
})

describe('PaySpeedDataHealthModal', () => {
  it('shows sent → paid when a sent date exists, paid alone otherwise', async () => {
    render(<PaySpeedDataHealthModal onClose={vi.fn()} canExclude={false} />)
    expect(await screen.findByText('03/12')).toBeTruthy()
    expect(screen.getByText(/03\/10 →/)).toBeTruthy()
    // p2 has no sent date — its cell is just the paid date.
    expect(screen.getByTitle(/Received 08\/11 — no sent date recorded/)).toBeTruthy()
  })

  it('line items render always-expanded — bill lines + total on linked rows, job-context caption on unlinked (v2.2315)', async () => {
    render(<PaySpeedDataHealthModal onClose={vi.fn()} canExclude={false} />)
    // No clicks: both panels arrive with the bulk lookup.
    await waitFor(() => expect(screen.getByText('What this bill charged')).toBeTruthy())
    expect(screen.getByText('Water heater 50-gal')).toBeTruthy()
    expect(screen.getByText('bill total')).toBeTruthy()
    expect(screen.getByText(/the job's line items, for context/)).toBeTruthy()
    expect(screen.getByText('Water softener')).toBeTruthy()
    // The old expand affordance is gone.
    expect(screen.queryByTitle('Show the line items behind this payment')).toBeNull()
  })
  it('Open job stacks above the drill-down and its onSaved refreshes the list (v2.2311)', async () => {
    const openStacked = vi.fn()
    render(<PaySpeedDataHealthModal onClose={vi.fn()} canExclude={false} onOpenJobStacked={openStacked} />)
    await screen.findByText('03/12')
    const before = rpc.mock.calls.filter((c) => c[0] === 'get_pay_speed_transactions').length
    fireEvent.click(screen.getAllByText('Open job ›')[0]!)
    expect(openStacked).toHaveBeenCalledWith('j1', expect.any(Function))
    // The modal is still mounted (nothing closed) …
    expect(screen.getByText('03/12')).toBeTruthy()
    // … and the refresher hands the list a fresh pull.
    const onSaved = openStacked.mock.calls[0]![1] as () => void
    onSaved()
    await waitFor(() => {
      const after = rpc.mock.calls.filter((c) => c[0] === 'get_pay_speed_transactions').length
      expect(after).toBe(before + 1)
    })
  })
})
