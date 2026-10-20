// @vitest-environment jsdom
/**
 * The call script window (v2.5556): the four parts in the owner's words with the caller's first name in bold, the blank
 * when the app has no name, Copy on the clipboard, Open in a new tab on Trade partners with the script, and the closes.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CALL_SCRIPT_BLANK, CALL_SCRIPT_HREF } from '../../lib/gc/callScript'
import { GcCallScriptWindow } from './GcCallScriptWindow'

const auth = vi.hoisted(() => ({ profileName: 'Robert Douglas' as string | null }))
vi.mock('../../hooks/useAuth', () => ({ useOptionalAuth: () => ({ profileName: auth.profileName }) }))

afterEach(() => {
  cleanup()
  auth.profileName = 'Robert Douglas'
})

describe('GcCallScriptWindow', () => {
  it('reads the four parts with the caller’s first name in bold, the asks as a list, and what to do after the call', () => {
    render(<GcCallScriptWindow onClose={() => undefined} />)
    const dialog = screen.getByRole('dialog', { name: 'Calling a company new to us' })
    expect([...dialog.querySelectorAll('[data-call-script-part]')].map((e) => e.getAttribute('data-call-script-part'))).toEqual(['intro', 'contact', 'info', 'closing'])
    expect([...dialog.querySelectorAll('[data-caller-name]')].map((e) => e.textContent)).toEqual(['Robert', 'Robert'])
    const intro = screen.getByRole('region', { name: 'Intro' }).querySelector('p')?.textContent ?? ''
    expect(intro.startsWith('Hi, my name is Robert, and I’m calling from Click Plumbing and Electrical.')).toBe(true)
    expect(within(screen.getByRole('region', { name: 'Collecting info' })).getAllByRole('listitem').map((e) => e.textContent)).toEqual([
      'Could I get your name and the title your company knows you by?',
      'What’s the best phone number to reach you?',
      'What’s the best email address to send bid invitations, plans and project information?',
      'What is your office address and how far are you willing to travel?',
    ])
    expect(within(dialog).getByText("Then press Add a company on the trade's card and type what they gave you.")).toBeTruthy()
  })

  it('leaves the blank when the app has no name for the caller', () => {
    auth.profileName = null
    render(<GcCallScriptWindow onClose={() => undefined} />)
    expect([...document.querySelectorAll('[data-caller-name]')].map((e) => e.textContent)).toEqual([CALL_SCRIPT_BLANK, CALL_SCRIPT_BLANK])
  })

  it('copies the whole script as text, opens a new tab on Trade partners with the script, and closes on ×, Close, Esc and the dim', async () => {
    const writeText = vi.fn((_text: string) => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const onClose = vi.fn()
    render(<GcCallScriptWindow onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy the script' }))
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText.mock.calls[0]?.[0]).toContain('Intro\nHi, my name is Robert, and I’m calling from Click Plumbing and Electrical.')
    expect(await screen.findByRole('button', { name: 'The script is copied.' })).toBeTruthy()
    const link = document.querySelector('[data-call-script-new-tab]') as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe(CALL_SCRIPT_HREF)
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    fireEvent.click(screen.getByRole('button', { name: 'Close the call script' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(document.querySelector('[data-gc-call-script]') as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(4)
  })
})
