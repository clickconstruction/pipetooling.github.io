// @vitest-environment jsdom
/**
 * Render-smoke tests for AssistantReadyToBillBanner (v2.2276) — the
 * assistants' one-line ready-to-bill bar under the header on every page.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../test/renderSmokeMocks'
import AssistantReadyToBillBanner from './AssistantReadyToBillBanner'

let mockRole: string | null = 'assistant'
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' }, role: mockRole }),
}))

let mockCount = 3
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ count: mockCount, error: null }),
      }),
    }),
  },
}))

describe('AssistantReadyToBillBanner render smoke', () => {
  it('shows the orange bar with count-first verb copy for assistants', async () => {
    mockRole = 'assistant'
    mockCount = 3
    renderWithProviders(<AssistantReadyToBillBanner />)
    await waitFor(() => expect(screen.getByText('3')).toBeTruthy())
    expect(screen.getByText(/ready to bill — send them/)).toBeTruthy()
    expect(screen.getByTitle('Open Jobs at the Ready to Bill section')).toBeTruthy()
  })

  it('flips to singular copy at one', async () => {
    mockRole = 'assistant'
    mockCount = 1
    renderWithProviders(<AssistantReadyToBillBanner />)
    await waitFor(() => expect(screen.getByText(/ready to bill — send it/)).toBeTruthy())
  })

  it('renders nothing at zero and nothing for non-assistant roles', async () => {
    mockRole = 'assistant'
    mockCount = 0
    const { container, unmount } = renderWithProviders(<AssistantReadyToBillBanner />)
    await waitFor(() => expect(container.textContent).toBe(''))
    unmount()

    mockRole = 'dev'
    mockCount = 5
    const { container: c2 } = renderWithProviders(<AssistantReadyToBillBanner />)
    expect(c2.textContent).toBe('')
  })
})
