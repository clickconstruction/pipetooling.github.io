// @vitest-environment jsdom
/**
 * Render smoke for the Email reports modal shell (v2.3570, "Email reports, one modal" PR 1):
 * the intro and the two tabs, Digests mounted first, Every report on click, `initialTab`
 * landing the Dashboard door on the cards, and the two ways out. The two panels are stubbed —
 * they own their own data loads and are the unchanged bodies of the two old modals.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

vi.mock('./RecurringDigestsPanel', () => ({
  RecurringDigestsPanel: ({ scopeMasterChoices }: { scopeMasterChoices: readonly { id: string; label: string }[] }) => (
    <div data-testid="digests-panel">digests · {scopeMasterChoices.map((c) => c.label).join(', ')}</div>
  ),
}))
vi.mock('../dashboard/ReportEmailRecipientsPanel', () => ({
  ReportEmailRecipientsPanel: ({ authUserId }: { authUserId: string | undefined }) => (
    <div data-testid="recipients-panel">recipients · {authUserId}</div>
  ),
}))

import { EmailReportsModal } from './EmailReportsModal'

function props(over: Partial<Parameters<typeof EmailReportsModal>[0]> = {}) {
  return {
    open: true,
    onClose: vi.fn(),
    authUserId: 'u1',
    authRole: 'dev' as const,
    scopeMasterChoices: [{ id: 'm1', label: 'Robert' }],
    ...over,
  }
}

describe('EmailReportsModal', () => {
  it('opens on Digests with the intro and both tabs, and Every report swaps the body', () => {
    const p = props()
    render(<EmailReportsModal {...p} />)
    expect(screen.getByRole('heading', { name: 'Email reports' })).toBeTruthy()
    expect(screen.getByText(/bundles a window of job activity/).textContent).toContain('the moment it’s filed')
    expect(screen.getByRole('tab', { name: /Digests/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('digests-panel').textContent).toContain('Robert')
    expect(screen.queryByTestId('recipients-panel')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: /Every report/ }))
    expect(screen.getByTestId('recipients-panel').textContent).toContain('u1')
    expect(screen.queryByTestId('digests-panel')).toBeNull()
  })

  it('the Dashboard door lands on Every report', () => {
    render(<EmailReportsModal {...props({ initialTab: 'every' })} />)
    expect(screen.getByRole('tab', { name: /Every report/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('recipients-panel')).toBeTruthy()
  })

  it('Close and the backdrop report; closed renders nothing', () => {
    const p = props()
    const { unmount } = render(<EmailReportsModal {...p} />)
    fireEvent.click(screen.getByText('Close'))
    expect(p.onClose).toHaveBeenCalledTimes(1)
    fireEvent.mouseDown(screen.getByRole('presentation'))
    expect(p.onClose).toHaveBeenCalledTimes(2)
    unmount()
    render(<EmailReportsModal {...props({ open: false })} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
