// @vitest-environment jsdom
/**
 * Render smokes for BidBestEffortCard (v2.3234) — the Cover Letter step between
 * the letter's amount and Mark sent: record the number you would send right
 * now, and the robot's envelope opens against it.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BidBestEffortCard } from './BidBestEffortCard'

const state: { record: Record<string, unknown> | null; runStatus: string | null; missingTable: boolean; inserted: Record<string, unknown>[] } = {
  record: null,
  runStatus: 'locked',
  missingTable: false,
  inserted: [],
}

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'wendi', email: 'wendi@x.test' }, profileName: 'Wendi', role: 'estimator' }),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'bid_best_efforts') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve(
                  state.missingTable
                    ? { data: null, error: { message: "Could not find the table 'public.bid_best_efforts' in the schema cache" } }
                    : { data: state.record, error: null },
                ),
            }),
          }),
          insert: (row: Record<string, unknown>) => {
            state.inserted.push(row)
            state.record = { bid_id: row.bid_id, value: row.value, recorded_at: row.recorded_at, recorded_by: row.recorded_by }
            return Promise.resolve({ data: null, error: null })
          },
        }
      }
      if (table === 'users') return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { name: 'Wendi' }, error: null }) }) }) }
      // bids (the review stamp) and bids_submission_entries (the ledger line)
      return {
        update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
        insert: () => Promise.resolve({ data: null, error: null }),
      }
    },
    rpc: () =>
      Promise.resolve({
        data: state.runStatus
          ? [{ id: 'r1', status: state.runStatus, reference_bid_number: '431', shadow_bid_number: '482', locked_at: '2026-09-07T12:00:00Z' }]
          : [],
        error: null,
      }),
  },
}))

const bid = { id: 'h431', bid_number: '431', project_name: 'PALMER WINERY', bid_date_sent: null, bid_value: null, robot_opt_out: false, reviewed_at: null }

describe('BidBestEffortCard', () => {
  it('records the letter amount, names the sealed robot, then shows the stamp and the envelope door once scored', async () => {
    state.record = null
    state.runStatus = 'locked'
    state.inserted = []
    const onRecorded = vi.fn()
    const onOpenEnvelope = vi.fn()
    renderWithProviders(<BidBestEffortCard bid={bid} amount={148200} onRecorded={onRecorded} onOpenEnvelope={onOpenEnvelope} />)
    await waitFor(() => expect(screen.getByTestId('best-effort-card')).toBeTruthy())
    expect(screen.getByText(/as the number you would send right now/)).toBeTruthy()
    expect(screen.getByText('$148,200')).toBeTruthy()
    expect(screen.getByText(/The robot sealed its number on 09\/07/)).toBeTruthy()

    // The record: one insert with the amount and the recorder; the page is told.
    state.runStatus = 'scored'
    fireEvent.click(screen.getByRole('button', { name: "Record best effort · open the robot's envelope" }))
    await waitFor(() => expect(onRecorded).toHaveBeenCalledWith('h431'))
    expect(state.inserted[0]).toMatchObject({ bid_id: 'h431', value: 148200, recorded_by: 'wendi' })

    // Recorded: the stamp and the envelope door (the run scored against it).
    await waitFor(() => expect(screen.getByText(/best effort 9\/10 · Wendi/)).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: "Open the robot's envelope" }))
    expect(onOpenEnvelope).toHaveBeenCalledWith('h431')
  })

  it('hides on a sent bid without a record and when the table is not deployed yet', async () => {
    state.record = null
    state.runStatus = null
    state.missingTable = false
    const { unmount } = renderWithProviders(<BidBestEffortCard bid={{ ...bid, bid_date_sent: '2026-09-10', bid_value: 100 }} amount={100} onRecorded={vi.fn()} onOpenEnvelope={vi.fn()} />)
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByTestId('best-effort-card')).toBeNull()
    unmount()

    state.missingTable = true
    renderWithProviders(<BidBestEffortCard bid={bid} amount={100} onRecorded={vi.fn()} onOpenEnvelope={vi.fn()} />)
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByTestId('best-effort-card')).toBeNull()
    state.missingTable = false
  })
})
