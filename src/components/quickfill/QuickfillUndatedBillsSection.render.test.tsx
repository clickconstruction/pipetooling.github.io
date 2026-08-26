// @vitest-environment jsdom
/**
 * Render smokes for the Quickfill "Missing bill dates" station (v2.2326):
 * the No Count Date scope line, rows with clue chips (payment date / unpaid
 * created date) + HCP, the inline MM/DD/YY save writing billed_at, and the
 * pre-migration fail-soft message.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { QuickfillUndatedBillsSection } from './QuickfillUndatedBillsSection'
import { renderWithProviders } from '../../test/renderSmokeMocks'

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
    }),
  },
}))

const WORKLIST = {
  noCountDate: '2026-08-01',
  bills: [
    {
      invoiceId: 'i1',
      amount: 350,
      status: 'paid',
      createdYmd: '2026-08-20',
      customerName: 'City of Seguin',
      jobId: 'j1',
      jobName: 'Seguin Wave Pool',
      address: '1 Wave Pool Dr, Seguin, TX',
      hcpNumber: '812',
      payments: [{ paidYmd: '2026-08-24', amount: 350 }],
    },
    {
      invoiceId: 'i2',
      amount: 1711,
      status: 'billed',
      createdYmd: '2026-08-12',
      customerName: 'Nick Frantzen',
      jobId: 'j2',
      jobName: 'Frantzen Water Heater',
      address: '204 Wingate Court, Seguin, TX',
      hcpNumber: '918',
      payments: [],
    },
    {
      // billed-after-paid (v2.2337 guard): the recorded date contradicts the payment
      invoiceId: 'i3',
      amount: 5983,
      status: 'paid',
      createdYmd: '2026-08-19',
      billedYmd: '2026-08-19',
      customerName: 'Tyler Moore',
      jobId: 'j3',
      jobName: 'Yogo Studio',
      address: '3556 FM 78 # 103, McQuenny, TX',
      hcpNumber: '955',
      payments: [{ paidYmd: '2026-08-14', amount: 5983 }],
    },
  ],
}

beforeEach(() => {
  rpc.mockReset()
  invoiceUpdates.length = 0
  rpc.mockImplementation(async (fn: unknown) => {
    if (fn === 'get_undated_bill_worklist') return { data: WORKLIST }
    return { data: null }
  })
})

describe('QuickfillUndatedBillsSection', () => {
  it('renders the scope line, clue chips, and HCP identifiers', async () => {
    renderWithProviders(<QuickfillUndatedBillsSection />)
    expect(await screen.findByText('City of Seguin')).toBeTruthy()
    expect(screen.getByText('2026-08-01')).toBeTruthy()
    expect(screen.getByText('paid 08/24')).toBeTruthy()
    expect(screen.getByText('billed, unpaid · created 08/12')).toBeTruthy()
    expect(screen.getByText('billed 08/19 after paid 08/14')).toBeTruthy()
    expect(screen.getByText(/HCP 812/)).toBeTruthy()
    expect(screen.getAllByText('＋ add date')).toHaveLength(3)
  })

  it('saves a typed date to the bill and re-pulls the worklist', async () => {
    renderWithProviders(<QuickfillUndatedBillsSection />)
    fireEvent.click((await screen.findAllByText('＋ add date'))[0]!)
    const input = screen.getByLabelText('Bill date (MM/DD/YY)') as HTMLInputElement
    fireEvent.change(input, { target: { value: '082226' } })
    expect(input.value).toBe('08/22/26')
    const before = rpc.mock.calls.filter((c) => c[0] === 'get_undated_bill_worklist').length
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(invoiceUpdates).toHaveLength(1))
    expect(invoiceUpdates[0]).toEqual({
      table: 'jobs_ledger_invoices',
      values: { billed_at: '2026-08-22T18:00:00.000Z' },
      eq: ['id', 'i1'],
    })
    await waitFor(() => {
      const after = rpc.mock.calls.filter((c) => c[0] === 'get_undated_bill_worklist').length
      expect(after).toBe(before + 1)
    })
  })

  it('refuses future bill dates — Save stays disabled', async () => {
    renderWithProviders(<QuickfillUndatedBillsSection />)
    fireEvent.click((await screen.findAllByText('＋ add date'))[0]!)
    const input = screen.getByLabelText('Bill date (MM/DD/YY)') as HTMLInputElement
    fireEvent.change(input, { target: { value: '123199' } })
    expect(input.value).toBe('12/31/99')
    expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(true)
  })

  it('filters by search across customer and HCP', async () => {
    renderWithProviders(<QuickfillUndatedBillsSection />)
    await screen.findByText('City of Seguin')
    fireEvent.change(screen.getByPlaceholderText('Search customer, job, address, or HCP…'), { target: { value: '918' } })
    expect(screen.queryByText('City of Seguin')).toBeNull()
    expect(screen.getByText('Nick Frantzen')).toBeTruthy()
  })

  it('fails soft before the RPC exists', async () => {
    rpc.mockImplementation(async () => ({ data: null }))
    renderWithProviders(<QuickfillUndatedBillsSection />)
    expect(await screen.findByText(/worklist isn't available yet/)).toBeTruthy()
  })
})
