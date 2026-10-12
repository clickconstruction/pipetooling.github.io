// @vitest-environment jsdom
/**
 * Where the side sits (Messages cut 10, P4, `phone-mockups.html` screen 2a): at a desk cut 4's flow is a column beside
 * the thread; on a phone it is a row over the lines, under the header, so the lines keep the whole width. Greg Paulk
 * from the spine's demo rows, with a stand-in side.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import type { JobTile } from '../../../lib/messages/jobTiles'
import { DEMO_NOW } from '../../../lib/messages/messagesDemo'
import { spineMessagesView } from '../../../lib/messages/spineRows'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import { PHONE_SHEET_QUERY } from '../../PhoneSheet'
import type { MessagesWrites } from './messagesWrites'
import { ThreadWindow } from './ThreadWindow'

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

function open() {
  renderWithProviders(
    <ThreadWindow contactId="c-greg" onClose={vi.fn()} slots={{ side: () => <aside data-test-side>their flow</aside> }} view={spineMessagesView()} nowIso={DEMO_NOW} writes={writes()} />,
  )
  const win = screen.getByRole('dialog', { name: 'Greg Paulk: messages' })
  return { win, side: () => [...win.querySelectorAll('[data-test-side]')] }
}

beforeEach(() => screenIs(false))
afterEach(() => {
  cleanup()
  window.matchMedia = realMatchMedia
})

describe('the side of a thread (cut 10)', () => {
  it('sits beside the thread at a desk', () => {
    const { win, side } = open()
    expect(side()).toHaveLength(1)
    const column = win.querySelector('[data-thread-lines]')?.parentElement as HTMLElement
    expect(side()[0]?.previousElementSibling).toBe(column)
  })

  it('is a row over the lines on a phone, under the header', () => {
    screenIs(true)
    const { win, side } = open()
    expect(side()).toHaveLength(1)
    const row = side()[0] as HTMLElement
    expect(row.previousElementSibling).toBe(win.querySelector('[data-thread-header]'))
    expect(row.nextElementSibling).toBe(win.querySelector('[data-thread-lines]'))
  })
})
