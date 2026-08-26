// @vitest-environment jsdom
/**
 * Render smokes for the Data health drill-down (v2.2290; declutter v2.2316):
 * rows show billed → paid under a column header (sent date on hover), chips
 * split the old "unlinked" into "no bill" / "no bill date", missing bill
 * dates are typed inline (MM/DD/YY), line-item panels have no headers and
 * bill total only earns its own line on multi-item or mismatched bills.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import PaySpeedDataHealthModal from './PaySpeedDataHealthModal'

const rpc = vi.fn()
const invoiceUpdates: { table: string; values: Record<string, unknown>; eq: [string, unknown] }[] = []
vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    from: (table: string) => ({
      update: (values: Record<string, unknown>) => ({
        eq: (col: string, val: unknown) => {
          invoiceUpdates.push({ table, values, eq: [col, val] })
          return Promise.resolve({ error: null })
        },
      }),
      insert: () => Promise.resolve({ error: null }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  },
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
      address: '180 Go Away Rd, Blanco, TX',
      invoiceId: 'i1',
      billedYmd: '2026-03-10',
      gapDays: 2,
      status: 'measurable',
    },
    {
      // not applied to any bill — no invoiceId, so no inline date editor
      paymentId: 'p2',
      paidYmd: '2026-08-11',
      sentYmd: null,
      amount: 1290,
      paymentType: null,
      customerName: 'Michael Holub',
      jobId: 'j2',
      jobName: 'Water softener install',
      address: '44 Cibolo Trace',
      invoiceId: null,
      billedYmd: null,
      gapDays: null,
      status: 'unlinked',
    },
    {
      // on a bill that has no bill date — the inline editor's target
      paymentId: 'p3',
      paidYmd: '2026-08-21',
      sentYmd: null,
      amount: 313,
      paymentType: null,
      customerName: 'Johnny Ingram',
      jobId: 'j3',
      jobName: 'pedestal sink and toilet reset',
      address: '2548 Cascade Falls Dr, San Antonio, TX',
      invoiceId: 'i9',
      billedYmd: null,
      gapDays: null,
      status: 'unlinked',
    },
    {
      // recorded bill date sits AFTER the payment — the v2.2337 guard buckets
      // it as missing info with a fixable date
      paymentId: 'p4',
      paidYmd: '2026-08-14',
      sentYmd: null,
      amount: 5983,
      paymentType: 'Card (external)',
      customerName: 'Tyler Moore',
      jobId: 'j4',
      jobName: 'Yogo Studio',
      address: '3556 FM 78 # 103, McQuenny, TX',
      invoiceId: 'i8',
      billedYmd: '2026-08-19',
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
  invoiceUpdates.length = 0
  rpc.mockImplementation(async (fn: unknown, args: unknown) => {
    if (fn === 'get_pay_speed_transactions') return { data: TXNS }
    if (fn === 'get_payment_line_items_bulk') {
      const ids = (args as { p_payment_ids: string[] }).p_payment_ids
      const out: Record<string, unknown> = {}
      if (ids.includes('p1'))
        // item ≠ bill total → the total keeps its own line
        out.p1 = { linked: true, billAmount: 9440, items: [{ name: 'Water heater 50-gal', count: 1, unitPrice: 2150, description: null, amount: 2150 }] }
      if (ids.includes('p2'))
        out.p2 = { linked: false, billAmount: null, items: [{ name: 'Water softener', count: 1, unitPrice: 1290, description: null, amount: 1290 }] }
      if (ids.includes('p3'))
        // single item that IS the bill total → label rides the item line
        out.p3 = { linked: true, billAmount: 313, items: [{ name: 'Reset pedestal sink and toilet', count: 1, unitPrice: 313, description: null, amount: 313 }] }
      if (ids.includes('p4')) out.p4 = { linked: true, billAmount: 5983, items: [] }
      return { data: out }
    }
    return { data: null }
  })
})

describe('PaySpeedDataHealthModal', () => {
  it('shows billed → paid under a column header, sent date on hover', async () => {
    render(<PaySpeedDataHealthModal onClose={vi.fn()} canExclude={false} />)
    expect(await screen.findByText('billed → paid')).toBeTruthy()
    expect(screen.getByText(/03\/10 →/)).toBeTruthy()
    expect(screen.getByText('03/12')).toBeTruthy()
    expect(screen.getByTitle('Billed 03/10 → paid 03/12 · sent 03/10')).toBeTruthy()
    // p2 has no bill at all: dash placeholder, hover explains
    expect(screen.getByTitle(/Received 08\/11 — no bill date to measure from/)).toBeTruthy()
  })

  it('splits the old "unlinked" chip: no bill vs no bill date vs billed after paid; address gets its own line', async () => {
    render(<PaySpeedDataHealthModal onClose={vi.fn()} canExclude={false} />)
    expect(await screen.findByText('no bill')).toBeTruthy()
    expect(screen.getByText('no bill date')).toBeTruthy()
    expect(screen.getByText('billed after paid')).toBeTruthy()
    expect(screen.getByText('Missing info · 3')).toBeTruthy()
    expect(screen.getByText('180 Go Away Rd, Blanco, TX')).toBeTruthy()
    // the bad date's hover says why it can't be right
    expect(screen.getByTitle(/recorded bill date is after the payment/)).toBeTruthy()
    // read-only viewers get no inline editor
    expect(screen.queryByText('＋ add date')).toBeNull()
  })

  it('types a bill date inline (MM/DD/YY, auto-slashed) and saves it to the bill', async () => {
    render(<PaySpeedDataHealthModal onClose={vi.fn()} canExclude />)
    // p3 (no date) and p4 (billed after paid) both offer the editor — p2 has no bill
    const adds = await screen.findAllByText('＋ add date')
    expect(adds).toHaveLength(2)
    const add = adds[0]!
    fireEvent.click(add)
    const input = screen.getByLabelText('Bill date (MM/DD/YY)') as HTMLInputElement
    fireEvent.change(input, { target: { value: '081326' } })
    expect(input.value).toBe('08/13/26')
    const before = rpc.mock.calls.filter((c) => c[0] === 'get_pay_speed_transactions').length
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(invoiceUpdates).toHaveLength(1))
    expect(invoiceUpdates[0]).toEqual({
      table: 'jobs_ledger_invoices',
      values: { billed_at: '2026-08-13T18:00:00.000Z' },
      eq: ['id', 'i9'],
    })
    // the list re-pulls so the row flips to measurable
    await waitFor(() => {
      const after = rpc.mock.calls.filter((c) => c[0] === 'get_pay_speed_transactions').length
      expect(after).toBe(before + 1)
    })
  })

  it('panels: headers gone, single-item bill total rides the item line, context caption on no-bill rows', async () => {
    render(<PaySpeedDataHealthModal onClose={vi.fn()} canExclude={false} />)
    await waitFor(() => expect(screen.getByText('Water heater 50-gal')).toBeTruthy())
    expect(screen.queryByText('What this bill charged')).toBeNull()
    expect(screen.queryByText(/the job's line items, for context/)).toBeNull()
    expect(screen.getByText('job’s items — payment isn’t on a bill')).toBeTruthy()
    // p1: item ≠ bill total → separate line; p3: single matching item → inline label
    expect(screen.getAllByText('bill total')).toHaveLength(2)
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
