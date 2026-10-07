// @vitest-environment jsdom
/**
 * Render smokes for the Pipeline search's customer chips (punch list #97, PR 3): a search that
 * names a customer offers their timeline, a press opens it, and a short search shows nothing.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'

const openCustomerProfile = vi.fn()
vi.mock('../../contexts/CustomerProfileModalContext', () => ({ useCustomerProfileModal: () => ({ openCustomerProfile, closeCustomerProfile: vi.fn(), isOpen: false }) }))

import StagesCustomerTimelineChips from './StagesCustomerTimelineChips'

const customers = [
  { id: 'c1', name: 'Ridgeway Builders', archived_at: null },
  { id: 'c2', name: 'Ridgeway', archived_at: null },
  { id: 'c3', name: 'Lee Park', archived_at: null },
]

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  openCustomerProfile.mockReset()
})

describe('StagesCustomerTimelineChips', () => {
  it('offers the timeline of each customer the search names, and opens it', () => {
    renderWithProviders(<StagesCustomerTimelineChips query="ridgeway" customers={customers} />)
    const chips = screen.getAllByRole('button')
    expect(chips.map((c) => c.textContent)).toEqual(['Ridgeway · timeline ›', 'Ridgeway Builders · timeline ›'])
    fireEvent.click(chips[1]!)
    expect(openCustomerProfile).toHaveBeenCalledWith('c1', { view: 'timeline' })
  })

  it('shows nothing for a search too short to name anyone', () => {
    renderWithProviders(<StagesCustomerTimelineChips query="ri" customers={customers} />)
    expect(screen.queryByRole('group', { name: 'Customer timelines' })).toBeNull()
  })
})
