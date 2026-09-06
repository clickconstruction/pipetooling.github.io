// @vitest-environment jsdom
/**
 * Render smoke for Jobs → Subs (v2.2927): the Work / Pay control shows both
 * views, hides for Pay-only roles, and the param helper lands where expected.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { JobsSubsTab, subsViewFromParam } from './JobsSubsTab'
import { renderWithProviders } from '../../test/renderSmokeMocks'

describe('JobsSubsTab', () => {
  it('switches between Work and Pay', () => {
    const onViewChange = vi.fn()
    renderWithProviders(<JobsSubsTab view="work" onViewChange={onViewChange} canSeeWork work={<div>WORK VIEW</div>} pay={<div>PAY VIEW</div>} />)
    expect(screen.getByText('WORK VIEW')).toBeTruthy()
    expect(screen.queryByText('PAY VIEW')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Pay' }))
    expect(onViewChange).toHaveBeenCalledWith('pay')
  })

  it('shows Pay only, with no control, when Work is hidden', () => {
    renderWithProviders(<JobsSubsTab view="work" onViewChange={() => {}} canSeeWork={false} work={<div>WORK VIEW</div>} pay={<div>PAY VIEW</div>} />)
    expect(screen.getByText('PAY VIEW')).toBeTruthy()
    expect(screen.queryByRole('tablist')).toBeNull()
  })

  it('reads the view param', () => {
    expect(subsViewFromParam('pay', true)).toBe('pay')
    expect(subsViewFromParam('work', true)).toBe('work')
    expect(subsViewFromParam(null, true)).toBe('work')
    expect(subsViewFromParam('nonsense', true)).toBe('work')
    expect(subsViewFromParam(null, false)).toBe('pay')
    expect(subsViewFromParam('work', false)).toBe('pay')
  })
})
