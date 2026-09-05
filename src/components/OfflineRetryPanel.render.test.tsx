// @vitest-environment jsdom
/**
 * Render smokes for the offline Retry panel (J2-F3, Tier-1 #6b): the offline
 * copy gains a Retry button; the browser's `online` event flips the copy and
 * auto-retries only idempotent actions; a server refusal gets no Retry.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'helpers' })
})
const recordNavClick = vi.fn()
vi.mock('../lib/navClickTelemetry', () => ({ recordNavClick: (...a: unknown[]) => recordNavClick(...a) }))

import OfflineRetryPanel from './OfflineRetryPanel'
import { renderWithProviders } from '../test/renderSmokeMocks'
import { OFFLINE_ERROR_MESSAGE } from '../lib/networkErrorMessage'
import { BACK_ONLINE_AUTO_MESSAGE, BACK_ONLINE_MESSAGE } from '../lib/offlineRecoveryState'

const NETWORK = { kind: 'network' as const, message: OFFLINE_ERROR_MESSAGE }

function setOnLine(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => value })
}

describe('OfflineRetryPanel', () => {
  beforeEach(() => {
    recordNavClick.mockReset()
    setOnLine(false)
  })
  afterEach(() => {
    setOnLine(true)
  })

  it('renders nothing with no failure', () => {
    const { container } = renderWithProviders(<OfflineRetryPanel failure={null} onRetry={() => {}} surface="t" />)
    expect(container.innerHTML).toBe('')
  })

  it('offline: the offline copy plus a Retry button that re-runs the action and records the tap', () => {
    const onRetry = vi.fn()
    renderWithProviders(<OfflineRetryPanel failure={NETWORK} onRetry={onRetry} surface="clock-in" />)
    expect(screen.getByText(OFFLINE_ERROR_MESSAGE)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(recordNavClick).toHaveBeenCalledWith('smoke-auth-user-1', 'helpers', 'offline_retry_clicked', '#clock-in:tap')
  })

  it('the browser flag alone never flips the copy — a failed fetch while "online" is still offline', () => {
    setOnLine(true)
    renderWithProviders(<OfflineRetryPanel failure={NETWORK} onRetry={() => {}} surface="clock-in" idempotent />)
    expect(screen.getByText(OFFLINE_ERROR_MESSAGE)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })

  it('a write: the online event flips to "Back online" but does NOT retry by itself', () => {
    const onRetry = vi.fn()
    renderWithProviders(<OfflineRetryPanel failure={NETWORK} onRetry={onRetry} surface="clock-in" />)
    act(() => {
      setOnLine(true)
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.getByText(BACK_ONLINE_MESSAGE)).toBeTruthy()
    expect(onRetry).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })

  it('an idempotent read: the online event retries once on its own and records it as auto', () => {
    const onRetry = vi.fn()
    renderWithProviders(<OfflineRetryPanel failure={NETWORK} onRetry={onRetry} surface="dispatch-schedule" idempotent />)
    expect(onRetry).not.toHaveBeenCalled()
    act(() => {
      setOnLine(true)
      window.dispatchEvent(new Event('online'))
    })
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(recordNavClick).toHaveBeenCalledWith(
      'smoke-auth-user-1',
      'helpers',
      'offline_retry_clicked',
      '#dispatch-schedule:auto',
    )
    expect(screen.getByText(BACK_ONLINE_AUTO_MESSAGE)).toBeTruthy()
    // A second online event (flapping signal) is one more chance, not a loop.
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(onRetry).toHaveBeenCalledTimes(2)
  })

  it('a server refusal renders its sentence with no Retry button', () => {
    renderWithProviders(
      <OfflineRetryPanel
        failure={{ kind: 'server', message: "You don't have permission to clock in." }}
        onRetry={() => {}}
        surface="clock-in"
      />,
    )
    expect(screen.getByText("You don't have permission to clock in.")).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('hides the button while the action is busy', () => {
    renderWithProviders(<OfflineRetryPanel failure={NETWORK} onRetry={() => {}} surface="clock-in" busy />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
