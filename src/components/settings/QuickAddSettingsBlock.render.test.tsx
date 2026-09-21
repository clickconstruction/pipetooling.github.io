// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
const saved: unknown[] = []
vi.mock('../../lib/clock/quickAddSettings', () => ({
  fetchQuickAddSettings: async () => ({ roles: ['assistant', 'primary'], ceilingMinutes: 90 }),
  saveQuickAddSettings: async (next: unknown) => { saved.push(next) },
}))

import QuickAddSettingsBlock from './QuickAddSettingsBlock'

describe('QuickAddSettingsBlock', () => {
  it('shows the saved roles ticked and the saved ceiling, and saves what is ticked', async () => {
    renderWithProviders(<QuickAddSettingsBlock />)
    await waitFor(() => expect((screen.getByLabelText('Primary') as HTMLInputElement).checked).toBe(true))
    expect((screen.getByLabelText('Assistant') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('Controller') as HTMLInputElement).checked).toBe(false)
    expect((screen.getByLabelText(/Most minutes of quick adds/) as HTMLInputElement).value).toBe('90')
    screen.getByLabelText('Controller').click()
    screen.getByRole('button', { name: 'Save' }).click()
    await waitFor(() => expect(saved).toHaveLength(1))
    expect(saved[0]).toEqual({ roles: ['assistant', 'primary', 'controller'], ceilingMinutes: 90 })
  })
})
