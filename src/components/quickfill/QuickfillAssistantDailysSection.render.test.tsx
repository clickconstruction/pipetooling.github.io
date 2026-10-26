// @vitest-environment jsdom
/**
 * Assistant Dailys reads its siblings (v2.5884, punch list #180): a box marked as reading a station
 * draws a read mark and is done by that station's mark today; the time-off box lists who is off and
 * is done on its own when nobody is; a plain box stays a tick. The metric follows the rows.
 */
import type { ReactNode } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { QuickfillSectionMetricsProvider, useQuickfillSectionMetric, useReportQuickfillSectionMetric } from '../../contexts/QuickfillSectionMetricsContext'
import { QuickfillAssistantDailysSection } from './QuickfillAssistantDailysSection'

const state = vi.hoisted(() => ({
  settings: {} as Record<string, string>,
  timeOff: [] as Array<{ user_id: string; start_date: string; end_date: string; users: { name: string | null } }>,
  ops: [] as Array<{ table: string; op: string; payload?: unknown }>,
  role: 'assistant' as string,
}))

vi.mock('../../lib/supabase', () => {
  function builder(table: string) {
    let op = 'select'
    const b: Record<string, unknown> = {}
    b.select = () => b
    for (const w of ['insert', 'delete', 'upsert', 'update']) {
      b[w] = (payload?: unknown) => {
        op = w
        state.ops.push({ table, op: w, payload })
        return b
      }
    }
    for (const m of ['eq', 'order', 'limit', 'gte', 'lte', 'in']) b[m] = () => b
    const rows = () => {
      if (op !== 'select') return null
      if (table === 'app_settings') return Object.entries(state.settings).map(([key, value_text]) => ({ key, value_text }))
      if (table === 'user_time_off') return state.timeOff
      return []
    }
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve({ data: rows(), error: null }).then(ok, bad)
    return b
  }
  return { supabase: { from: (table: string) => builder(table) } }
})
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../../test/renderSmokeMocks')
  return { useAuth: () => makeUseAuthValue({ role: state.role }), AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</> }
})

const ITEMS = [
  { id: 's', label: 'Check for obvious schedule conflicts', reads: 'schedule' },
  { id: 'e', label: 'Is my email inbox clear?', reads: 'email-inbox' },
  { id: 't', label: 'Tell the lead about upcoming time off', reads: 'time-off' },
  { id: 'x', label: 'Water the plants' },
]

const todayIso = () => new Date().toISOString()

/** A sibling station's reporter, so the Dailys sees a live count; and a probe of the Dailys' own metric. */
function Email({ count }: { count: number }) {
  useReportQuickfillSectionMetric('email-inbox', count, false, null, null, `Open Ridgeway Builders · ${count} open`)
  return null
}
function Probe() {
  const m = useQuickfillSectionMetric('assistant-dailys')
  return (
    <div data-testid="probe">
      {m.loading ? 'loading' : `${m.count ?? '-'}|${m.nextLine ?? ''}|${m.markNote ?? ''}`}
    </div>
  )
}

function Host({ marks }: { marks: Record<string, { marked_at: string; marked_by_name?: string | null }> }) {
  return (
    <QuickfillSectionMetricsProvider>
      <Email count={6} />
      <QuickfillAssistantDailysSection siblingMarks={marks} onOpenStation={() => undefined} />
      <Probe />
    </QuickfillSectionMetricsProvider>
  )
}

beforeAll(installDomShims)
beforeEach(() => {
  state.ops = []
  state.role = 'assistant'
  state.settings = { quickfill_assistant_dailys_items: JSON.stringify(ITEMS) }
  state.timeOff = []
})
afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('Assistant Dailys reads its siblings (v2.5884)', () => {
  it('a station row is done by that station\'s mark today, shows the live count, and the metric follows', async () => {
    renderWithProviders(<Host marks={{ schedule: { marked_at: todayIso(), marked_by_name: 'Marisol' } }} />)
    await screen.findByText('Water the plants')
    await settle()
    expect(screen.getByRole('img', { name: 'Schedule marked today' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Email not marked today' })).toBeTruthy()
    expect(document.querySelector('[data-dailys-station="email-inbox"]')?.textContent).toContain('6 open')
    expect(screen.getByRole('button', { name: 'Open the station →' })).toBeTruthy()
    // Email (not marked) and the plant tick are open; the time-off row is done on its own with nobody off.
    expect(screen.getByText('Nobody is off in the next 14 days.')).toBeTruthy()
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toContain('2|Mark Email · 6 open|'))
    expect(screen.getByTestId('probe').textContent).toContain('Email not marked (6 open)')
    // A read row has no checkbox: three boxes are left for the time-off and the plant rows plus none for the stations.
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
  })

  it('the time-off row lists who is off and waits for its tick', async () => {
    state.timeOff = [
      { user_id: 'u1', start_date: '2099-01-02', end_date: '2099-01-03', users: { name: 'Jorge R.' } },
    ]
    // Far-future rows are outside the 14-day window; put one inside it instead.
    const soon = new Date()
    soon.setDate(soon.getDate() + 3)
    const ymd = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}`
    state.timeOff = [{ user_id: 'u1', start_date: ymd, end_date: ymd, users: { name: 'Jorge R.' } }]
    renderWithProviders(<Host marks={{}} />)
    await screen.findByText('Water the plants')
    await settle()
    expect(screen.getByText(/Jorge R\. off/)).toBeTruthy()
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toMatch(/^4\|Mark Schedule\|/))
    const box = screen.getByRole('checkbox', { name: /Tell the lead about upcoming time off/ })
    expect(box).toHaveProperty('disabled', false)
    fireEvent.click(box)
    await waitFor(() => expect(state.ops.filter((o) => o.table === 'quickfill_assistant_dailys_daily_checks' && o.op === 'insert')).toHaveLength(1))
  })

  it('a role the table hides time off from keeps the tick and is told', async () => {
    state.role = 'controller'
    renderWithProviders(<Host marks={{}} />)
    await screen.findByText('Water the plants')
    await settle()
    expect(screen.getByText('The app reads time off for the office roles. Ask, then tick.')).toBeTruthy()
    expect(state.ops.filter((o) => o.table === 'user_time_off')).toHaveLength(0)
    expect(screen.getByRole('checkbox', { name: /Tell the lead/ })).toHaveProperty('disabled', false)
  })
})
