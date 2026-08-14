// @vitest-environment jsdom
/**
 * Render smoke for the People → Hours "Match sessions" modal: opens as a
 * dialog, empty window renders the nothing-to-match state, and Close fires.
 * The suggestion/ranking logic lives in src/lib/matchClockSessions.test.ts.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { MatchClockSessionsModal, MatchClockSessionsInline } from './MatchClockSessionsModal'
import { renderWithProviders } from '../../test/renderSmokeMocks'

describe('MatchClockSessionsModal', () => {
  it('renders nothing when closed', () => {
    renderWithProviders(<MatchClockSessionsModal open={false} onClose={() => {}} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens as a dialog and shows the empty state for an empty window; Close fires onClose', async () => {
    const onClose = vi.fn()
    renderWithProviders(<MatchClockSessionsModal open onClose={onClose} />)
    expect(screen.getByRole('dialog', { name: 'Match sessions to jobs' })).toBeTruthy()
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
})
