// @vitest-environment jsdom
/**
 * Render smoke for the Job Mode Inbox "My requests" strip (journey-map
 * Tier-2 #25 / J2-F4). Before it, the tab mounted the Settings push-log
 * component and told a day-one tech "No push notifications have been logged".
 * What matters: the strip mounts, the empty state points at the red icons,
 * and an answered row shows the office note as "Office answered: …".
 */
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'

import JobModeMyRequests from './JobModeMyRequests'
import { renderWithProviders } from '../../test/renderSmokeMocks'

// Mutable result so one stub serves the empty and the populated case.
let rows: unknown[] = []

vi.mock('../../lib/supabase', () => {
  function builder(): Record<string, unknown> {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order', 'limit']) b[m] = () => b
    b.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected)
    return b
  }
  return { supabase: { from: () => builder() } }
})

vi.mock('../../hooks/useRealtimeChannel', () => ({ useRealtimeChannel: () => {} }))

describe('JobModeMyRequests', () => {
  it('renders the empty state that points at the red phone / photos icons', async () => {
    rows = []
    renderWithProviders(<JobModeMyRequests userId="tech-1" />)
    expect(screen.getByRole('heading', { name: 'My requests' })).toBeTruthy()
    await waitFor(() => expect(screen.getByText(/red phone or photos icon/)).toBeTruthy())
    expect(screen.queryByText(/push notifications/i)).toBeNull()
  })

  it('shows an open row as waiting and an answered row with the office note', async () => {
    rows = [
      {
        id: 'o1',
        title: 'Add a customer phone number for HCP 846 - Uhl',
        status: 'open',
        created_at: new Date().toISOString(),
        closed_at: null,
        closed_note: null,
        closed_by: null,
        pending_action: 'add_job_phone',
      },
      {
        id: 'c1',
        title: 'Add a Customer Pictures folder for HCP 812',
        status: 'closed',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        closed_at: new Date().toISOString(),
        closed_note: 'Folder linked — refresh the card',
        closed_by: { name: 'Maria' },
        pending_action: 'link_job_pictures',
      },
    ]
    renderWithProviders(<JobModeMyRequests userId="tech-1" />)
    await waitFor(() => expect(screen.getByText(/Waiting on Dispatch · today/)).toBeTruthy())
    expect(screen.getByText(/Office answered \(Maria\)/)).toBeTruthy()
    expect(screen.getByText(/Folder linked — refresh the card/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Waiting on Dispatch · 1/ })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Answered' })).toBeTruthy()
  })
})
