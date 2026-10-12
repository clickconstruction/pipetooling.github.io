// @vitest-environment jsdom
/**
 * The windows inside a person's thread on a phone (Messages cut 10, P2, `phone-mockups.html` screen 1c): ⋯ is a sheet
 * from the bottom with Cancel, the message window and the job picker are sheets too, and Escape closes the window on top
 * first. The picker opened from the message window used to lose Escape to the window under it. Greg Paulk from the
 * spine's demo rows.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { ThreadWindow } from './ThreadWindow'
import type { MessagesWrites } from './messagesWrites'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import { DEMO_NOW } from '../../../lib/messages/messagesDemo'
import { spineMessagesView } from '../../../lib/messages/spineRows'
import type { JobTile } from '../../../lib/messages/jobTiles'
import { resetModalStackForTests } from '../../../lib/modalStack'
import { PHONE_SHEET_QUERY } from '../../PhoneSheet'

const realMatchMedia = window.matchMedia

function screenIs(phone: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: phone && query === PHONE_SHEET_QUERY,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}

const writes = (): MessagesWrites => ({
  nameContact: vi.fn(() => Promise.resolve(null)),
  tieMessage: vi.fn(() => Promise.resolve()),
  setDefaultJob: vi.fn(() => Promise.resolve()),
  addJob: vi.fn(() => Promise.resolve()),
  removeJob: vi.fn(() => Promise.resolve()),
  searchRecords: vi.fn(() => Promise.resolve([])),
  searchJobs: vi.fn(() => Promise.resolve([] as JobTile[])),
})

function open(onClose = vi.fn()) {
  renderWithProviders(<ThreadWindow contactId="c-greg" onClose={onClose} slots={{}} view={spineMessagesView()} nowIso={DEMO_NOW} writes={writes()} />)
  return { onClose, win: screen.getByRole('dialog', { name: 'Greg Paulk: messages' }) }
}
const escape = () => fireEvent.keyDown(document, { key: 'Escape' })
const sheetOf = (el: Element) => el.closest('[data-phone-sheet]')?.getAttribute('data-phone-sheet')

beforeEach(() => {
  resetModalStackForTests()
  screenIs(true)
})
afterEach(() => {
  cleanup()
  window.matchMedia = realMatchMedia
})

describe('the windows inside a thread on a phone (cut 10)', () => {
  it('⋯ is a sheet from the bottom with the window’s rows and Cancel; Escape closes the sheet, not the thread', () => {
    const { onClose, win } = open()
    fireEvent.click(within(win).getByRole('button', { name: 'More' }))
    const menu = screen.getByRole('menu', { name: 'More' })
    expect(sheetOf(menu)).toBe('sheet')
    expect(within(menu).getAllByRole('menuitem').map((b) => b.textContent)).toEqual(['Show all text', 'Open their record'])
    fireEvent.click(within(menu).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('menu')).toBeNull()

    fireEvent.click(within(win).getByRole('button', { name: 'More' }))
    escape()
    expect(screen.queryByRole('menu')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(within(win).getByRole('button', { name: 'More' }))
    fireEvent.click(within(screen.getByRole('menu', { name: 'More' })).getByRole('menuitem', { name: 'Show all text' }))
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(within(win).getByRole('button', { name: 'More' }))
    expect(within(screen.getByRole('menu', { name: 'More' })).getByRole('menuitem', { name: 'Fold long messages' })).toBeTruthy()
  })

  it('a line opens as a sheet; change opens the picker over it; Escape closes the picker, then the line, then the thread', async () => {
    const { onClose, win } = open()
    fireEvent.click(win.querySelector('[data-thread-line="m-greg-email-in"]')!)
    const full = await screen.findByRole('dialog', { name: 'Email: Hillside sitework, Boerne, rev 1' })
    expect([sheetOf(full), full.hasAttribute('data-message-window')]).toEqual(['sheet', true])

    fireEvent.click(within(full).getByRole('button', { name: 'change' }))
    const picker = await screen.findByRole('dialog', { name: 'Tie this line to a job' })
    expect(sheetOf(picker)).toBe('sheet')

    escape()
    expect(screen.queryByRole('dialog', { name: 'Tie this line to a job' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Email: Hillside sitework, Boerne, rev 1' })).toBeTruthy()
    escape()
    expect(screen.queryByRole('dialog', { name: 'Email: Hillside sitework, Boerne, rev 1' })).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    escape()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps ⋯ a menu under its button at a desk', () => {
    screenIs(false)
    const { win } = open()
    fireEvent.click(within(win).getByRole('button', { name: 'More' }))
    const menu = within(win).getByRole('menu')
    expect(menu.closest('[data-phone-sheet]')).toBeNull()
    expect(menu.style.position).toBe('absolute')
  })
})
