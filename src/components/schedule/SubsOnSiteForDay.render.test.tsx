// @vitest-environment jsdom
/**
 * Render smoke for the Day tab's Subs on site box (v2.2929): a picked order
 * lists as a sub with the site-visit door; nothing on an empty day.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/subs/subDispatchFetch', () => ({
  fetchSubOrdersForRange: vi.fn(async (start: string) =>
    start === '2026-09-09'
      ? {
          data: [
            { id: 'c1', personId: 'p1', personName: 'Behar Kraja', jobId: 'j-1004', jobLabel: '#1004 · 2210 Goforth Rd', status: 'accepted', pickedStart: '2026-09-09', pickedEnd: '2026-09-10', proposedStart: null, proposedEnd: null, windowStart: null, windowEnd: null, stageName: 'Rough-in', recordId: null },
          ],
          error: null,
        }
      : { data: [], error: null },
  ),
}))

import { SubsOnSiteForDay } from './SubsOnSiteForDay'
import { renderWithProviders } from '../../test/renderSmokeMocks'

describe('SubsOnSiteForDay', () => {
  it('lists the sub on site with the site-visit door', async () => {
    renderWithProviders(<SubsOnSiteForDay dayKey="2026-09-09" />)
    await waitFor(() => expect(screen.getByTestId('subs-on-site')).toBeTruthy())
    expect(screen.getByText('Behar Kraja')).toBeTruthy()
    expect(screen.getByText('Add a site visit ›')).toBeTruthy()
  })

  it('renders nothing on an empty day', async () => {
    const { container } = renderWithProviders(<SubsOnSiteForDay dayKey="2026-09-21" />)
    await new Promise((r) => setTimeout(r, 20))
    expect(container.querySelector('[data-testid="subs-on-site"]')).toBeNull()
  })
})
