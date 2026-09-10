// @vitest-environment jsdom
/**
 * Render smoke for the People → Hours "Match sessions" modal: opens as a
 * dialog, empty window renders the nothing-to-match state, Close fires, and a
 * closed unassigned session offers Reject (v2.3242 — Skip is gone) which asks
 * first and stamps rejected_at / rejected_by on confirm.
 * The suggestion/ranking logic lives in src/lib/matchClockSessions.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

/** Rows the stub hands back for `from('clock_sessions').select(...)`; empty by default. */
let clockSessionRows: unknown[] = []
const updates: { table: string; patch: Record<string, unknown> }[] = []

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const base = makeSupabaseStub()
  function builder(table: string, rows: () => unknown[]) {
    const b: Record<string, unknown> = {}
    const result = () =>
      Promise.resolve({ data: rows(), error: null, count: rows().length })
    for (const m of [
      'select',
      'eq',
      'neq',
      'gte',
      'lte',
      'is',
      'in',
      'or',
      'order',
      'limit',
      'not',
    ])
      b[m] = () => b
    b.update = (patch: Record<string, unknown>) => {
      updates.push({ table, patch })
      return b
    }
    b.then = (onF?: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
      result().then(onF, onR)
    b.catch = (onR?: (e: unknown) => unknown) => result().catch(onR)
    b.finally = (onFin?: () => void) => result().finally(onFin)
    return b
  }
  return {
    supabase: {
      ...base,
      from: (table: string) =>
        builder(table, () =>
          table === 'clock_sessions' ? clockSessionRows : [],
        ),
    },
  }
})

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import {
  MatchClockSessionsModal,
  MatchClockSessionsInline,
} from './MatchClockSessionsModal'
import {
  renderWithProviders,
  SMOKE_AUTH_USER_ID,
} from '../../test/renderSmokeMocks'

beforeEach(() => {
  clockSessionRows = []
  updates.length = 0
})

const closedSession = {
  id: 'cs-1',
  user_id: 'u-bryan',
  work_date: '2026-09-05',
  clocked_in_at: '2026-09-05T19:30:00Z',
  clocked_out_at: '2026-09-06T04:59:00Z',
  notes: 'Test',
  job_ledger_id: null,
  bid_id: null,
  salary_segment_index: null,
  users: { name: 'Bryan' },
}

describe('MatchClockSessionsModal', () => {
  it('renders nothing when closed', () => {
    renderWithProviders(
      <MatchClockSessionsModal open={false} onClose={() => {}} />,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens as a dialog and shows the empty state for an empty window; Close fires onClose', async () => {
    const onClose = vi.fn()
    renderWithProviders(<MatchClockSessionsModal open onClose={onClose} />)
    expect(
      screen.getByRole('dialog', { name: 'Match sessions to jobs' }),
    ).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByText(/Nothing to match/)).toBeTruthy()
    })
    fireEvent.click(screen.getByText('Close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('MatchClockSessionsInline', () => {
  it('renders nothing at all when the window has no sessions to match', async () => {
    const { container } = renderWithProviders(<MatchClockSessionsInline />)
    await waitFor(() => {
      expect(container.textContent).toBe('')
    })
    expect(screen.queryByText('Match sessions to jobs')).toBeNull()
  })

  it('a closed unassigned session offers Reject (no Skip); confirming writes the rejection stamp and hides the card', async () => {
    clockSessionRows = [closedSession]
    renderWithProviders(<MatchClockSessionsInline />)
    const rejectBtn = await screen.findByRole('button', { name: 'Reject' })
    expect(screen.queryByText('Skip')).toBeNull()
    expect(screen.getByText(/"Test"/)).toBeTruthy()

    fireEvent.click(rejectBtn)
    await screen.findByText(/never reaches payroll/)
    expect(screen.getByText(/Reject Bryan/)).toBeTruthy()
    const rejectButtons = screen.getAllByRole('button', { name: 'Reject' })
    fireEvent.click(rejectButtons[rejectButtons.length - 1]!)

    await waitFor(() => {
      expect(updates).toHaveLength(1)
    })
    expect(updates[0]?.table).toBe('clock_sessions')
    expect(updates[0]?.patch.rejected_by).toBe(SMOKE_AUTH_USER_ID)
    expect(typeof updates[0]?.patch.rejected_at).toBe('string')
    await waitFor(() => {
      expect(
        screen.getByText('Every session here is matched or rejected.'),
      ).toBeTruthy()
    })
  })

  it('a still-open session shows no Reject button', async () => {
    clockSessionRows = [{ ...closedSession, id: 'cs-2', clocked_out_at: null }]
    renderWithProviders(<MatchClockSessionsInline />)
    await screen.findByText(/still clocked in/)
    expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull()
  })
})
