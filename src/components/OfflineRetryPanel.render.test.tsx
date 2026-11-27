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
// Phone width (punch list #414, v2.8361): flip to true to measure the press as a thumb meets it.
const viewport = { phone: false }
vi.mock('../hooks/useIsMobile', () => ({ useIsMobile: () => viewport.phone }))
const recordNavClick = vi.fn()
vi.mock('../lib/navClickTelemetry', () => ({ recordNavClick: (...a: unknown[]) => recordNavClick(...a) }))

import OfflineRetryPanel from './OfflineRetryPanel'
import { renderWithProviders, settle } from '../test/renderSmokeMocks'
import { OFFLINE_ERROR_MESSAGE } from '../lib/networkErrorMessage'
import { OFFLINE_READ_MESSAGE, recoveryFailureFromError } from '../lib/offlineRecoveryState'
import { AUTO_TRY_WAIT_MS, BACK_ONLINE_AUTO_MESSAGE, BACK_ONLINE_MESSAGE, BACK_ONLINE_TRIED_MESSAGE } from '../lib/offlineRecoveryState'

const NETWORK = { kind: 'network' as const, message: OFFLINE_ERROR_MESSAGE }

function setOnLine(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => value })
}

describe('OfflineRetryPanel', () => {
  beforeEach(() => {
    recordNavClick.mockReset()
    setOnLine(false)
    viewport.phone = false
  })
  afterEach(() => {
    setOnLine(true)
  })

  it('renders nothing with no failure', () => {
    const { container } = renderWithProviders(<OfflineRetryPanel failure={null} onRetry={() => {}} surface="t" />)
    expect(container.innerHTML).toBe('')
  })

  it('offline: the offline copy plus a Retry button that re-runs the action and records the tap', async () => {
    const onRetry = vi.fn()
    renderWithProviders(<OfflineRetryPanel failure={NETWORK} onRetry={onRetry} surface="clock-in" />)
    await settle()
    expect(screen.getByText(OFFLINE_ERROR_MESSAGE)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(recordNavClick).toHaveBeenCalledWith('smoke-auth-user-1', 'helpers', 'offline_retry_clicked', '#clock-in:tap')
  })

  it('the browser flag alone never flips the copy — a failed fetch while "online" is still offline', async () => {
    setOnLine(true)
    renderWithProviders(<OfflineRetryPanel failure={NETWORK} onRetry={() => {}} surface="clock-in" />)
    await settle()
    expect(screen.getByText(OFFLINE_ERROR_MESSAGE)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })

  it('a read (idempotent) says the read sentence with Retry, never nothing was saved, whatever sentence the failure carries (punch list #224)', async () => {
    const { unmount } = renderWithProviders(<OfflineRetryPanel failure={NETWORK} onRetry={() => {}} surface="crew-day" idempotent />)
    await settle()
    expect(screen.getByText(OFFLINE_READ_MESSAGE)).toBeTruthy()
    expect(screen.queryByText(OFFLINE_ERROR_MESSAGE)).toBeNull()
    expect(document.body.textContent).not.toMatch(/nothing was saved/i)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    unmount()
    // A read's own words still win (the clock's, v2.6198).
    renderWithProviders(<OfflineRetryPanel failure={NETWORK} onRetry={() => {}} surface="clock-read" idempotent offlineMessage="No connection, so the clock could not load today's time." />)
    await settle()
    expect(screen.getByText("No connection, so the clock could not load today's time.")).toBeTruthy()
    expect(screen.queryByText(OFFLINE_READ_MESSAGE)).toBeNull()
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

  it('after the automatic try, the line says trying again for eight seconds and then hands the press back (finding 308)', () => {
    vi.useFakeTimers()
    try {
      const onRetry = vi.fn()
      renderWithProviders(<OfflineRetryPanel failure={NETWORK} onRetry={onRetry} surface="quickfill-deck" idempotent />)
      act(() => {
        setOnLine(true)
        window.dispatchEvent(new Event('online'))
      })
      expect(onRetry).toHaveBeenCalledTimes(1)
      expect(screen.getByText(BACK_ONLINE_AUTO_MESSAGE)).toBeTruthy()
      act(() => {
        vi.advanceTimersByTime(AUTO_TRY_WAIT_MS - 1)
      })
      expect(screen.getByText(BACK_ONLINE_AUTO_MESSAGE)).toBeTruthy()
      act(() => {
        vi.advanceTimersByTime(1)
      })
      // The failure still stands: the line no longer says it is trying, and nothing more was tried.
      expect(screen.queryByText(BACK_ONLINE_AUTO_MESSAGE)).toBeNull()
      expect(screen.getByText(BACK_ONLINE_TRIED_MESSAGE)).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
      expect(onRetry).toHaveBeenCalledTimes(1)
      // The signal comes back again: one more try by itself, and the line says so again.
      act(() => {
        window.dispatchEvent(new Event('online'))
      })
      expect(onRetry).toHaveBeenCalledTimes(2)
      expect(screen.getByText(BACK_ONLINE_AUTO_MESSAGE)).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('Retry is 44 px tall on a phone and keeps its desk height on a desktop (punch list #414, v2.8361)', async () => {
    viewport.phone = true
    const { unmount } = renderWithProviders(<OfflineRetryPanel failure={NETWORK} onRetry={() => {}} surface="crew-day" idempotent />)
    await settle()
    const phonePress = screen.getByRole('button', { name: 'Retry' })
    expect(phonePress.style.minHeight).toBe('44px')
    expect(phonePress.style.padding).toBe('0.5rem 1.1rem')
    unmount()
    viewport.phone = false
    renderWithProviders(<OfflineRetryPanel failure={NETWORK} onRetry={() => {}} surface="crew-day" idempotent />)
    await settle()
    expect(screen.getByRole('button', { name: 'Retry' }).style.minHeight).toBe('36px')
  })

  it('a server refusal renders its sentence with no Retry button', async () => {
    renderWithProviders(
      <OfflineRetryPanel
        failure={{ kind: 'server', message: "You don't have permission to clock in." }}
        onRetry={() => {}}
        surface="clock-in"
      />,
    )
    await settle()
    expect(screen.getByText("You don't have permission to clock in.")).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  it('a request that was never sent: its own words, a Retry that runs the action, and no run by itself (punch list #406)', async () => {
    const onRetry = vi.fn()
    const words = 'The app was busy renewing your sign-in, so this did not load. Try again.'
    // Built as the tally builds it, from the read's raw error: supabase-js writes the thrown error as name and message.
    const failure = recoveryFailureFromError({ message: 'AbortError: Lock was stolen by another request', details: '', hint: '', code: '' }, 'The boxes on this job did not load.')
    renderWithProviders(<OfflineRetryPanel failure={failure} onRetry={onRetry} surface="materials-on-site-phone" idempotent />)
    await settle()
    expect(screen.getByText(words)).toBeTruthy()
    expect(screen.queryByText(/No connection/)).toBeNull()
    expect(onRetry).not.toHaveBeenCalled()
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(onRetry).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('hides the button while the action is busy', async () => {
    renderWithProviders(<OfflineRetryPanel failure={NETWORK} onRetry={() => {}} surface="clock-in" busy />)
    await settle()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  it('carries What this means beside the reason, which opens the family’s card in place (punch list #187 PR 6)', () => {
    renderWithProviders(<OfflineRetryPanel failure={{ kind: 'network', message: OFFLINE_ERROR_MESSAGE }} onRetry={() => {}} surface="clock-in" />)
    fireEvent.click(screen.getByRole('button', { name: 'What this means' }))
    expect(screen.getByTestId('error-door').textContent).toContain('What was saved')
    expect(screen.getByText(OFFLINE_ERROR_MESSAGE)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })
})
