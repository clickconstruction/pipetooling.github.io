// @vitest-environment jsdom
/**
 * The customer's words strip (punch list #255, v2.6584): nothing while nothing waits; the newest unseen answer with the
 * first name, the stars, the words and the job; Got it writes the seen row and shows the next; a refused press names
 * its reason.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ rows: [] as unknown[], inserts: [] as Record<string, unknown>[], insertError: null as null | { message: string } }))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: () => Promise.resolve({ data: state.rows, error: null }),
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        state.inserts.push(row)
        return Promise.resolve({ error: state.insertError })
      },
    }),
  },
}))

import { DashboardCustomerWordsStrip } from './DashboardCustomerWordsStrip'

const row = (p: Record<string, unknown> = {}) => ({
  id: 'r-1',
  customer_name: 'Dana Whitfield',
  score: 5,
  words: 'Marcus explained everything before he started and cleaned up after.',
  answered_at: '2026-11-05T22:12:00Z',
  job_id: 'j-1',
  job_number: '1184',
  job_name: 'Water heater',
  job_address: '1208 Mesquite Ln',
  seen_at: null,
  ...p,
})

beforeEach(() => {
  state.rows = []
  state.inserts = []
  state.insertError = null
})
afterEach(cleanup)

describe('DashboardCustomerWordsStrip', () => {
  it('renders nothing while nothing waits, and nothing for a seen answer', async () => {
    state.rows = [row({ seen_at: '2026-11-05T23:00:00Z' })]
    const { container } = render(<DashboardCustomerWordsStrip userId="u-marcus" />)
    await new Promise((r) => setTimeout(r, 0))
    expect(container.querySelector('[data-testid="customer-words-strip"]')).toBeNull()
  })

  it('draws the newest unseen answer by first name, with the words, the job and a count of the rest', async () => {
    state.rows = [row(), row({ id: 'r-0', customer_name: 'Tom Reyes', score: 4, words: '', answered_at: '2026-11-03T15:00:00Z' })]
    render(<DashboardCustomerWordsStrip userId="u-marcus" />)
    expect(await screen.findByText('Dana gave you five stars')).toBeTruthy()
    expect(screen.getByText('“Marcus explained everything before he started and cleaned up after.”')).toBeTruthy()
    expect(screen.getByText(/Water heater at 1208 Mesquite Ln/)).toBeTruthy()
    expect(screen.getByText('and 1 more')).toBeTruthy()
    expect(screen.queryByText(/Whitfield/)).toBeNull()
  })

  it('Got it writes the seen row for this tech and shows the next answer', async () => {
    state.rows = [row(), row({ id: 'r-0', customer_name: 'Tom Reyes', score: 4, words: '', answered_at: '2026-11-03T15:00:00Z' })]
    render(<DashboardCustomerWordsStrip userId="u-marcus" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Got it' }))
    await waitFor(() => expect(screen.getByText('Tom gave you four stars')).toBeTruthy())
    expect(state.inserts).toEqual([{ rating_id: 'r-1', user_id: 'u-marcus' }])
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    await waitFor(() => expect(screen.queryByTestId('customer-words-strip')).toBeNull())
  })

  it('a refused press names its reason and keeps the strip', async () => {
    state.rows = [row()]
    state.insertError = { message: 'Training mode: writes are blocked.' }
    render(<DashboardCustomerWordsStrip userId="u-marcus" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Got it' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Training mode: writes are blocked.')
    expect(screen.getByText('Dana gave you five stars')).toBeTruthy()
  })
})
