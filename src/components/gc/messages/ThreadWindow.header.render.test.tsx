// @vitest-environment jsdom
/**
 * The thread's compact header (v2.6505, `threadHeader.ts`): three rows across the width at a desk, at any height — who
 * they are with their first address and number on the company line, whose move it is with the stamps sentence, their
 * jobs — and the rest of their numbers and addresses behind the arrow, which draws only when something waits. A phone
 * stacks the same facts. Greg Paulk from the spine's demo rows, with a second address added for the arrow.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'

const measured = vi.hoisted(() => ({ width: null as number | null }))
vi.mock('../../../hooks/useMeasuredWidth', () => ({ useMeasuredWidth: () => [{ current: null }, measured.width] }))

import { ThreadWindow } from './ThreadWindow'
import type { MessagesWrites } from './messagesWrites'
import type { ThreadSlots } from './threadSlots'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import { contactById } from '../../../lib/contacts/kernel'
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

/** Greg with a second address, so something waits behind the arrow. */
function open({ secondEmail = false }: { secondEmail?: boolean } = {}) {
  const view = spineMessagesView()
  if (secondEmail) contactById(view.contacts, 'c-greg')?.channels.push({ id: 'ch-greg-email-2', kind: 'email', value: 'gp@hillside.example', optedOutAt: null })
  const slots: ThreadSlots = {
    headerRight: () => <span data-test-who-has-it>Wendi has this</span>,
    statusRow: () => <span data-test-chip>We owe them…</span>,
  }
  renderWithProviders(<ThreadWindow contactId="c-greg" onClose={vi.fn()} slots={slots} view={view} nowIso={DEMO_NOW} writes={writes()} />)
  const win = screen.getByRole('dialog', { name: 'Greg Paulk: messages' })
  const header = win.querySelector('[data-thread-header]') as HTMLElement
  return { win, header, line: header.querySelector('[data-thread-company-line]') as HTMLElement, status: header.querySelector('[data-thread-status]') as HTMLElement, rail: header.querySelector('[data-jobs-rail]') as HTMLElement }
}

beforeEach(() => {
  measured.width = null
  screenIs({})
})
afterEach(() => {
  cleanup()
  window.matchMedia = realMatchMedia
})

describe('the thread header is three rows across the width at a desk (v2.6505)', () => {
  it('at 1100 px of column: who with the address and the number on the company line, the chips with the sentence, the jobs', () => {
    measured.width = 1100
    const { header, line, status, rail } = open()
    expect(header.getAttribute('data-thread-header')).toBe('wide')
    expect(header.getAttribute('data-thread-header-rows')).toBe('who status jobs')
    expect(line.textContent).toContain('Trade partner: Hillside')
    expect(within(line).getByRole('link', { name: 'greg@hillside.example' })).toBeTruthy()
    expect(line.textContent).toContain('(210) 555-0113')
    expect(line.querySelectorAll('[data-thread-reach-line]')).toHaveLength(2)
    // Nothing waits behind the line: no arrow, no row under it.
    expect(within(header).queryByRole('button', { name: /their numbers and addresses/ })).toBeNull()
    expect(header.querySelector('[data-thread-reach]')).toBeNull()
    expect(status.style.flexWrap).toBe('wrap')
    expect(status.querySelector('[data-test-chip]')?.textContent).toBe('We owe them…')
    const stamps = status.querySelector('[data-thread-stamps]') as HTMLElement
    expect([stamps.style.flex, stamps.style.textOverflow]).toEqual(['1 1 14rem', 'ellipsis'])
    expect(stamps.getAttribute('title')).toBe(stamps.textContent)
    expect(header.querySelectorAll('[data-thread-stamps]')).toHaveLength(1)
    expect([rail.getAttribute('data-jobs-rail'), rail.style.flexWrap]).toEqual(['', 'wrap'])
    expect(rail.textContent).toContain('Their jobs')
    expect(within(rail).getByRole('button', { name: '+ add a job' })).toBeTruthy()
    expect(header.querySelector('[data-test-who-has-it]')?.textContent).toBe('Wendi has this')
    expect(within(header).getByRole('button', { name: 'Close' })).toBeTruthy()
  })

  it('is the same shape on a short window', () => {
    measured.width = 1100
    const tall = open()
    const tallRows = tall.header.getAttribute('data-thread-header-rows')
    cleanup()
    screenIs({ short: true })
    const short = open()
    expect(short.header.getAttribute('data-thread-header-rows')).toBe(tallRows)
    expect(short.line.querySelectorAll('[data-thread-reach-line]')).toHaveLength(2)
    expect(short.status.querySelector('[data-thread-stamps]')).toBeTruthy()
    expect(short.rail.getAttribute('data-jobs-rail')).toBe('')
  })

  it('keeps a second address behind the arrow, the first still on the line', () => {
    measured.width = 1100
    const { header, line } = open({ secondEmail: true })
    expect(within(line).getByRole('link', { name: 'greg@hillside.example' })).toBeTruthy()
    expect(within(line).queryByRole('link', { name: 'gp@hillside.example' })).toBeNull()
    expect(header.querySelector('[data-thread-reach]')).toBeNull()
    fireEvent.click(within(line).getByRole('button', { name: 'Show their numbers and addresses' }))
    expect(header.getAttribute('data-thread-header-rows')).toBe('who reach status jobs')
    const reach = header.querySelector('[data-thread-reach]') as HTMLElement
    expect(within(reach).getByRole('link', { name: 'gp@hillside.example' })).toBeTruthy()
    expect(within(reach).queryByRole('link', { name: 'greg@hillside.example' })).toBeNull()
    expect(reach.textContent).not.toContain('(210) 555-0113')
    fireEvent.click(within(line).getByRole('button', { name: 'Hide their numbers and addresses' }))
    expect(header.querySelector('[data-thread-reach]')).toBeNull()
  })
})

describe('a phone stacks the same facts (v2.6505 over cut 10)', () => {
  it('at 375 px: the company line cut to one, every number behind the arrow, the sentence on its own row, the strips scrolling sideways', () => {
    screenIs({ phone: true })
    measured.width = 375
    const { header, line, status, rail } = open()
    expect(header.getAttribute('data-thread-header')).toBe('folded')
    expect(header.getAttribute('data-thread-header-rows')).toBe('who status stamps jobs')
    expect(line.querySelectorAll('[data-thread-reach-line]')).toHaveLength(0)
    expect(line.style.flexWrap).toBe('nowrap')
    expect(header.querySelector('[data-thread-reach]')).toBeNull()
    fireEvent.click(within(line).getByRole('button', { name: 'Show their numbers and addresses' }))
    const reach = header.querySelector('[data-thread-reach]') as HTMLElement
    expect(within(reach).getByRole('link', { name: 'greg@hillside.example' })).toBeTruthy()
    expect(reach.textContent).toContain('(210) 555-0113')
    expect([status.style.flexWrap, status.style.overflowX]).toEqual(['nowrap', 'auto'])
    expect(status.querySelector('[data-thread-stamps]')).toBeNull()
    const stamps = header.querySelector('[data-thread-stamps]') as HTMLElement
    expect(stamps.tagName).toBe('DIV')
    expect(stamps.style.textOverflow).toBe('')
    expect([rail.getAttribute('data-jobs-rail'), rail.style.overflowX]).toEqual(['strip', 'auto'])
    expect(rail.textContent).not.toContain('Their jobs')
  })
})
