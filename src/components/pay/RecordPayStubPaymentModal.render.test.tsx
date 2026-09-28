// @vitest-environment jsdom
/**
 * Render smoke for Record payment (v2.3930): the dialog over `useRecordPayStubPayment` opens on
 * a stub with what is left, offers the employee credit when the amount runs over, and Confirm
 * writes no more than the remaining balance.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { RecordPayStubPaymentModal } from './RecordPayStubPaymentModal'
import { useRecordPayStubPayment } from '../../hooks/useRecordPayStubPayment'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { PayStubLineMaps } from '../../lib/pay/recordPayStubPayment'
import type { PayStubRow } from '../people/PeoplePayStubsTab'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

const writes = vi.hoisted(() => ({ inserts: [] as Array<{ table: string; row: unknown }> }))

vi.mock('../../lib/supabase', () => {
  function makeBuilder(table: string): Record<string, unknown> {
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'update', 'upsert', 'delete', 'eq', 'in', 'order', 'limit', 'is', 'not']) {
      builder[m] = () => builder
    }
    builder.insert = (row: unknown) => {
      writes.inserts.push({ table, row })
      return builder
    }
    builder.single = () => Promise.resolve({ data: { id: 'payment-1' }, error: null })
    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(onFulfilled, onRejected)
    return builder
  }
  return {
    supabase: {
      from: (table: string) => makeBuilder(table),
      rpc: () => Promise.resolve({ data: [], error: null }),
    },
  }
})

const STUB: PayStubRow = {
  id: 's1',
  person_name: 'Alex Rivera',
  period_start: '2026-09-14',
  period_end: '2026-09-20',
  hours_total: 40,
  gross_pay: 1000,
  created_at: null,
  paid_at: null,
  paid_by: null,
  paid_note: null,
}

// Gross 1,000 − 100 Less = 900 net; 400 paid → 500 left.
const MAPS: PayStubLineMaps = {
  paymentsByStubId: { s1: [{ id: 'p1', pay_stub_id: 's1', amount: 400, paid_at: '2026-09-22T12:00:00Z', memo: null, created_at: null, created_by: null }] },
  deductionsByStubId: { s1: [{ id: 'd1', pay_stub_id: 's1', amount: 100, source: 'manual', person_offset_id: null, description: 'Advance', created_at: null, created_by: null }] },
  additionalByStubId: {},
}

const loadPayStubs = vi.fn(() => Promise.resolve(null))
const setError = vi.fn()
const onOffsetError = vi.fn()

function Harness() {
  const recordPayment = useRecordPayStubPayment({ authUserId: 'u-office', payStubLineMaps: MAPS, loadPayStubs, setError })
  return (
    <>
      <button type="button" onClick={() => recordPayment.openPayStubMarkPaidModal(STUB)}>
        open record payment
      </button>
      <span data-testid="marking">{recordPayment.markingPayStubId ?? 'idle'}</span>
      <RecordPayStubPaymentModal recordPayment={recordPayment} personNameOptions={['Alex Rivera']} onOffsetError={onOffsetError} />
    </>
  )
}

afterEach(cleanup)

beforeEach(() => {
  writes.inserts.length = 0
  loadPayStubs.mockClear()
  setError.mockClear()
})

describe('RecordPayStubPaymentModal', () => {
  it('is nothing until a door opens it', () => {
    renderWithProviders(<Harness />)
    // first paint
    expect(screen.queryByText('Record payment')).toBeNull()
  })

  it('opens on the stub with what is left, and offers the employee credit past it', async () => {
    renderWithProviders(<Harness />)
    fireEvent.click(screen.getByText('open record payment'))

    const heading = await screen.findByText('Record payment')
    const summary = heading.parentElement?.querySelector('p')?.textContent ?? ''
    expect(summary).toContain('Alex Rivera')
    expect(summary).toContain('Net Pay $900.00')
    expect(summary).toContain('Remaining $500.00')
    const amount = screen.getByPlaceholderText('0.00') as HTMLInputElement
    expect(amount.value).toBe('500.00')
    expect(screen.queryByRole('button', { name: 'Record employee credit…' })).toBeNull()

    fireEvent.change(amount, { target: { value: '650' } })
    expect(await screen.findByRole('button', { name: 'Record employee credit…' })).toBeTruthy()
  })

  it('Confirm writes no more than the remaining balance, reloads, and closes', async () => {
    renderWithProviders(<Harness />)
    fireEvent.click(screen.getByText('open record payment'))
    const amount = (await screen.findByPlaceholderText('0.00')) as HTMLInputElement
    fireEvent.change(amount, { target: { value: '650' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => expect(loadPayStubs).toHaveBeenCalledTimes(1))
    expect(writes.inserts).toHaveLength(1)
    expect(writes.inserts[0]?.table).toBe('pay_stub_payments')
    expect(writes.inserts[0]?.row).toMatchObject({ pay_stub_id: 's1', amount: 500, created_by: 'u-office' })
    await waitFor(() => expect(screen.queryByText('Record payment')).toBeNull())
    await waitFor(() => expect(screen.getByTestId('marking').textContent).toBe('idle'))
  })

  it('refuses a blank amount with the page error and writes nothing', async () => {
    renderWithProviders(<Harness />)
    fireEvent.click(screen.getByText('open record payment'))
    const amount = (await screen.findByPlaceholderText('0.00')) as HTMLInputElement
    fireEvent.change(amount, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => expect(setError).toHaveBeenCalledWith('Enter a valid payment amount greater than zero.'))
    expect(writes.inserts).toEqual([])
    expect(loadPayStubs).not.toHaveBeenCalled()
  })
})
