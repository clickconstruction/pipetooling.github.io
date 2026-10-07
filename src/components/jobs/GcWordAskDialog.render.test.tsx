// @vitest-environment jsdom
/**
 * Render smoke for the Ask by link dialog: nothing goes out by itself, the
 * link's standing is shown, and a man with no email can only be texted.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import GcWordAskDialog from './GcWordAskDialog'
import { DISPATCH_MODE_FOOTER_Z_INDEX } from '../dispatchMode/DispatchModeFooter'
import type { GcWordAskRow } from '../../lib/jobs/gcWordAskState'

const ask: GcWordAskRow = { id: 'ask-1', week_start: '2026-09-28', owner_user_id: 'u-malachi', owner_name: 'Malachi', gc_ids: ['a', 'b'], token: 'tok', created_by_name: 'Taunya', created_at: '2026-09-29T15:00:00Z', expires_at: '2099-10-07T15:00:00Z', emailed_at: null, emailed_to: null, opened_at: null, answered_at: null, revoked_at: null, answers: [] }

function open(over: Partial<ComponentProps<typeof GcWordAskDialog>> = {}) {
  const h = { onMake: vi.fn(), onCopyLink: vi.fn(), onCopyText: vi.fn(), onEmail: vi.fn(), onNewLink: vi.fn(), onTurnOff: vi.fn(), onClose: vi.fn() }
  render(<GcWordAskDialog ownerName="Malachi Douglas" ownerHasEmail gcNames={['Knight Contracting', 'Loberg Contracting']} ask={null} url={null} busy={false} error={null} notice={null} {...h} {...over} />)
  return h
}

describe('GcWordAskDialog', () => {
  it('stands above the dock, and still below the Job window that opens over a GC window (v2.4431)', () => {
    open()
    const backdrop = screen.getByRole('dialog')
    expect(backdrop.style.position).toBe('fixed')
    const z = Number(backdrop.style.zIndex)
    expect(z).toBeGreaterThan(DISPATCH_MODE_FOOTER_Z_INDEX)
    // The Job form, the Job window and the Bid window stand at 1000–1010 and open on top of windows like this one.
    expect(z).toBeLessThan(1000)
  })

  it('starts with nothing sent: the link is made first', () => {
    const h = open()
    expect(screen.getByText('2 GCs with no word this week')).toBeTruthy()
    expect(screen.getByText('Nothing is sent until you text or email it.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Email it/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Make the link' }))
    expect(h.onMake).toHaveBeenCalledTimes(1)
  })

  it('with a link: copy a text, copy the link, email it, turn it off', () => {
    const h = open({ ask, url: 'https://clicktooling.com/ask?t=tok' })
    expect(screen.getByText('clicktooling.com/ask?t=tok')).toBeTruthy()
    expect(screen.getByText(/not opened yet/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Copy a text for Malachi' }))
    fireEvent.click(screen.getByRole('button', { name: 'Email it to Malachi' }))
    fireEvent.click(screen.getByRole('button', { name: 'turn the link off' }))
    expect([h.onCopyText.mock.calls.length, h.onEmail.mock.calls.length, h.onTurnOff.mock.calls.length]).toEqual([1, 1, 1])
  })

  it('a man with no email on file can only be texted', () => {
    open({ ask, url: 'https://clicktooling.com/ask?t=tok', ownerHasEmail: false })
    expect((screen.getByRole('button', { name: 'Email it to Malachi' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('has nothing to ask when every word is in', () => {
    open({ gcNames: [] })
    expect(screen.getByText(/has a word in for this week/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Make the link' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
