// @vitest-environment jsdom
/**
 * Render-smoke tests for PersonalTimeOffModal (v2.1544) — the Personal Time
 * Off section relocated from Settings → Your account into a modal opened from
 * the Dashboard My Time section and the Calendar's time-off chips.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { PersonalTimeOffModal } from './PersonalTimeOffModal'
import { renderWithProviders } from '../test/renderSmokeMocks'

describe('PersonalTimeOffModal', () => {
  it('renders the dialog with the TimeOffSettings content inside', async () => {
    renderWithProviders(<PersonalTimeOffModal open userId="u-1" onClose={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Personal Time Off' })).toBeTruthy()
    await waitFor(() => expect(screen.getByText('Not coming in today')).toBeTruthy())
    expect(screen.getByText('Add Personal Time Off')).toBeTruthy()
  })

  it('closed renders nothing; ✕ calls onClose', async () => {
    const onClose = vi.fn()
    const { rerender } = renderWithProviders(
      <PersonalTimeOffModal open={false} userId="u-1" onClose={onClose} />,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    rerender(<PersonalTimeOffModal open userId="u-1" onClose={onClose} />)
    await waitFor(() => expect(screen.getByLabelText('Close Personal Time Off')).toBeTruthy())
    screen.getByLabelText('Close Personal Time Off').click()
    expect(onClose).toHaveBeenCalled()
  })
})
