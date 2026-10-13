// @vitest-environment jsdom
/**
 * The thread's header folds for a narrow column (Messages cut 10, `phone-mockups.html` screen 1a): on a phone, and at a
 * desk when the thread's column is 640 px or narrower. The chevron and the face go back to everyone in place of ×, the
 * header slot comes first in the corner as its narrow form, their numbers wait under the arrow, the status row and the
 * jobs each keep to one row. Greg Paulk from the spine's demo rows.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'

const measured = vi.hoisted(() => ({ width: null as number | null }))
vi.mock('../../../hooks/useMeasuredWidth', () => ({ useMeasuredWidth: () => [{ current: null }, measured.width] }))

import { ThreadWindow } from './ThreadWindow'
import type { MessagesWrites } from './messagesWrites'
import type { ThreadLook, ThreadSlots } from './threadSlots'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import { DEMO_NOW } from '../../../lib/messages/messagesDemo'
import { spineMessagesView } from '../../../lib/messages/spineRows'
import type { JobTile } from '../../../lib/messages/jobTiles'

const PHONE_QUERY = '(max-width: 760px)'
const realMatchMedia = window.matchMedia

function screenIs(phone: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: phone && query === PHONE_QUERY,
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
  const onClose = vi.fn()
  const looks: (ThreadLook | undefined)[] = []
  const slots: ThreadSlots = {
    headerRight: (_c, look) => {
      looks.push(look)
      return <span data-test-who-has-it>{look?.folded ? 'R' : 'Rosa has it'}</span>
    },
    statusRow: () => <span>portal · 3 d ago · 1 unopened</span>,
  }
  renderWithProviders(<ThreadWindow contactId="c-greg" onClose={onClose} slots={slots} view={spineMessagesView()} nowIso={DEMO_NOW} writes={writes()} />)
  const win = screen.getByRole('dialog', { name: 'Greg Paulk: messages' })
  return { win, onClose, looks, header: win.querySelector('[data-thread-header]') as HTMLElement }
}

beforeEach(() => {
  measured.width = null
  screenIs(false)
})
afterEach(() => {
  cleanup()
  window.matchMedia = realMatchMedia
})

describe('the thread header folds for a narrow column (cut 10)', () => {
  it('folds on a phone: back to everyone in place of ×, the corner’s slot first, the numbers under the arrow', () => {
    screenIs(true)
    const { win, onClose, looks, header } = open()
    expect(header.getAttribute('data-thread-header')).toBe('folded')
    expect(within(win).queryByRole('button', { name: 'Close' })).toBeNull()
    fireEvent.click(within(win).getByRole('button', { name: 'Back to everyone' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    expect(looks[looks.length - 1]).toEqual({ folded: true })
    const corner = [...header.querySelectorAll('[data-test-who-has-it], [aria-label="More"]')]
    expect(corner.map((el) => (el.hasAttribute('data-test-who-has-it') ? el.textContent : 'More'))).toEqual(['R', 'More'])

    expect(win.querySelector('[data-thread-reach]')).toBeNull()
    fireEvent.click(within(win).getByRole('button', { name: 'Show their numbers and addresses' }))
    expect(within(win.querySelector('[data-thread-reach]') as HTMLElement).getByRole('link', { name: 'greg@hillside.example' })).toBeTruthy()
    fireEvent.click(within(win).getByRole('button', { name: 'Hide their numbers and addresses' }))
    expect(win.querySelector('[data-thread-reach]')).toBeNull()
  })

  it('keeps the status row and the jobs to one row each, the jobs in a strip with no label', () => {
    screenIs(true)
    const { win } = open()
    const status = win.querySelector('[data-thread-status]') as HTMLElement
    expect([status.style.flexWrap, status.style.overflowX]).toEqual(['nowrap', 'auto'])
    expect(status.textContent).toContain('portal · 3 d ago · 1 unopened')
    const rail = win.querySelector('[data-jobs-rail]') as HTMLElement
    expect(rail.getAttribute('data-jobs-rail')).toBe('strip')
    expect([rail.style.flexWrap, rail.style.overflowX]).toEqual(['nowrap', 'auto'])
    expect(rail.textContent).not.toContain('Their jobs')
    expect(within(rail).getByRole('button', { name: 'New messages land on #42' })).toBeTruthy()
    const tile = rail.querySelector('[data-job-tile]') as HTMLElement
    expect([tile.style.touchAction, tile.style.flex]).toEqual(['pan-x', '0 0 auto'])
  })

  it('folds at a desk when the thread’s column is 640 px or narrower', () => {
    measured.width = 600
    const { win, header } = open()
    expect(header.getAttribute('data-thread-header')).toBe('folded')
    expect(within(win).getByRole('button', { name: 'Back to everyone' })).toBeTruthy()
  })

  it('stays wide above 640 px: ×, the slot after ⋯ in its wide form, the numbers open, the jobs wrapping under their label', () => {
    measured.width = 900
    const { win, looks, header } = open()
    expect(header.getAttribute('data-thread-header')).toBe('wide')
    expect(within(win).getByRole('button', { name: 'Close' })).toBeTruthy()
    expect(within(win).queryByRole('button', { name: 'Back to everyone' })).toBeNull()
    expect(looks[looks.length - 1]).toEqual({ folded: false })
    expect(header.querySelector('[data-test-who-has-it]')?.textContent).toBe('Rosa has it')
    expect(win.querySelector('[data-thread-reach]')).not.toBeNull()
    const rail = win.querySelector('[data-jobs-rail]') as HTMLElement
    expect([rail.getAttribute('data-jobs-rail'), rail.style.flexWrap]).toEqual(['', 'wrap'])
    expect(rail.textContent).toContain('Their jobs')
    expect((rail.querySelector('[data-job-tile]') as HTMLElement).style.touchAction).toBe('none')
  })
})
