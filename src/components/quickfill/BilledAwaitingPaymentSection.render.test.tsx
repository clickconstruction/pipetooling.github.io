// @vitest-environment jsdom
/**
 * Billed Awaiting Payment reads the lean (v2.5885, punch list #180): the customers fold into Need a
 * lean, Leaned on or promised, and Not yet past due; the count is the customers needing a lean; a
 * lean is logged from the row through the shared chase path; the Mark's note comes from the rows.
 */
import type { ReactNode } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { QuickfillSectionMetricsProvider, useQuickfillSectionMetric } from '../../contexts/QuickfillSectionMetricsContext'
import { BilledAwaitingPaymentSection } from './BilledAwaitingPaymentSection'

const state = vi.hoisted(() => ({
  rpc: [] as Array<{ fn: string; args: unknown }>,
  touches: [] as unknown[],
  promises: {} as Record<string, unknown>,
}))

const DAY = 86_400_000
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString()

vi.mock('../../lib/supabase', () => {
  function builder(table: string) {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'order', 'range', 'upsert', 'maybeSingle']) b[m] = () => b
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => {
      const data = table === 'jobs_ledger' ? [{ id: 'j1', job_name: 'Lot 7', customer_name: 'Ridgeway Builders', customer_id: 'c1' }, { id: 'j2', job_name: 'Building C', customer_name: 'Cedar Bend Partners', customer_id: 'c2' }, { id: 'j3', job_name: 'Clinic', customer_name: 'Lone Oak Dental', customer_id: 'c3' }] : table === 'app_settings' ? null : []
      return Promise.resolve({ data, error: null }).then(ok, bad)
    }
    return b
  }
  return {
    supabase: {
      from: (table: string) => builder(table),
      rpc: (fn: string, args?: unknown) => {
        state.rpc.push({ fn, args })
        if (fn === 'list_payment_chase_touches') return Promise.resolve({ data: state.touches, error: null })
        if (fn === 'list_job_promised_pay_dates') return Promise.resolve({ data: state.promises, error: null })
        return Promise.resolve({ data: null, error: null })
      },
    },
  }
})
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../../test/renderSmokeMocks')
  return { useAuth: () => makeUseAuthValue({ role: 'assistant', user: { id: 'u1' } as never }), AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</> }
})
vi.mock('../../lib/jobs/zzTestJobSwitch', () => ({ useZzTestJobsHidden: () => false }))
// Three billed rows: two past due (64 and 51 days), one fresh (12 days). The breakdown reads the billed date off the invoice.
vi.mock('../../lib/jobs/fetchStagesHeaderStats', () => ({
  fetchStagesHeaderStats: async () => ({
    ok: true,
    stats: {},
    billTruth: { excludedOwed: { count: 0, total: 0 } },
    leanBilledRows: [
      { kind: 'invoice', job: { id: 'j1', customer_id: 'c1', hcp_number: '101', fixtures: [] }, inv: { id: 'i1', amount: 41200, billed_at: ago(64), status: 'billed' } },
      { kind: 'invoice', job: { id: 'j2', customer_id: 'c2', hcp_number: '102', fixtures: [] }, inv: { id: 'i2', amount: 18750, billed_at: ago(51), status: 'billed' } },
      { kind: 'invoice', job: { id: 'j3', customer_id: 'c3', hcp_number: '103', fixtures: [] }, inv: { id: 'i3', amount: 800, billed_at: ago(12), status: 'billed' } },
    ],
  }),
}))

function Probe() {
  const m = useQuickfillSectionMetric('billed-awaiting')
  return <div data-testid="probe">{m.loading ? 'loading' : `${m.count ?? '-'}|${m.nextLine ?? ''}|${m.markNote ?? ''}`}</div>
}

// 20:30 Central, when the UTC day is already tomorrow: the evening the lean read used to count wrong (v2.5947).
// Every fixture below is built from this clock.
const NOW = '2026-10-27T01:30:00.000Z'

beforeAll(installDomShims)
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(NOW))
  state.rpc = []
  state.touches = [
    { id: 't1', customerId: 'c1', jobId: null, outcome: 'cant_reach', note: null, promisedYmd: null, snoozeDays: 7, resolvedAt: null, createdAt: ago(12), createdByName: 'Marisol' },
    // A fresh lean on the customer who is not yet past due: counted as leaned on since the last look, never as needing one.
    { id: 't0', customerId: 'c3', jobId: null, outcome: 'note', note: 'thanked them', promisedYmd: null, snoozeDays: null, resolvedAt: null, createdAt: ago(1), createdByName: 'Marisol' },
  ]
  state.promises = {}
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Billed Awaiting Payment reads the lean (v2.5885)', () => {
  it('folds the customers, counts the ones needing a lean, and writes the note from the rows', async () => {
    renderWithProviders(
      <QuickfillSectionMetricsProvider>
        <BilledAwaitingPaymentSection lastMarkedAt={ago(3)} />
        <Probe />
      </QuickfillSectionMetricsProvider>,
    )
    await screen.findByText('Ridgeway Builders')
    await settle()
    const needs = document.querySelector('[data-lean-fold="needs"]')!
    expect(needs.textContent).toContain('Need a lean')
    expect(needs.textContent).toContain('Ridgeway Builders')
    expect(needs.textContent).toContain('no lean in 12d')
    expect(needs.textContent).toContain('Cedar Bend Partners')
    expect(needs.textContent).toContain('never leaned on')
    // The fresh bill sits in the folded Not yet past due.
    expect(screen.queryByText('Lone Oak Dental')).toBeNull()
    expect(document.querySelector('[data-lean-fold="current"]')!.textContent).toContain('Not yet past due')
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toMatch(/^2\|Lean on Ridgeway Builders · \$41,200 · 64 days · no lean in 12d\|2 need a lean \(no lean in 7 days\)/))
    expect(document.querySelector('[data-lean-since]')!.textContent).toContain('1 leaned on')
  })

  it('a lean logged from the row goes through the chase path and re-reads the touches', async () => {
    renderWithProviders(
      <QuickfillSectionMetricsProvider>
        <BilledAwaitingPaymentSection />
      </QuickfillSectionMetricsProvider>,
    )
    await screen.findByText('Cedar Bend Partners')
    await settle()
    fireEvent.click(screen.getByText('Cedar Bend Partners'))
    const cantReach = await screen.findByRole('button', { name: "Couldn't reach" })
    state.touches = [...state.touches, { id: 't2', customerId: 'c2', jobId: null, outcome: 'cant_reach', note: null, promisedYmd: null, snoozeDays: 7, resolvedAt: null, createdAt: new Date().toISOString(), createdByName: 'Marisol' }]
    fireEvent.click(cantReach)
    await waitFor(() => expect(state.rpc.filter((r) => r.fn === 'add_payment_chase_touch')).toHaveLength(1))
    expect(state.rpc.find((r) => r.fn === 'add_payment_chase_touch')!.args).toMatchObject({ p_customer_id: 'c2', p_outcome: 'cant_reach', p_snooze_days: 7 })
    await waitFor(() => expect(document.querySelector('[data-lean-fold="needs"]')!.textContent).not.toContain('Cedar Bend Partners'))
    fireEvent.click(screen.getByRole('button', { name: /Leaned on or promised/ }))
    expect(document.querySelector('[data-lean-fold="waiting"]')!.textContent).toContain('Cedar Bend Partners')
    expect(document.querySelector('[data-lean-fold="waiting"]')!.textContent).toContain('leaned on today')
  })

  it('a promise standing keeps a past-due customer waiting', async () => {
    state.promises = { j2: { promisedYmd: new Date(Date.now() + 4 * DAY).toISOString().slice(0, 10), markedByName: 'Dale' } }
    renderWithProviders(
      <QuickfillSectionMetricsProvider>
        <BilledAwaitingPaymentSection />
        <Probe />
      </QuickfillSectionMetricsProvider>,
    )
    await screen.findByText('Ridgeway Builders')
    await settle()
    expect(document.querySelector('[data-lean-fold="needs"]')!.textContent).not.toContain('Cedar Bend Partners')
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toMatch(/^1\|/))
  })
})
