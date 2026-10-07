// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import UncollectibleListSettingsBlock from './UncollectibleListSettingsBlock'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

describe('UncollectibleListSettingsBlock (punch list #94, v2.4795)', () => {
  it('folds closed, opens on its heading and reads the empty case', async () => {
    renderWithProviders(<UncollectibleListSettingsBlock />)
    const head = screen.getByRole('button', { name: /Uncollectible: the accountant's list/ })
    expect(head.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(head)
    await settle()
    expect(screen.getByText('Nothing has been marked Uncollectible.')).toBeTruthy()
  })
})
