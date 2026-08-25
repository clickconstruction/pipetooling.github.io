// @vitest-environment jsdom
/**
 * Render-smoke tests for SettingsHcpReconcileSection (v2.2255) — the dev-only
 * HCP reconcile importer on Settings → Jobs & billing.
 */
import { describe, expect, it } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import SettingsHcpReconcileSection from './SettingsHcpReconcileSection'

describe('SettingsHcpReconcileSection render smoke', () => {
  it('renders collapsed, expands to the two lanes with file pickers', () => {
    renderWithProviders(<SettingsHcpReconcileSection />)
    const toggle = screen.getByRole('button', { name: /HCP reconcile/ })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText(/Choose invoices export/)).toBeNull()

    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText(/1 · Bill dates & links/)).toBeTruthy()
    expect(screen.getByText(/2 · True payment dates/)).toBeTruthy()
    expect(screen.getByText(/Choose invoices export/)).toBeTruthy()
    expect(screen.getByText(/Choose payments report/)).toBeTruthy()
    expect(screen.getByText(/Choose jobs export/)).toBeTruthy()
    // No plan yet → no Apply buttons and no premature "reconciled" state.
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull()
    expect(screen.queryByText(/Nothing to do/)).toBeNull()
  })
})
