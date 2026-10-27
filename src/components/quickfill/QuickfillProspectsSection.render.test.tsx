// @vitest-environment jsdom
/**
 * Prospects past their day (v2.5886, punch list #180): the active prospects fold into Promised and
 * missed, Past their days and On time by their last touch, the promised callbacks and the owner's
 * days per warmth; the count is the prospects past their day; the Mark's note comes from the rows.
 */
import type { ReactNode } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { QuickfillSectionMetricsProvider, useQuickfillSectionMetric } from '../../contexts/QuickfillSectionMetricsContext'
import { QuickfillProspectsSection } from './QuickfillProspectsSection'

const DAY = 86_400_000
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString()

const state = vi.hoisted(() => ({ prospects: [] as unknown[], callbacks: [] as unknown[], daysText: null as string | null }))

vi.mock('../../lib/supabase', () => {
  function builder(table: string) {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'gte', 'order', 'range', 'upsert']) b[m] = () => b
    b.maybeSingle = () => Promise.resolve({ data: state.daysText == null ? null : { key: 'quickfill_prospect_days_v1', value_text: state.daysText }, error: null })
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => {
      const data = table === 'prospects' ? state.prospects : table === 'prospect_callbacks' ? state.callbacks : []
      return Promise.resolve({ data, error: null }).then(ok, bad)
    }
    return b
  }
  return { supabase: { from: (table: string) => builder(table), rpc: () => Promise.resolve({ data: null, error: null }) } }
})
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../../test/renderSmokeMocks')
  return { useAuth: () => makeUseAuthValue({ role: 'assistant', user: { id: 'u1' } as never }), AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</> }
})
vi.mock('../../lib/prospectTeamActivity', () => ({ loadProspectTeamActivity: async () => ({}) }))
vi.mock('./ProspectTeamActivityLineChart', () => ({ ProspectTeamActivityLineChart: () => <div data-testid="chart" /> }))

function Probe() {
  const m = useQuickfillSectionMetric('prospects')
  return <div data-testid="probe">{m.loading ? 'loading' : `${m.count ?? '-'}|${m.nextLine ?? ''}|${m.markNote ?? ''}`}</div>
}

function prospect(id: string, company: string, warmth: number, lastDaysAgo: number | null, extra: Record<string, unknown> = {}) {
  return { id, company_name: company, contact_name: null, warmth_count: warmth, last_contact: lastDaysAgo == null ? null : ago(lastDaysAgo), created_at: ago(200), prospect_fit_status: null, converted_customer_id: null, ...extra }
}

beforeAll(installDomShims)
beforeEach(() => {
  state.prospects = [
    prospect('a', 'Westlake Custom Homes', 3, 10),
    prospect('b', 'Blanco River Builders', 2, 45),
    prospect('c', 'On Time Co', 0, 20),
    prospect('d', 'Gone Cold Co', 0, 5, { prospect_fit_status: 'cant_reach' }),
  ]
  state.callbacks = [{ prospect_id: 'a', callback_date: ago(3), title: 'Call back: Westlake' }]
  state.daysText = null
})
afterEach(cleanup)

describe('Prospects past their day (v2.5886)', () => {
  it('folds the prospects, counts the ones past their day, and writes the note from the rows', async () => {
    renderWithProviders(
      <QuickfillSectionMetricsProvider>
        <QuickfillProspectsSection lastMarkedAt={ago(4)} />
        <Probe />
      </QuickfillSectionMetricsProvider>,
    )
    await screen.findByText('Westlake Custom Homes')
    await settle()
    expect(document.querySelector('[data-prospects-fold="missed"]')!.textContent).toContain('Westlake Custom Homes')
    expect(document.querySelector('[data-prospects-fold="missed"]')!.textContent).toContain('3 days over')
    expect(document.querySelector('[data-prospects-fold="past"]')!.textContent).toContain('Blanco River Builders')
    expect(document.querySelector('[data-prospects-fold="past"]')!.textContent).toContain('due every 14 days · 31 days over')
    // On time is folded, the can't-reach prospect is out, the buckets live under On time.
    expect(screen.queryByText('On Time Co')).toBeNull()
    expect(screen.queryByText('Gone Cold Co')).toBeNull()
    expect(screen.queryByText('Active prospects by warmth')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /On time/ }))
    expect(screen.getByText('Active prospects by warmth')).toBeTruthy()
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toMatch(/^2\|Call Westlake Custom Homes · promised .* · 3 days over\|2 past their day · 1 promised and missed/))
    expect(document.querySelector('[data-prospects-since]')!.textContent).toContain('+1 new past')
    expect(screen.getAllByRole('link', { name: 'Open →' })).toHaveLength(2)
  })

  it('the owner\'s days change the fold', async () => {
    state.daysText = '{"w3":7,"w2":60,"w1":30,"w0":60}'
    state.callbacks = []
    renderWithProviders(
      <QuickfillSectionMetricsProvider>
        <QuickfillProspectsSection />
        <Probe />
      </QuickfillSectionMetricsProvider>,
    )
    await screen.findByText(/warm 2 every 60/)
    await settle()
    // No callbacks: the open Promised and missed fold says its good state (punch list #184, sweep C).
    expect(document.querySelector('[data-prospects-fold="missed"] [data-empty-state]')!.textContent).toBe('No promised callback is past.')
    expect(document.querySelector('[data-prospects-fold="past"]')!.textContent).not.toContain('Blanco River Builders')
    // Westlake: warm 3, touched 10 days ago, due every 7 → past.
    expect(document.querySelector('[data-prospects-fold="past"]')!.textContent).toContain('Westlake Custom Homes')
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toMatch(/^1\|Call Westlake Custom Homes · warm 3 · 10d since the last touch · 3 days over\|/))
  })
})
