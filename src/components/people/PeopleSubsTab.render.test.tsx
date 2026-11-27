// @vitest-environment jsdom
/**
 * Render smoke for PeopleSubsTab's "Unattributed sheets" panel: canned rows for
 * the tables the tab loads produce two unmatched sheets on the same job with
 * the same raw name, and we assert the panel groups them into one row with the
 * job chip, raw-name echo, reason badge, summed balance, and all three actions
 * (Open → / Whose is it… / the conservative ✨ one-tap suggestion).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import PeopleSubsTab from './PeopleSubsTab'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { WE_OWE_NOTHING } from '../../lib/subWorkOrders/subPaymentsLedger'

// The sub portal globe (sub-portal train) reads the office role via useAuth, and so do the papers' presses (#350).
// A dev is signed in, unless a test signs a superintendent in.
const who = vi.hoisted(() => ({ superintendent: false }))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  const office = useAuthModuleMock()
  const superintendent = useAuthModuleMock({ role: 'superintendent' })
  const signedIn = () => (who.superintendent ? superintendent : office)
  return { ...office, useAuth: () => signedIn().useAuth(), useOptionalAuth: () => signedIn().useOptionalAuth() }
})

const TABLE_ROWS: Record<string, unknown[]> = {
  people: [{ id: 'p-jesse', name: 'Jesse Ramos', kind: 'sub', archived_at: null, account_user_id: null }],
  users: [],
  people_labor_jobs: [
    { id: 's1', assigned_to_name: 'J Ramos', address: '999 Calder', job_number: '892', labor_rate: 0 },
    { id: 's2', assigned_to_name: 'J Ramos', address: '999 Calder', job_number: '892', labor_rate: 0 },
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
    for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'is', 'in', 'or', 'order', 'range', 'limit']) {
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
  it('groups sheets, counts them once in the band head, and offers Open, Whose is it… and the suggestion', async () => {
    renderWithProviders(<PeopleSubsTab />)

    // Header + subline (2 sheets total, deduped into one group row).
    expect(await screen.findByText(/2 sheets need one sub/)).toBeTruthy()
    expect(screen.getByText(/Their money is counted once, here\. It is in no sub's Balance due until each sheet names one sub\./)).toBeTruthy()

    // Group row: job chip, dedupe count, assigned name as plain words, reason badge, summed balance.
    expect(screen.getByText('#892')).toBeTruthy()
    expect(screen.getByText('999 Calder')).toBeTruthy()
    expect(screen.getByText(/· 2 sheets/)).toBeTruthy()
    expect(screen.getByText('J Ramos')).toBeTruthy()
    expect(screen.getByText('No roster match')).toBeTruthy()
    expect(screen.getByText('$2,480 open')).toBeTruthy()

    // Actions: deep-link, roster picker, and the one-tap suggestion
    // ("J Ramos" → first-initial + last-name → exactly Jesse Ramos).
    expect(screen.getByRole('button', { name: 'Open →' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Whose is it…' })).toBeTruthy()
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
  it('puts a sheet with a sub and a teammate on the sub’s Balance due, and counts a teammate’s own sheet as owed to them', async () => {
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
      // Nothing to fix: no band, no Multiple subs chip, no Whose is it… press.
      expect(screen.queryByText(/need one sub|needs one sub/)).toBeNull()
      expect(screen.queryByText('Multiple subs')).toBeNull()
      expect(screen.queryByRole('button', { name: 'Whose is it…' })).toBeNull()
      // The teammate keeps a row on the roster and is owed nothing on the sub's sheet.
      expect(screen.getByText('Dana Whitlock').closest('tr')?.textContent).toContain('0 sheets')
      // Taunya's rule of 2026-11-15: one teammate and no sub is that teammate's, owed as sub labor.
      await waitFor(() => expect(screen.getByTestId('subs-crew-pay-line').textContent).toContain('1 sheet names a teammate and no sub. $4,000.00 is open on it, owed to the teammate as sub labor.'))
      // The tiles count it: what is owed for sub labor is the sub's sheet and the teammate's.
      expect(screen.getByTestId('subs-reach-tiles').textContent).toContain('$6,150.00')
      // Balance due opens into its sheets under the row, with the check that they add up to the column.
      fireEvent.click(within(subRow as HTMLElement).getByRole('button', { expanded: false }))
      expect((await screen.findByTestId('sub-owed-check')).textContent).toContain('✓ the figure in the column')
      expect(screen.getByTestId('sub-owed-block').textContent).toContain('with Owen Farris, Dana Whitlock')
      // The sub's sheet also names two teammates: the page offers to take them off, and the window names its count.
      expect(screen.getByTestId('subs-ride-along-line').textContent).toContain("1 sub's sheet also names a teammate. The teammate is not paid from it.")
      fireEvent.click(screen.getByRole('button', { name: 'Take the teammates off…' }))
      expect(screen.getAllByTestId('ride-along-row')).toHaveLength(1)
      expect(screen.getByRole('button', { name: 'Take teammates off 1 sheet' })).toBeTruthy()
      expect(screen.getByTestId('ride-along-effect').textContent).toContain('$2,150.00 is open on it before, and $2,150.00 after.')
      // The papers are the office's (#350): the block offers them to a dev, and to a superintendent it offers none.
      expect(within(screen.getByTestId('sub-owed-block')).getByRole('button', { name: 'Statement of account…' })).toBeTruthy()
      cleanup()
      who.superintendent = true
      renderWithProviders(<PeopleSubsTab />)
      const theirRow = (await screen.findByText('Ridgeline Coring LLC')).closest('tr')
      fireEvent.click(within(theirRow as HTMLElement).getByRole('button', { expanded: false }))
      const block = await screen.findByTestId('sub-owed-block')
      expect(within(block).queryByRole('button', { name: 'Statement of account…' })).toBeNull()
    } finally {
      who.superintendent = false
      for (const k of Object.keys(TABLE_ROWS)) delete TABLE_ROWS[k]
      Object.assign(TABLE_ROWS, saved)
    }
  })
})

describe('PeopleSubsTab: a sub we owe nothing (finding 314)', () => {
  it('reads settled on the Roster, the Ledger’s own word, and never paid up', async () => {
    const saved = { ...TABLE_ROWS }
    Object.assign(TABLE_ROWS, {
      people: [{ id: 'p-core', name: 'Ridgeline Coring LLC', kind: 'sub', archived_at: null, account_user_id: null }],
      people_labor_jobs: [{ id: 'done', assigned_to_name: 'Ridgeline Coring LLC', address: '12 Quarry Rd', job_number: '901', labor_rate: 0 }],
      people_labor_job_assignees: [{ labor_job_id: 'done', person_id: 'p-core' }],
      people_labor_job_items: [{ job_id: 'done', fixture: 'Cutting', count: 1, hrs_per_unit: 0, is_fixed: true, direct_labor_amount: 2150 }],
      people_labor_job_payments: [{ id: 'pay-1', job_id: 'done', amount: 2150, memo: null, created_at: '2026-11-02T15:00:00Z' }],
    })
    try {
      renderWithProviders(<PeopleSubsTab />)
      const press = await screen.findByTestId('subs-owed-press-p-core')
      expect(press.textContent).toBe(`${WE_OWE_NOTHING} ▸`)
      expect(WE_OWE_NOTHING).toBe('settled')
      expect(document.body.textContent).not.toContain('paid up')
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

describe('PeopleSubsTab: Roster | Ledger (v2.7231)', () => {
  it('opens on the roster, and Ledger shows what was paid to each sub with the roster left out', async () => {
    renderWithProviders(<PeopleSubsTab />)
    expect(await screen.findByText(/2 sheets need one sub/)).toBeTruthy()
    const group = screen.getByRole('group', { name: 'Subs view' })
    expect([...group.querySelectorAll('button')].map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([['Roster', 'true'], ['Ledger', 'false']])
    fireEvent.click(screen.getByRole('button', { name: 'Ledger' }))
    expect(document.querySelector('[data-people-subs-ledger]')).toBeTruthy()
    expect(screen.queryByText(/2 sheets need one sub/)).toBeNull()
    // The ledger opens on By sub here: this page is about people.
    expect((await screen.findByRole('button', { name: 'By sub' })).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Roster' }))
    expect(document.querySelector('[data-people-subs-ledger]')).toBeNull()
  })
})
