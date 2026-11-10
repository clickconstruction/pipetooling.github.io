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
/** ZZ test jobs sitting in the stage beside the real ones (v2.6805): the board hides them, so the bar does. */
let mockZzRows: Array<{ id: string; job_name: string; customer_name: string }> = []
const mockSelect = vi.fn()
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: (cols: string) => {
        mockSelect(cols)
        return {
          eq: () =>
            Promise.resolve({
              data: [...Array.from({ length: mockCount }, (_, i) => ({ id: `j${i}`, job_name: `Job ${i}`, customer_name: 'A Customer' })), ...mockZzRows],
              error: null,
            }),
        }
      },
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

  it('does not count a ZZ test job the board hides: one real job beside a test job reads 1, send it', async () => {
    mockRole = 'assistant'
    mockCount = 1
    mockZzRows = [
      { id: 'zz1', job_name: 'ZZ TEST dispute walk', customer_name: 'A Tester' },
      { id: 'zz2', job_name: 'Job', customer_name: 'ZZ Test Customer' },
    ]
    try {
      renderWithProviders(<AssistantReadyToBillBanner />)
      await waitFor(() => expect(screen.getByText(/ready to bill — send it/)).toBeTruthy())
      expect(screen.getByText('1')).toBeTruthy()
      expect(mockSelect).toHaveBeenCalledWith('id, job_name, customer_name')
    } finally {
      mockZzRows = []
    }
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
