// @vitest-environment jsdom
/**
 * Render smokes for Quickfill → Unpriced fixtures (punch list #184 sweep B): the count of jobs
 * with a fixture nothing prices, the door to Jobs → Parts, and the oldest fixture's age chip.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { UnpricedFixtureRow } from '../../lib/quickfill/unpricedFixtures'

const load = vi.fn<() => Promise<UnpricedFixtureRow[]>>()
vi.mock('../../lib/quickfill/unpricedFixturesIo', () => ({ loadUnpricedFixtureRows: () => load() }))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})

import { UnpricedFixturesSection } from './UnpricedFixturesSection'

const row = (job_id: string, created_at: string | null): UnpricedFixtureRow => ({ job_id, part_id: null, fixture_cost: null, created_at })

describe('UnpricedFixturesSection', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-26T17:00:00Z'))
    load.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('counts the jobs and chips the oldest unpriced fixture: red past a week', async () => {
    load.mockResolvedValue([row('j1', '2026-10-15T15:00:00Z'), row('j1', '2026-10-24T15:00:00Z'), row('j2', '2026-10-25T15:00:00Z')])
    renderWithProviders(<UnpricedFixturesSection />)
    expect(await screen.findByText('2 jobs with unpriced fixtures')).toBeTruthy()
    const chip = document.querySelector('[data-unpriced-age]')!
    expect(chip.getAttribute('data-unpriced-age')).toBe('red')
    expect(chip.textContent).toBe('oldest 11 days waiting')
    expect(screen.getByRole('link', { name: 'Price fixtures in Jobs Parts' }).getAttribute('href')).toBe('/jobs?tab=parts')
  })

  it('a fixture from this week reads amber at three days', async () => {
    load.mockResolvedValue([row('j1', '2026-10-23T15:00:00Z')])
    renderWithProviders(<UnpricedFixturesSection />)
    expect(await screen.findByText('1 job with unpriced fixtures')).toBeTruthy()
    expect(document.querySelector('[data-unpriced-age]')!.textContent).toBe('oldest 3 days waiting')
    expect(document.querySelector('[data-unpriced-age]')!.getAttribute('data-unpriced-age')).toBe('amber')
  })

  it('draws nothing when nothing is unpriced, or when the read fails', async () => {
    load.mockResolvedValue([])
    const { container, unmount } = renderWithProviders(<UnpricedFixturesSection />)
    await vi.waitFor(() => expect(load).toHaveBeenCalled())
    await settle()
    expect(container.textContent).toBe('')
    unmount()
    load.mockRejectedValue(new Error('offline'))
    const second = renderWithProviders(<UnpricedFixturesSection />)
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2))
    await settle()
    expect(second.container.textContent).toBe('')
  })
})
