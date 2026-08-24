// @vitest-environment jsdom
/**
 * Render smoke for PeopleHrTab: canned roster + files + entries produce the
 * dev-only banner, a grouped roster with entry counts, and — after selecting a
 * person — the summary doc with its coverage meta line, the stale banner when
 * raw entries outrun the summary, and the append-only Raw entries timeline
 * with the composer.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import PeopleHrTab from './PeopleHrTab'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const TABLE_ROWS: Record<string, unknown[]> = {
  people: [
    { id: 'p-marcus', name: 'Marcus Reed', kind: 'helper', archived_at: null, start_date: '2025-03-11' },
    { id: 'p-danny', name: 'Danny Ortiz', kind: 'helper', archived_at: null, start_date: null },
  ],
  person_files: [
    // Summary older than one of Marcus's entries → stale banner + partial coverage.
    { person_id: 'p-marcus', kind: 'summary', content: 'Runs the rough-in crew.', updated_at: '2026-08-01T00:00:00.000Z' },
    { person_id: 'p-marcus', kind: 'narrative', content: 'Started as a helper.', updated_at: '2026-08-01T00:00:00.000Z' },
  ],
  person_file_entries: [
    { id: 'e1', person_id: 'p-marcus', entry_date: '2026-07-18', content: 'Sit-down about Master hours.', source: 'review', created_by: 'u-dev', created_at: '2026-07-18T12:00:00.000Z' },
    { id: 'e2', person_id: 'p-marcus', entry_date: '2026-08-19', content: 'Re-ran the vent stack on 6th St.', source: 'job_event', created_by: null, created_at: '2026-08-19T12:00:00.000Z' },
  ],
  users: [{ id: 'u-dev', name: 'Robert' }],
}

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

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

describe('PeopleHrTab', () => {
  it('shows the roster, the summary with coverage + stale banner, and the raw timeline', async () => {
    renderWithProviders(<PeopleHrTab />)

    // Dev-only banner + roster rows (Helper section from KIND_LABELS).
    expect(await screen.findByText(/Curated files are maintained by the agent/)).toBeTruthy()
    expect(screen.getByText('Helper')).toBeTruthy()
    const marcusRow = screen.getByText('Marcus Reed')
    expect(screen.getByText('Danny Ortiz')).toBeTruthy()

    // Select Marcus → header + summary doc with meta and stale banner
    // (entry e2 postdates the 2026-08-01 summary rewrite → 1 of 2 covered).
    fireEvent.click(marcusRow)
    expect(await screen.findByText('Runs the rough-in crew.')).toBeTruthy()
    expect(screen.getByText(/started Mar 11, 2025/)).toBeTruthy()
    expect(screen.getByText(/covers 1 of 2 entries/)).toBeTruthy()
    expect(screen.getByText(/1 newer entry since this was rewritten/)).toBeTruthy()

    // Raw entries view: both entries, source chips, author line, composer.
    fireEvent.click(screen.getByText(/Raw entries \(2\)/))
    expect(await screen.findByText('Re-ran the vent stack on 6th St.')).toBeTruthy()
    expect(screen.getByText('Sit-down about Master hours.')).toBeTruthy()
    // 'Job event' appears both as the entry's source chip and as a composer <option>.
    expect(screen.getAllByText('Job event').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(/Robert · logged/)).toBeTruthy()
    expect(screen.getByPlaceholderText(/facts and dates, no speculation/)).toBeTruthy()
    expect(screen.getByText('Add entry')).toBeTruthy()
  })
})
