// @vitest-environment jsdom
/**
 * Render smoke for PeopleSubsTab's "Unattributed sheets" panel: canned rows for
 * the tables the tab loads produce two unmatched sheets on the same job with
 * the same raw name, and we assert the panel groups them into one row with the
 * job chip, raw-name echo, reason badge, summed balance, and all three actions
 * (Open → / Assign… / the conservative ✨ one-tap suggestion).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import PeopleSubsTab from './PeopleSubsTab'
import { renderWithProviders } from '../../test/renderSmokeMocks'

// The sub portal globe (sub-portal train) reads the office role via useAuth.
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

const TABLE_ROWS: Record<string, unknown[]> = {
  people: [{ id: 'p-jesse', name: 'Jesse Ramos', kind: 'sub', archived_at: null, account_user_id: null }],
  users: [],
  people_labor_jobs: [
    { id: 's1', assigned_to_name: 'J Ramos', address: '582 Curvatura', job_number: '892', labor_rate: 0 },
    { id: 's2', assigned_to_name: 'J Ramos', address: '582 Curvatura', job_number: '892', labor_rate: 0 },
  ],
  people_labor_job_assignees: [],
  people_labor_job_items: [
    { job_id: 's1', fixture: 'Top Out', count: 1, hrs_per_unit: 0, is_fixed: true, direct_labor_amount: 1240 },
    { job_id: 's2', fixture: 'Trim', count: 1, hrs_per_unit: 0, is_fixed: true, direct_labor_amount: 1240 },
  ],
  people_labor_job_payments: [],
  step_commitments: [],
  person_contract_documents: [],
}

vi.mock('../../lib/supabase', () => {
  function makeBuilder(rows: unknown[]): Record<string, unknown> {
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'is', 'in', 'order', 'range', 'limit']) {
      builder[m] = () => builder
    }
    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve({ data: rows, error: null, count: rows.length }).then(onFulfilled, onRejected)
    return builder
  }
  return {
    supabase: {
      from: (table: string) => makeBuilder(TABLE_ROWS[table] ?? []),
    },
  }
})

afterEach(cleanup)

describe('PeopleSubsTab unattributed panel', () => {
  it('groups sheets, shows the warning header, and offers Open/Assign/suggestion actions', async () => {
    renderWithProviders(<PeopleSubsTab />)

    // Header + subline (2 sheets total, deduped into one group row).
    expect(await screen.findByText(/aren't linked to anyone on the roster/)).toBeTruthy()
    expect(screen.getByText(/missing from every sub's Balance due column/)).toBeTruthy()

    // Group row: job chip, dedupe count, assigned name as plain words, reason badge, summed balance.
    expect(screen.getByText('#892')).toBeTruthy()
    expect(screen.getByText('582 Curvatura')).toBeTruthy()
    expect(screen.getByText(/· 2 sheets/)).toBeTruthy()
    expect(screen.getByText('J Ramos')).toBeTruthy()
    expect(screen.getByText('No roster match')).toBeTruthy()
    expect(screen.getByText('$2,480 open')).toBeTruthy()

    // Actions: deep-link, roster picker, and the one-tap suggestion
    // ("J Ramos" → first-initial + last-name → exactly Jesse Ramos).
    expect(screen.getByRole('button', { name: 'Open →' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Assign…' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Link to Jesse Ramos/ })).toBeTruthy()

    // The old bottom text blob is gone.
    expect(screen.queryByText(/fix names or assignments/)).toBeNull()
  })

  it("opens a sub's documents in a row under theirs, not below the whole table", async () => {
    renderWithProviders(<PeopleSubsTab />)
    fireEvent.click(await screen.findByRole('button', { name: /Documents \(0\)/ }))
    const heading = screen.getByText(/Documents — Jesse Ramos/)
    expect(heading.closest('table')).toBeTruthy()
    expect(heading.closest('tr')?.previousElementSibling?.textContent).toContain('Jesse Ramos')
  })
})

describe('PeopleSubsTab: a sheet with several names (v2.7169)', () => {
  it('puts a sheet with a sub and a teammate on the sub’s Balance due, and says crew sheets pay through payroll', async () => {
    const saved = { ...TABLE_ROWS }
    Object.assign(TABLE_ROWS, {
      people: [
        { id: 'p-core', name: 'Ridgeline Coring LLC', kind: 'sub', archived_at: null, account_user_id: null },
        { id: 'p-helper', name: 'Dana Whitlock', kind: 'sub', archived_at: null, account_user_id: 'u-helper' },
        { id: 'p-plumber', name: 'Owen Farris', kind: 'master_technician', archived_at: null, account_user_id: 'u-plumber' },
      ],
      users: [
        { id: 'u-helper', name: 'Dana Whitlock', email: 'dana@example.com', role: 'superintendent' },
        { id: 'u-plumber', name: 'Owen Farris', email: 'owen@example.com', role: 'master_technician' },
      ],
      people_labor_jobs: [
        { id: 'mixed', assigned_to_name: 'Owen Farris | Dana Whitlock | Ridgeline Coring LLC', address: '12 Quarry Rd', job_number: '901', labor_rate: 0 },
        { id: 'crew', assigned_to_name: 'Owen Farris', address: '40 Mill St', job_number: '902', labor_rate: 0 },
      ],
      people_labor_job_assignees: [
        { labor_job_id: 'mixed', person_id: 'p-plumber' },
        { labor_job_id: 'mixed', person_id: 'p-helper' },
        { labor_job_id: 'mixed', person_id: 'p-core' },
        { labor_job_id: 'crew', person_id: 'p-plumber' },
      ],
      people_labor_job_items: [
        { job_id: 'mixed', fixture: 'Cutting', count: 1, hrs_per_unit: 0, is_fixed: true, direct_labor_amount: 2150 },
        { job_id: 'crew', fixture: 'Rough In', count: 1, hrs_per_unit: 0, is_fixed: true, direct_labor_amount: 4000 },
      ],
    })
    try {
      renderWithProviders(<PeopleSubsTab />)
      const subRow = (await screen.findByText('Ridgeline Coring LLC')).closest('tr')
      expect(subRow?.textContent).toContain('$2,150.00')
      expect(subRow?.textContent).toContain('1 sheet')
      // Nothing to fix: no band, no Multiple subs chip, no Assign press.
      expect(screen.queryByText(/linked to anyone on the roster/)).toBeNull()
      expect(screen.queryByText('Multiple subs')).toBeNull()
      expect(screen.queryByRole('button', { name: 'Assign…' })).toBeNull()
      // The teammate keeps a row on the roster and is owed nothing on the sub's sheet.
      expect(screen.getByText('Dana Whitlock').closest('tr')?.textContent).toContain('0 sheets')
      expect(screen.getByTestId('subs-crew-pay-line').textContent).toContain('1 crew sheet has teammates on it and no sub. Crew sheets pay through payroll')
    } finally {
      for (const k of Object.keys(TABLE_ROWS)) delete TABLE_ROWS[k]
      Object.assign(TABLE_ROWS, saved)
    }
  })
})

describe('PeopleSubsTab with nobody on the roster', () => {
  it('offers + Hire, the Hire window opened on Subcontractor (punch list #184, sweep C)', async () => {
    const saved = { people: TABLE_ROWS.people, people_labor_jobs: TABLE_ROWS.people_labor_jobs, people_labor_job_items: TABLE_ROWS.people_labor_job_items }
    Object.assign(TABLE_ROWS, { people: [], people_labor_jobs: [], people_labor_job_items: [] })
    try {
      const onOpenHire = vi.fn()
      renderWithProviders(<PeopleSubsTab onOpenHire={onOpenHire} />)
      fireEvent.click(await screen.findByRole('button', { name: '+ Hire' }))
      expect(onOpenHire).toHaveBeenCalledTimes(1)
      expect(document.querySelector('[data-empty-state]')?.textContent).toBe('No subs yet. + Hire adds the first.')
    } finally {
      Object.assign(TABLE_ROWS, saved)
    }
  })
})
