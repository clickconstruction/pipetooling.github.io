// @vitest-environment jsdom
/**
 * Render smoke for the role-gate convention (v2.2882, C25): a gated page as an
 * assistant shows the sentence once, lands on the tab the kernel chose, and
 * records one `role_gate_redirect` row; a helper lands quietly (J24-F8).
 *
 * The harness is the smallest page that uses the hook the way Jobs / People /
 * Bids do — read `?tab`, bounce when it isn't for the role, rewrite the tab.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEffect } from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation, useSearchParams } from 'react-router-dom'
import { ToastProvider } from '../contexts/ToastContext'
import { installDomShims } from '../test/renderSmokeMocks'
import { useRoleGate, resetRoleGateAnnouncements } from './useRoleGate'
import { recordNavClick } from '../lib/navClickTelemetry'

vi.mock('../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn() }))

const recordNavClickMock = vi.mocked(recordNavClick)

function GatedJobsPage({ role }: { role: string | null }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const { bounce } = useRoleGate(role, 'user-1')
  const tab = searchParams.get('tab')
  useEffect(() => {
    if (tab === 'teams-summary' && role !== 'dev') {
      const { toTab } = bounce('crew-pnl', `/jobs?tab=${tab}`)
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', toTab ?? 'reports')
        return next
      }, { replace: true })
    }
  }, [tab, role, bounce, setSearchParams])
  return <div data-testid="where">{`${location.pathname}${location.search}`}</div>
}

function renderAt(path: string, role: string | null) {
  installDomShims()
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <GatedJobsPage role={role} />
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  resetRoleGateAnnouncements()
  recordNavClickMock.mockClear()
})

afterEach(() => {
  cleanup()
})

describe('useRoleGate — a gated page as an assistant', () => {
  it("toasts 'Crew P&L is for the owner — you're on Reports.' and lands on Reports", async () => {
    renderAt('/jobs?tab=teams-summary', 'assistant')
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/jobs?tab=reports'))
    expect(screen.getByText("Crew P&L is for the owner — you're on Reports.")).toBeTruthy()
  })

  it('records exactly one role_gate_redirect row naming the refused link, even though the effect re-runs', async () => {
    renderAt('/jobs?tab=teams-summary', 'assistant')
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/jobs?tab=reports'))
    expect(recordNavClickMock).toHaveBeenCalledTimes(1)
    expect(recordNavClickMock).toHaveBeenCalledWith('user-1', 'assistant', 'role_gate_redirect', '/jobs?tab=teams-summary')
  })

  it('a role the tab is for is left alone — no toast, no row', () => {
    renderAt('/jobs?tab=teams-summary', 'dev')
    expect(screen.getByTestId('where').textContent).toBe('/jobs?tab=teams-summary')
    expect(screen.queryByText(/is for the owner/)).toBeNull()
    expect(recordNavClickMock).not.toHaveBeenCalled()
  })
})

describe('useRoleGate — helpers stay quiet (J24-F8 keep)', () => {
  it('lands on Reports with no toast, but the redirect is still recorded', async () => {
    renderAt('/jobs?tab=teams-summary', 'helpers')
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/jobs?tab=reports'))
    expect(screen.queryByText(/you're on Reports/)).toBeNull()
    expect(recordNavClickMock).toHaveBeenCalledTimes(1)
    expect(recordNavClickMock.mock.calls[0]?.[1]).toBe('helpers')
  })
})
