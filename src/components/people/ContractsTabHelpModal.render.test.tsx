// @vitest-environment jsdom
/**
 * Render tests for the Contracts tab "How this tab works" helper (v2.1404):
 * closed renders nothing; open shows the four cards (Send/Resend, Dashboard,
 * status-dot legend, Applied version); the Help link fires onOpenHelp and
 * closes; Close closes without navigating.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { render } from '@testing-library/react'
import { ContractsTabHelpModal } from './ContractsTabHelpModal'

describe('ContractsTabHelpModal', () => {
  it('renders nothing while closed', () => {
    render(<ContractsTabHelpModal open={false} onClose={() => {}} onOpenHelp={() => {}} />)
    expect(screen.queryByText('How this tab works')).toBeNull()
  })

  it('shows the four explainer cards when open', () => {
    render(<ContractsTabHelpModal open onClose={() => {}} onOpenHelp={() => {}} />)
    expect(screen.getByText('How this tab works')).toBeTruthy()
    expect(screen.getByText('Send / Resend')).toBeTruthy()
    expect(screen.getByText('Dashboard')).toBeTruthy()
    expect(screen.getByText('Status chips')).toBeTruthy()
    expect(screen.getByText('Applied version')).toBeTruthy()
    expect(screen.getByText(/waiting on a signature/)).toBeTruthy()
  })

  it('the Help link fires onOpenHelp and closes the modal', () => {
    const onClose = vi.fn()
    const onOpenHelp = vi.fn()
    render(<ContractsTabHelpModal open onClose={onClose} onOpenHelp={onOpenHelp} />)
    fireEvent.click(screen.getByText('Full guides in Help →'))
    expect(onOpenHelp).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Close closes without navigating', () => {
    const onClose = vi.fn()
    const onOpenHelp = vi.fn()
    render(<ContractsTabHelpModal open onClose={onClose} onOpenHelp={onOpenHelp} />)
    fireEvent.click(screen.getByText('Close'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onOpenHelp).not.toHaveBeenCalled()
  })
})
