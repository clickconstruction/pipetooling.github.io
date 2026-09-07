// @vitest-environment jsdom
/**
 * Render tests for the People → Hours "Assign … to jobs or bids" window after
 * v2.2966: a pick puts the job on the day's clock sessions (one UPDATE on
 * clock_sessions), days with hours but no closed session are skipped, and the
 * hand-typed split editor (percent boxes + Accept) is gone.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'

const updateCalls: Array<{ patch: unknown; ids: unknown }> = []

vi.mock('../lib/supabase', () => {
  const SESSIONS = [
    {
      id: 's1',
      clocked_in_at: '2026-09-05T13:33:00Z',
      clocked_out_at: '2026-09-05T14:16:12Z',
      work_date: '2026-09-05',
      notes: 'Blanco and ati job',
      job_ledger_id: null,
      bid_id: null,
      approved_at: '2026-09-05T20:00:00Z',
    },
  ]
  const TABLES: Record<string, { list: unknown[]; single: unknown }> = {
    hours_days_correct: { list: [{ work_date: '2026-09-04' }, { work_date: '2026-09-05' }], single: null },
    people_hours: {
      list: [
        { person_name: 'Isiah', work_date: '2026-09-04', hours: 8 },
        { person_name: 'Isiah', work_date: '2026-09-05', hours: 0.72 },
      ],
      single: null,
    },
    users: { list: [{ id: 'u-isiah' }], single: { id: 'u-isiah' } },
    clock_sessions: { list: SESSIONS, single: null },
  }
  const RPCS: Record<string, unknown[]> = {
    list_people_pay_flags: [{ person_name: 'Isiah', person_id: null, is_salary: false, record_hours_but_salary: false }],
    search_jobs_ledger: [
      { id: 'j1', hcp_number: '523', click_number: '523', job_name: 'Mission Hills', job_address: '2100 Independence Dr', service_type_id: null },
    ],
  }
  function makeBuilder(table: string, listResult: unknown[], singleResult: unknown) {
    const builder: Record<string, unknown> = {}
    let pendingPatch: unknown = undefined
    for (const m of ['select', 'eq', 'neq', 'is', 'in', 'or', 'not', 'gte', 'lte', 'order', 'limit', 'insert', 'upsert', 'delete']) {
      builder[m] = (...args: unknown[]) => {
        if (m === 'in' && pendingPatch !== undefined) {
          updateCalls.push({ patch: pendingPatch, ids: args[1] })
          pendingPatch = undefined
        }
        return builder
      }
    }
    builder.update = (patch: unknown) => {
      pendingPatch = patch
      return builder
    }
    const list = () => Promise.resolve({ data: listResult, error: null })
    builder.single = () => Promise.resolve({ data: singleResult, error: null })
    builder.maybeSingle = () => Promise.resolve({ data: singleResult, error: null })
    builder.then = (f?: (v: unknown) => unknown, r?: (e: unknown) => unknown) => list().then(f, r)
    void table
    return builder
  }
  return {
    supabase: {
      from: (table: string) => makeBuilder(table, TABLES[table]?.list ?? [], TABLES[table]?.single ?? null),
      rpc: (name: string) => makeBuilder(`rpc:${name}`, RPCS[name] ?? [], null),
      channel: () => {
        const ch: Record<string, unknown> = {}
        ch.on = () => ch
        ch.subscribe = () => ch
        ch.unsubscribe = () => Promise.resolve('ok')
        return ch
      },
      removeChannel: () => {},
    },
  }
})

vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import { HoursUnassignedModal } from './HoursUnassignedModal'
import { renderWithProviders } from '../test/renderSmokeMocks'

afterEach(() => {
  cleanup()
  updateCalls.length = 0
})

async function renderModal() {
  const onSaved = vi.fn()
  renderWithProviders(
    <HoursUnassignedModal personName="Isiah" hoursDateStart="2026-08-30" hoursDateEnd="2026-09-05" onClose={() => {}} onSaved={onSaved} canEditCrewJobs />,
  )
  await screen.findByText('Assign Isiah to jobs or bids')
  return { onSaved }
}

describe('HoursUnassignedModal (v2.2966 — no split without a clock session)', () => {
  it('offers only the day with a closed session, lists the no-clock day as skipped, and has no hand-typed split editor', async () => {
    await renderModal()
    // Sep 4 has 8 payroll hours but no session → skipped, not in the day picker.
    expect(await screen.findByText(/Skipped — no clock session: Fri, Sep 4/)).toBeTruthy()
    const daySelect = screen.getByRole('combobox') as HTMLSelectElement
    expect([...daySelect.options].map((o) => o.text)).toEqual(['Sat, Sep 5, 2026'])
    // The day's state line + the two actions.
    expect(await screen.findByText(/1 session \(0\.72 h\) with no job or bid/)).toBeTruthy()
    expect(screen.getByRole('button', { name: '+ Search jobs & bids' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Split day…' })).toBeTruthy()
    // Gone: the percent boxes and the Accept button.
    expect(document.querySelector('input[type="number"]')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull()
  })

  it('a search pick links the day\'s unlinked sessions with one clock_sessions update, then reloads', async () => {
    const { onSaved } = await renderModal()
    await screen.findByText(/1 session \(0\.72 h\) with no job or bid/)
    fireEvent.click(screen.getByRole('button', { name: '+ Search jobs & bids' }))
    const input = screen.getByPlaceholderText('Search HCP, bid #, job name, project, address…')
    fireEvent.change(input, { target: { value: 'mission' } })
    const result = await screen.findByText(/Mission Hills/, {}, { timeout: 3000 })
    fireEvent.click(result.closest('button') as HTMLButtonElement)
    await waitFor(() => expect(updateCalls.length).toBe(1))
    expect(updateCalls[0]).toEqual({ patch: { job_ledger_id: 'j1', bid_id: null }, ids: ['s1'] })
    expect(await screen.findByText(/Linked 1 session \(0\.72 h\) to .*Mission Hills — split recomputed from the clock/)).toBeTruthy()
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    // No crew-table write happened — the only mutation was the session update.
    expect(updateCalls.every((c) => 'job_ledger_id' in (c.patch as object))).toBe(true)
  })
})
