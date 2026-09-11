// @vitest-environment jsdom
/**
 * Render smoke for the Job Summary discount fold (v2.3273): the headline's
 * share of revenue, the reason table from the rows, and the giver table from
 * the trail events (stubbed) with the actor's name.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'

vi.mock('../../lib/supabase', () => {
  const table = (rows: unknown[]) => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'order', 'limit']) b[m] = () => b
    b.then = (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: null })
    return b
  }
  return {
    supabase: {
      from: (name: string) =>
        name === 'job_activity_events'
          ? table([{ job_id: 'j1', actor_user_id: 'u-t', detail: { dollars: 3774.5 } }])
          : name === 'users'
            ? table([{ id: 'u-t', name: 'Taunya' }])
            : table([]),
    },
  }
})

import { JobSummaryDiscountFold } from './JobSummaryDiscountFold'

afterEach(() => cleanup())

describe('JobSummaryDiscountFold', () => {
  it('headline, reason table, and the giver table from the trail', async () => {
    renderWithProviders(
      <JobSummaryDiscountFold
        rows={[
          { job: { id: 'j1', fixtures: [{ name: 'Rough In', count: 1, line_unit_price: 15098 }, { name: 'Negotiated discount', count: 1, line_unit_price: -3774.5, line_kind: 'discount', discount_reason: 'Negotiated' }] }, revenueUsd: 33970.5, discountUsd: 3774.5 },
          { job: { id: 'j2', fixtures: [{ name: 'Trim', count: 1, line_unit_price: 700 }] }, revenueUsd: 700, discountUsd: 0 },
        ]}
      />,
    )
    const fold = screen.getByTestId('job-summary-discount-fold')
    expect(fold.textContent).toContain('$3,774.50 given away')
    expect(fold.textContent).toContain('10.9%')
    expect(fold.textContent).toContain('1 of 2 jobs')
    expect(screen.getByText('Negotiated')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('Taunya')).toBeTruthy())
  })
  it('renders nothing when no job in view carries a discount', () => {
    renderWithProviders(<JobSummaryDiscountFold rows={[{ job: { id: 'j2', fixtures: [] }, revenueUsd: 700, discountUsd: 0 }]} />)
    expect(screen.queryByTestId('job-summary-discount-fold')).toBeNull()
  })
})
