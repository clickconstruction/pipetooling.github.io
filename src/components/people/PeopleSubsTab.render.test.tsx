// @vitest-environment jsdom
/**
 * Render smoke for PeopleSubsTab's "Unattributed sheets" panel: canned rows for
 * the tables the tab loads produce two unmatched sheets on the same job with
 * the same raw name, and we assert the panel groups them into one row with the
 * job chip, raw-name echo, reason badge, summed balance, and all three actions
 * (Open → / Assign… / the conservative ✨ one-tap suggestion).
 */
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import PeopleSubsTab from './PeopleSubsTab'
import { renderWithProviders } from '../../test/renderSmokeMocks'

// The sub portal globe (sub-portal train) reads the office role via useAuth.
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

const TABLE_ROWS: Record<string, unknown[]> = {
  people: [{ id: 'p-jesse', name: 'Jesse Ramos', archived_at: null, account_user_id: null }],
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
    for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'order', 'range', 'limit']) {
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

describe('PeopleSubsTab unattributed panel', () => {
  it('groups sheets, shows the warning header, and offers Open/Assign/suggestion actions', async () => {
    renderWithProviders(<PeopleSubsTab />)

    // Header + subline (2 sheets total, deduped into one group row).
    expect(await screen.findByText(/aren't linked to anyone on the roster/)).toBeTruthy()
    expect(screen.getByText(/missing from every sub's Owed column/)).toBeTruthy()

    // Group row: job chip, dedupe count, raw name in quotes, reason badge, summed balance.
    expect(screen.getByText('#892')).toBeTruthy()
    expect(screen.getByText('582 Curvatura')).toBeTruthy()
    expect(screen.getByText(/· 2 sheets/)).toBeTruthy()
    expect(screen.getByText('"J Ramos"')).toBeTruthy()
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
})
