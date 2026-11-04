// @vitest-environment jsdom
/**
 * The thread folds by height on a short window (v2.6474, `isThreadShort`): a laptop's window under 820 px tall. The
 * header keeps two rows: *Who is this?* rides the line it answers, and the status, the stamps sentence and the jobs
 * share one row. Their numbers wait under the arrow, the lines keep a third of the window, and the open thread says
 * `short` to the slots. A phone keeps its own fold. Greg Paulk and the unnamed number from the spine's demo rows.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'

const measured = vi.hoisted(() => ({ width: null as number | null }))
vi.mock('../../../hooks/useMeasuredWidth', () => ({ useMeasuredWidth: () => [{ current: null }, measured.width] }))

import { ThreadWindow } from './ThreadWindow'
import type { MessagesWrites } from './messagesWrites'
import { useOpenThread } from './openThread'
import type { ThreadSlots } from './threadSlots'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import { DEMO_NOW } from '../../../lib/messages/messagesDemo'
import { spineMessagesView } from '../../../lib/messages/spineRows'
import { THREAD_SHORT_QUERY } from '../../../lib/messages/threadFold'
import type { JobTile } from '../../../lib/messages/jobTiles'

const PHONE_QUERY = '(max-width: 760px)'
const realMatchMedia = window.matchMedia

function screenIs({ phone = false, short = false }: { phone?: boolean; short?: boolean }) {
  window.matchMedia = ((query: string) => ({
    matches: (phone && query === PHONE_QUERY) || (short && query === THREAD_SHORT_QUERY),
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

/** A box slot that says what the open thread told it. */
function ShortSays() {
  const open = useOpenThread()
  return <div data-test-short={open?.short ? 'short' : 'tall'} data-test-beside={open?.beside ? 'beside' : 'under'} />
}

function open(contactId: string) {
  const slots: ThreadSlots = {
    statusRow: () => <span>portal · 3 d ago</span>,
    box: () => <ShortSays />,
    aboveLines: () => <section data-test-card>Bid it?</section>,
  }
  renderWithProviders(<ThreadWindow contactId={contactId} onClose={vi.fn()} slots={slots} view={spineMessagesView()} nowIso={DEMO_NOW} writes={writes()} />)
  const win = screen.getByRole('dialog', { name: /: messages$/ })
  return { win, header: win.querySelector('[data-thread-header]') as HTMLElement }
}

beforeEach(() => {
  measured.width = null
  screenIs({})
})
afterEach(() => {
  cleanup()
  window.matchMedia = realMatchMedia
})

describe('the thread folds by height on a short window (v2.6474)', () => {
  it('puts the status, the stamps and the jobs on one row, and folds the numbers under the arrow', () => {
    screenIs({ short: true })
    const { win, header } = open('c-greg')
    expect(header.hasAttribute('data-thread-short')).toBe(true)
    const status = win.querySelector('[data-thread-status]') as HTMLElement
    expect(status.style.flexWrap).toBe('nowrap')
    expect(status.textContent).toContain('portal · 3 d ago')
    expect(status.querySelector('[data-thread-stamps]')).toBeTruthy()
    expect(status.querySelector('[data-jobs-rail="strip"]')).toBeTruthy()
    expect(win.querySelectorAll('[data-thread-stamps]')).toHaveLength(1)
    expect(win.querySelector('[data-thread-reach]')).toBeNull()
    fireEvent.click(within(win).getByRole('button', { name: 'Show their numbers and addresses' }))
    expect(win.querySelector('[data-thread-reach]')).toBeTruthy()
    expect((win.querySelector('[data-thread-lines]') as HTMLElement).style.minHeight).toBe('max(7rem, 33%)')
    expect(win.querySelector('[data-test-short]')?.getAttribute('data-test-short')).toBe('short')
  })

  it('asks Who is this? on the line it answers, not on a row of its own', () => {
    screenIs({ short: true })
    const { win, header } = open('c-unknown')
    const asks = within(header).getAllByRole('button', { name: 'Who is this?' })
    expect(asks).toHaveLength(1)
    expect(asks[0]!.getAttribute('data-thread-who')).toBe('inline')
    fireEvent.click(asks[0]!)
    expect(screen.getByRole('dialog', { name: /^Who is this\?/ })).toBeTruthy()
    expect(win).toBeTruthy()
  })

  it('stays as it was on a tall window and on a phone', () => {
    const tall = open('c-greg')
    expect(tall.header.hasAttribute('data-thread-short')).toBe(false)
    expect(tall.win.querySelector('[data-thread-status] [data-thread-stamps]')).toBeNull()
    expect(tall.win.querySelector('[data-test-short]')?.getAttribute('data-test-short')).toBe('tall')
    cleanup()
    screenIs({ phone: true, short: true })
    const phone = open('c-greg')
    expect(phone.header.hasAttribute('data-thread-short')).toBe(false)
  })
})

describe('a short, wide window puts the sort card beside the lines (v2.6478)', () => {
  it('draws what a cut puts above the lines in a column at their right, and says so to the slots', () => {
    screenIs({ short: true })
    measured.width = 976
    const { win } = open('c-greg')
    expect(win.querySelector('[data-thread-body]')?.getAttribute('data-thread-body')).toBe('beside')
    expect(win.querySelector('[data-thread-above]')).toBeNull()
    const beside = win.querySelector('[data-thread-beside]') as HTMLElement
    expect(beside.className).toBe('thread-beside')
    expect(beside.querySelector('[data-test-card]')).toBeTruthy()
    expect(win.querySelector('[data-test-short]')?.getAttribute('data-test-beside')).toBe('beside')
  })

  it('keeps the card above the lines under 900 px of column, and on a tall window', () => {
    screenIs({ short: true })
    measured.width = 880
    const narrow = open('c-greg')
    expect(narrow.win.querySelector('[data-thread-beside]')).toBeNull()
    expect(narrow.win.querySelector('[data-thread-above] [data-test-card]')).toBeTruthy()
    cleanup()
    screenIs({})
    measured.width = 1100
    const tall = open('c-greg')
    expect(tall.win.querySelector('[data-thread-body]')?.getAttribute('data-thread-body')).toBe('under')
  })
})
