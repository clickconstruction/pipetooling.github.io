// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { SettingsWhatEveryoneSeesTab } from './SettingsWhatEveryoneSeesTab'

describe('What everyone sees → Theme draft', () => {
  it('counts the change, turns the draft on, flips back on Current, resets, and writes the patch', async () => {
    localStorage.clear()
    renderWithProviders(<SettingsWhatEveryoneSeesTab />)
    fireEvent.click(screen.getByRole('button', { name: 'Theme draft' }))
    const surface = await screen.findByLabelText('--surface value')
    fireEvent.change(surface, { target: { value: '#fbf7ee' } })
    expect(screen.getByText('1 token changed.')).toBeTruthy()
    expect(screen.getByText(/--surface: #fbf7ee; \/\* was #ffffff \*\//)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Theme draft is on' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Current' }))
    expect(screen.getByRole('button', { name: 'Theme draft' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Draft' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    expect(screen.getByText('No change yet. Pick a token to start a draft.')).toBeTruthy()
  })

  it('shows the contrast of the pairs that must stay readable, as you type', async () => {
    localStorage.clear()
    renderWithProviders(<SettingsWhatEveryoneSeesTab />)
    fireEvent.click(screen.getByRole('button', { name: 'Theme draft' }))
    const muted = await screen.findByLabelText('--text-muted value')
    fireEvent.change(muted, { target: { value: '#d1d5db' } })
    expect(screen.getAllByText(/:1 · under 4.5/).length).toBeGreaterThan(0)
  })
})
