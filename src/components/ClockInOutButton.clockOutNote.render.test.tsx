// @vitest-environment jsdom
/**
 * Clock out in one press (punch list #189, PR 8): with a session open and a report filed today, Clock Out opens the
 * review called Clock out with the note filled from the report and the line under it saying so. Rendered inside
 * StrictMode on purpose: the first build filled the note inside a state updater with a side effect, which StrictMode's
 * double invocation undid, and the live check on 2026-10-29 caught it.
 */
import { StrictMode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { todayYmdInAppTz } from '../utils/dateUtils'

const nowIso = new Date().toISOString()
const session = { id: 's1', user_id: 'user-1', clocked_in_at: nowIso, clocked_out_at: null, work_date: todayYmdInAppTz(), notes: 'On site at PLUM 1088 · ZZ TEST Riders Walk', job_ledger_id: 'job-1', bid_id: null, approved_at: null, rejected_at: null }
const report = {
  id: 'r1',
  created_at: nowIso,
  field_values: { 'How complete is the job?': '17', 'Stage progress': 'Rough In — → 50% · job 0% → 17%', 'What is the status of the job?': 'ZZ live check, will be deleted' },
  report_templates: { name: 'Status Report' },
  jobs_ledger: { hcp_number: '1088', click_number: '', job_name: 'ZZ TEST Riders Walk' },
}

function table(rows: unknown[]) {
  const make = (single: boolean): Record<string, unknown> => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'neq', 'is', 'in', 'gte', 'lte', 'lt', 'gt', 'or', 'not', 'order', 'limit', 'update', 'insert', 'delete']) b[m] = () => b
    b.single = () => make(true)
    b.maybeSingle = () => make(true)
    const result = () => Promise.resolve(single ? { data: rows[0] ?? null, error: null } : { data: rows, error: null })
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => result().then(ok, bad)
    return b
  }
  return make(false)
}

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as Record<string, unknown> & { from: (t: string) => unknown }
  const originalFrom = stub.from.bind(stub)
  return {
    supabase: {
      ...stub,
      from: (t: string) => (t === 'clock_sessions' ? table([session]) : t === 'reports' ? table([report]) : originalFrom(t)),
    },
  }
})
vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'helpers' })
})
vi.mock('../contexts/DailyGoalsGateContext', () => ({ useDailyGoalsGate: () => ({ notifyFirstClockInOfDay: vi.fn() }) }))
vi.mock('../contexts/UpdateFocusOpenerBridgeContext', () => ({
  useUpdateFocusOpenerBridge: () => ({ registerUpdateFocusOpener: () => () => {}, registerUpdateFocusApplyDirect: () => () => {}, registerClockOutOpener: () => () => {}, notifySessionChanged: () => {} }),
}))
vi.mock('../contexts/LedgerDisplayPrefixContext', () => ({ useLedgerDisplayPrefixes: () => ({ prefixMap: new Map() }) }))
vi.mock('../lib/navClickTelemetry', () => ({ recordNavClick: () => {} }))

import ClockInOutButton from './ClockInOutButton'
import { renderWithProviders } from '../test/renderSmokeMocks'

describe('ClockInOutButton, the clock-out review', () => {
  it('is called Clock out and opens with the note filled from today’s report, in StrictMode', async () => {
    renderWithProviders(
      <StrictMode>
        <ClockInOutButton userId="user-1" userName="Luis Ortega" />
      </StrictMode>,
    )
    const clockOut = await screen.findByRole('button', { name: /Clock Out/i })
    fireEvent.click(clockOut)
    await screen.findByRole('heading', { name: 'Clock out' })
    const box = (await screen.findByPlaceholderText('e.g. Trim set at 456 Oak Ave')) as HTMLTextAreaElement
    await waitFor(() => expect(box.value).toBe('1088 · ZZ TEST Riders Walk: Rough In — → 50% · job 0% → 17%. ZZ live check, will be deleted'))
    expect(screen.getByText("Filled from today's reports. Edit it if you like.")).toBeTruthy()
    // The tech's own words win: typing after the fill is never overwritten by a late read.
    fireEvent.change(box, { target: { value: 'Also swept the garage.' } })
    expect(box.value).toBe('Also swept the garage.')
  })
})
