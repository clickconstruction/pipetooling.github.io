// @vitest-environment jsdom
/**
 * Render smoke for the Offsets tab Balances board (v2.1666): per-person
 * pending nets render signed and sorted (negative first, settled last), and
 * clicking a person opens the money ledger modal with the offset + payment
 * timeline and the Pay statement action.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import PeopleOffsetsTab from './PeopleOffsetsTab'
import { renderWithProviders } from '../../test/renderSmokeMocks'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

const TABLE_ROWS: Record<string, unknown[]> = {
  person_offsets: [
    { id: 'o1', person_name: 'Abraham', type: 'damage', amount: 425, description: 'Cracked windshield', occurred_date: '2026-08-12', pay_stub_id: null, created_at: null },
    { id: 'o2', person_name: 'Trace', type: 'employee_credit', amount: 150, description: 'Referral bonus', occurred_date: '2026-07-30', pay_stub_id: null, created_at: null },
    { id: 'o3', person_name: 'Malachi', type: 'backcharge', amount: 50, description: null, occurred_date: '2026-06-01', pay_stub_id: 'applied-stub', created_at: null },
  ],
  people: [],
  people_crew_jobs: [],
  people_hours: [],
  jobs_ledger: [],
}

vi.mock('../../lib/supabase', () => {
  function makeBuilder(rows: unknown[]): Record<string, unknown> {
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'order', 'range', 'limit', 'or', 'lte', 'gte', 'is', 'not']) {
      builder[m] = () => builder
    }
    builder.single = () => Promise.resolve({ data: rows[0] ?? null, error: null })
    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve({ data: rows, error: null, count: rows.length }).then(onFulfilled, onRejected)
    return builder
  }
  return {
    supabase: {
      from: (table: string) => makeBuilder(TABLE_ROWS[table] ?? []),
      rpc: () => Promise.resolve({ data: [], error: null }),
    },
  }
})

const PAY_STUBS = [
  { id: 's1', person_name: 'Abraham', period_start: '2026-07-28', period_end: '2026-08-03', hours_total: 41.5, gross_pay: 1840, created_at: null, paid_at: '2026-08-08T15:00:00Z', paid_by: null, paid_note: null },
]

describe('PeopleOffsetsTab Balances board', () => {
  it('renders signed balances sorted negative-first and opens the person ledger', async () => {
    renderWithProviders(
      <PeopleOffsetsTab people={[]} users={[]} payStubs={PAY_STUBS} loadPayStubs={() => Promise.resolve()} />,
    )

    expect(await screen.findByText('Balances')).toBeTruthy()
    // The tab defers loadOffsets by 80ms — wait for the first row to land.
    expect((await screen.findAllByText('Abraham')).length).toBeGreaterThan(0)
    // Abraham −425 pending (red, first), Trace +150 (green), Malachi settled last.
    const byExactText = (want: string) => screen.getAllByText((_, el) => el?.childElementCount === 0 && el?.textContent === want)
    expect(byExactText('−$425.00').length).toBeGreaterThan(0)
    expect(byExactText('+$150.00').length).toBeGreaterThan(0)
    expect(screen.getByText('settled')).toBeTruthy()
    const rows = screen.getAllByText(/^(\d+ pending|settled)$/).map((el) => el.parentElement?.textContent ?? '')
    expect(rows[0]).toContain('Abraham')
    expect(rows[rows.length - 1]).toContain('Malachi')

    // Click Abraham → ledger modal: balance chip, stat cards, timeline rows
    // (damage offset + paid report), and the Pay statement button.
    fireEvent.click(screen.getAllByText('Abraham')[0]!)
    expect(await screen.findByText((_, el) => el?.childElementCount === 0 && el?.textContent === 'balance −$425.00')).toBeTruthy()
    expect(screen.getByText('Paid in range')).toBeTruthy()
    expect(screen.getByText('Billing credit (jobs)')).toBeTruthy()
    expect(screen.getAllByText('Cracked windshield').length).toBeGreaterThan(1)
    expect(screen.getByText(/Pay report 2026-07-28/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Pay statement' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Jobs' })).toBeTruthy()
  })
})
