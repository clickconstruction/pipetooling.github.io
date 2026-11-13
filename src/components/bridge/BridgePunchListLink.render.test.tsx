// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgePunchListLink } from './BridgePunchListLink'
import type { UserRole } from '../../hooks/useAuth'

describe('BridgePunchListLink', () => {
  it.each<UserRole>(['dev', 'master_technician'])('is a link to the Punch list for %s', (role) => {
    renderWithProviders(<BridgePunchListLink role={role} />)
    // first paint
    const link = screen.getByRole('link', { name: 'Punch list' })
    expect(link.getAttribute('href')).toBe('/punch-list')
    expect(link.getAttribute('title')).toBe('Open the Punch list, the board of to-do cards')
  })

  it.each<UserRole | null>(['assistant', 'controller', 'estimator', 'superintendent', 'primary', 'helpers', 'subcontractor', null])(
    'draws nothing for %s, who cannot open the Punch list',
    (role) => {
      renderWithProviders(<BridgePunchListLink role={role} />)
      // first paint
      expect(screen.queryByTestId('bridge-punch-list')).toBeNull()
    },
  )
})
