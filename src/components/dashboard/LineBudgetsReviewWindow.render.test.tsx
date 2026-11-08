// @vitest-environment jsdom
/**
 * The owner's weekly review window (punch list #234 PR 1c): the rows with their job, price and
 * split, Looks right stamping them through the io and saying what it stamped, Tune opening the
 * first project's job window, a refused stamp staying on the rows with its reason.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import { LineBudgetsReviewWindow } from './LineBudgetsReviewWindow'
import type { LineBudgetsReview } from '../../lib/needsYou/lineBudgetsReview'
import type { LineBudgetsReviewIo } from '../../lib/needsYou/lineBudgetsReviewIo'

const navigate = vi.fn()
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const review: LineBudgetsReview = {
  lines: [
    { fixtureId: 'b', jobId: '1042', jobLabel: '#1042 Lakeside duplex', name: 'Water heater, 50 gal, added', priceUsd: 4_000, laborPct: 45, materialsPct: 35 },
    { fixtureId: 'c', jobId: '1050', jobLabel: '#1050 Harbor Lane', name: 'Mobilizations', priceUsd: 3_200, laborPct: 45, materialsPct: 35 },
  ],
  jobIds: ['1042', '1050'],
  assumedUsd: 7_200,
  totalUsd: 168_000,
  settledLines: 9,
}

function harness(stampError?: Error) {
  const stamped: string[][] = []
  const io: LineBudgetsReviewIo = {
    fetchSources: async () => ({ jobs: [], fixtures: [] }),
    stamp: async (ids) => {
      if (stampError) throw stampError
      stamped.push(ids)
      return ids.length
    },
  }
  const onClose = vi.fn()
  const onChanged = vi.fn()
  const r = renderWithProviders(<LineBudgetsReviewWindow review={review} onClose={onClose} onChanged={onChanged} io={io} />)
  return { stamped, onClose, onChanged, rerender: r.rerender }
}

installDomShims()
afterEach(() => {
  cleanup()
  navigate.mockClear()
})

describe('LineBudgetsReviewWindow', () => {
  it('lists the lines and stamps them all on Looks right, saying what it stamped', async () => {
    const h = harness()
    expect(screen.getAllByTestId('line-budgets-review-row').map((r) => r.textContent)).toEqual(['#1042 Lakeside duplex · Water heater, 50 gal, added · $4,000 · ≈ 45 / 35', '#1050 Harbor Lane · Mobilizations · $3,200 · ≈ 45 / 35'])
    expect(screen.getByText('The other 9 lines on these 2 projects came from the workbench, were tuned, or were stamped, and need nothing.')).toBeTruthy()
    expect(screen.getByTestId('line-budgets-looks-right').textContent).toBe('Looks right · stamp 2 lines')
    fireEvent.click(screen.getByTestId('line-budgets-looks-right'))
    await waitFor(() => expect(h.stamped).toEqual([['b', 'c']]))
    await waitFor(() => expect(screen.getByText('2 lines stamped reviewed with your name. Each still reads the company split.')).toBeTruthy())
    expect(h.onChanged).toHaveBeenCalled()
    expect(screen.queryByTestId('line-budgets-looks-right')).toBeNull()
  })

  it("keeps the review it opened on when the line re-reads after the stamp (the first walk's slip 1: 'The other 1 line on these 0 projects')", async () => {
    const h = harness()
    fireEvent.click(screen.getByTestId('line-budgets-looks-right'))
    await waitFor(() => expect(h.stamped).toEqual([['b', 'c']]))
    // The stamp makes the Needs you line re-read; the re-read has no assumed line left and the two now-stamped lines settled.
    const after: LineBudgetsReview = { lines: [], jobIds: [], assumedUsd: 0, totalUsd: 168_000, settledLines: 11 }
    h.rerender(<LineBudgetsReviewWindow review={after} onClose={h.onClose} onChanged={h.onChanged} />)
    expect(screen.getByText('2 lines stamped reviewed with your name. Each still reads the company split.')).toBeTruthy()
    expect(screen.getByText('The other 9 lines on these 2 projects came from the workbench, were tuned, or were stamped, and need nothing.')).toBeTruthy()
    expect(screen.queryByText(/these 0 projects/)).toBeNull()
  })

  it('Tune closes and opens the first project; a refused stamp stays on the rows with its reason', async () => {
    const h = harness(new Error('Only the owner reviews the line budgets'))
    fireEvent.click(screen.getByTestId('line-budgets-looks-right'))
    await waitFor(() => expect(screen.getByText(/Only the owner reviews the line budgets/)).toBeTruthy())
    expect(screen.getAllByTestId('line-budgets-review-row')).toHaveLength(2)
    fireEvent.click(screen.getByTestId('line-budgets-tune'))
    expect(h.onClose).toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith('/jobs?tab=stages&edit=1042')
  })
})
