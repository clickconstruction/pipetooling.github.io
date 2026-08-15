// @vitest-environment jsdom
/**
 * Render smoke for the Offsets Settle-up board (v2.1668 redesign): per-person
 * rows price unpaid reports, unreported hours, credits, and charges into one
 * settle-up number (action rows first, settled last); clicking a person opens
 * the equation-first ledger with a Needs-action list and folded History/Jobs.
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
  pay_stub_payments: [
    { id: 'p1', pay_stub_id: 's1', amount: 1000, paid_at: '2026-08-05T12:00:00Z', memo: 'cashapp', created_at: null, created_by: null },
  ],
  people_hours: [],
  people: [],
  people_crew_jobs: [],
  people_pay_config: [],
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
  // s1: gross 1840, $1,000 recorded → $840 remaining (Unpaid reports column).
  { id: 's1', person_name: 'Abraham', period_start: '2026-07-26', period_end: '2026-08-01', hours_total: 41.5, gross_pay: 1840, created_at: null, paid_at: null, paid_by: null, paid_note: null },
]

async function findExact(want: string) {
  return screen.findAllByText((_, el) => el?.childElementCount === 0 && el?.textContent === want)
}

describe('PeopleOffsetsTab settle-up board', () => {
  it('prices each column, sorts action rows first, and opens the equation-first ledger', async () => {
    renderWithProviders(
      <PeopleOffsetsTab
        people={[]}
        users={[]}
        payStubs={PAY_STUBS}
        loadPayStubs={() => Promise.resolve()}
        archivedUserNames={new Set(['Trace'])}
      />,
    )

    expect((await screen.findAllByText('Settle up')).length).toBeGreaterThan(0)
    expect((await screen.findAllByText('Abraham')).length).toBeGreaterThan(0)

    // Abraham: $840 unpaid − $425 charge = owes... no: 840 − 425 = pay $415.
    expect((await findExact('$840.00')).length).toBeGreaterThan(0)
    expect((await findExact('−$425.00')).length).toBeGreaterThan(0)
    expect((await findExact('pay $415.00')).length).toBeGreaterThan(0)
    // Trace is archived → folded into the collapsed Archived users section;
    // his row is hidden until the section expands.
    expect(screen.queryByText('pay $150.00')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Archived users \(1\)/ }))
    expect((await findExact('pay $150.00')).length).toBeGreaterThan(0)
    // Malachi: everything applied → settled, sorted last.
    expect((await findExact('settled')).length).toBeGreaterThan(0)
    const nameCells = screen.getAllByRole('row').map((r) => r.textContent ?? '')
    expect(nameCells[nameCells.length - 1]).toContain('Malachi')

    // Click Abraham → the ledger: equation banner, Needs action rows with
    // verbs, folded History and Jobs toggles, Pay statement.
    fireEvent.click(screen.getAllByText('Abraham')[0]!)
    expect(await screen.findByText(/pay Abraham \$415\.00/)).toBeTruthy()
    expect(screen.getByText('Needs action')).toBeTruthy()
    expect(screen.getByText('Partly paid')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Record payment' })).toBeTruthy()
    expect(screen.getByText('Charge')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Apply to report' })).toBeTruthy()
    expect(screen.getByText(/History — /)).toBeTruthy()
    expect(screen.getByText(/Jobs worked — /)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Pay statement' })).toBeTruthy()

    // Expand History: the week block shows the report, its payment, and status.
    fireEvent.click(screen.getByText(/History — /))
    expect((await screen.findAllByText(/Week /)).length).toBeGreaterThan(0)
    expect(screen.getByText(/Paid Aug 5.*cashapp/)).toBeTruthy()
    expect(screen.getByText('$840.00 still owed')).toBeTruthy()
  })
})
