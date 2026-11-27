// @vitest-environment jsdom
/**
 * The thread window in the room a phone's keyboard leaves (punch list #348, the phone walk of 2026-11-21). The window
 * was pinned to the page, so the keyboard slid its header off the top of the screen. It follows the part of the page
 * that shows now, and while that part is short the header keeps its first row, the flow strip waits, the lines keep no
 * floor and the lines and the box can scroll as one. A desk, and a page pinched larger, keep the window as it was.
 * Greg Paulk from the spine's demo rows.
 */
import { act } from 'react'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, within } from '@testing-library/react'

vi.mock('../../../hooks/useMeasuredWidth', () => ({ useMeasuredWidth: () => [{ current: null }, null] }))

import { ThreadWindow } from './ThreadWindow'
import type { MessagesWrites } from './messagesWrites'
import type { ThreadSlots } from './threadSlots'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import { DEMO_NOW } from '../../../lib/messages/messagesDemo'
import { spineMessagesView } from '../../../lib/messages/spineRows'
import type { JobTile } from '../../../lib/messages/jobTiles'

const PHONE_QUERY = '(max-width: 760px)'
const realMatchMedia = window.matchMedia
const realViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport')
const realClientWidth = Object.getOwnPropertyDescriptor(document.documentElement, 'clientWidth')

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

/** The part of the page that shows: its height, how far it slid and how wide, on a page 402 px wide. */
function viewport(height: number, offsetTop = 0, width = 402) {
  const heard = new Set<() => void>()
  const vv = {
    height,
    offsetTop,
    width,
    addEventListener: (_type: string, f: () => void) => heard.add(f),
    removeEventListener: (_type: string, f: () => void) => heard.delete(f),
  }
  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true })
  Object.defineProperty(document.documentElement, 'clientWidth', { value: 402, configurable: true })
  return {
    set(next: { height: number; offsetTop?: number }) {
      vv.height = next.height
      vv.offsetTop = next.offsetTop ?? 0
      act(() => heard.forEach((f) => f()))
    },
  }
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

const slots: ThreadSlots = {
  statusRow: () => <span>portal · 3 d ago · 1 unopened</span>,
  side: () => <div data-test-flow>their flow</div>,
  box: () => <div data-test-box>the reply box</div>,
}

function open(given: ThreadSlots = slots) {
  renderWithProviders(<ThreadWindow contactId="c-greg" onClose={vi.fn()} slots={given} view={spineMessagesView()} nowIso={DEMO_NOW} writes={writes()} />)
  const win = screen.getByRole('dialog', { name: 'Greg Paulk: messages' })
  const q = (sel: string) => win.querySelector(sel) as HTMLElement
  return {
    win,
    backdrop: win.parentElement as HTMLElement,
    status: () => q('[data-thread-status]'),
    /** Which of the three that wait wear the fold's mark: the status row, the jobs, the flow strip. */
    folded: () => ['[data-thread-status]', '[data-thread-jobs-fold]', '[data-thread-flow-fold]'].map((sel) => q(sel).hasAttribute('data-thread-tight-fold')),
    jobs: () => q('[data-thread-jobs-fold]'),
    flow: () => q('[data-thread-flow-fold]'),
    lines: () => q('[data-thread-lines]'),
    column: () => q('[data-thread-column]'),
  }
}

beforeEach(() => screenIs(false))
afterEach(() => {
  cleanup()
  window.matchMedia = realMatchMedia
  if (realViewport) Object.defineProperty(window, 'visualViewport', realViewport)
  else Reflect.deleteProperty(window, 'visualViewport')
  if (realClientWidth) Object.defineProperty(document.documentElement, 'clientWidth', realClientWidth)
  else Reflect.deleteProperty(document.documentElement, 'clientWidth')
})

describe('the thread window on a phone, in the room the keyboard leaves', () => {
  it('fills the screen with every row while the keyboard is away', () => {
    screenIs(true)
    viewport(700)
    const t = open()
    expect(t.win.getAttribute('data-thread-room')).toBe('whole')
    expect([t.backdrop.style.top, t.backdrop.style.height]).toEqual(['0px', '700px'])
    expect(t.folded()).toEqual([false, false, false])
    expect([t.jobs().style.display, t.flow().style.display]).toEqual(['contents', 'contents'])
    expect(t.lines().style.minHeight).toBe('max(7rem, 33%)')
  })

  it('follows the part that shows when the keyboard comes up, and keeps the way back, the name and ⋯', () => {
    screenIs(true)
    const vv = viewport(700)
    const t = open()
    // An iPhone 17: the keyboard leaves 375 px and the page slides 180 px down to the reply box.
    vv.set({ height: 375, offsetTop: 180 })
    expect(t.win.getAttribute('data-thread-room')).toBe('tight')
    expect([t.backdrop.style.top, t.backdrop.style.height]).toEqual(['180px', '375px'])
    expect(within(t.win).getByRole('button', { name: 'Back to everyone' })).toBeTruthy()
    expect(within(t.win).getByRole('heading', { name: /Greg Paulk/ })).toBeTruthy()
    expect(within(t.win).getByRole('button', { name: 'More' })).toBeTruthy()
  })

  it('folds the header’s lower rows and the flow strip away, drops the lines’ floor and keeps the box', () => {
    screenIs(true)
    const vv = viewport(700)
    const t = open()
    vv.set({ height: 375, offsetTop: 180 })
    expect(t.folded()).toEqual([true, true, true])
    expect(t.lines().style.minHeight).toBe('0')
    expect(t.win.querySelector('[data-test-box]')).toBeTruthy()
    // Hidden, not taken out: what the rows hold is still there when the keyboard goes.
    expect(t.status().textContent).toContain('portal · 3 d ago · 1 unopened')
    expect(t.flow().querySelector('[data-test-flow]')).toBeTruthy()
    expect(t.jobs().querySelector('[data-jobs-rail]')).toBeTruthy()
  })

  it('brings every row back when the keyboard goes', () => {
    screenIs(true)
    const vv = viewport(700)
    const t = open()
    vv.set({ height: 375, offsetTop: 180 })
    vv.set({ height: 700 })
    expect(t.win.getAttribute('data-thread-room')).toBe('whole')
    expect([t.backdrop.style.top, t.backdrop.style.height]).toEqual(['0px', '700px'])
    expect(t.folded()).toEqual([false, false, false])
    expect(t.lines().style.minHeight).toBe('max(7rem, 33%)')
  })

  it('lets the lines and the box scroll as one, so a box taller than the room is reached and not cut', () => {
    screenIs(true)
    viewport(290)
    const t = open()
    expect(t.column().style.overflowY).toBe('auto')
  })

  it('stays pinned to the page while it is pinched larger', () => {
    screenIs(true)
    // Two fingers: half the page's width shows, and half its height.
    viewport(350, 120, 201)
    const t = open()
    expect(t.win.getAttribute('data-thread-room')).toBe('whole')
    expect([t.backdrop.style.inset, t.backdrop.style.height]).toEqual(['0', ''])
    expect(t.folded()).toEqual([false, false, false])
    expect(t.lines().style.minHeight).toBe('max(7rem, 33%)')
    expect(t.column().style.overflowY).toBe('')
  })

  it('hides what wears the mark with one rule, and never a row that holds the field being typed in', () => {
    const css = readFileSync('src/index.css', 'utf8')
    expect(css).toMatch(/\[data-thread-tight-fold\]:not\(:focus-within\)\s*\{\s*display:\s*none\s*!important;\s*\}/)
  })
})

describe('the thread window at a desk', () => {
  it('is pinned to the page as it was, at any height: no fold, no wrapper, the floor under the lines', () => {
    viewport(375, 0, 1400)
    Object.defineProperty(document.documentElement, 'clientWidth', { value: 1400, configurable: true })
    const t = open()
    expect(t.win.getAttribute('data-thread-room')).toBe('whole')
    expect([t.backdrop.style.inset, t.backdrop.style.height]).toEqual(['0', ''])
    expect(t.status().hasAttribute('data-thread-tight-fold')).toBe(false)
    expect(t.jobs()).toBeNull()
    expect(t.flow()).toBeNull()
    expect(t.lines().style.minHeight).toBe('max(7rem, 33%)')
    expect(t.column().style.overflowY).toBe('')
  })

  it('is as it was where the browser cannot say what shows', () => {
    screenIs(true)
    const t = open()
    expect(t.win.getAttribute('data-thread-room')).toBe('whole')
    expect(t.backdrop.style.inset).toBe('0')
    expect(t.column().style.overflowY).toBe('')
  })
})

describe('the reply box’s foot follows the keys (finding 319)', () => {
  // A box as the reply box marks itself, with a field in it. jsdom lays nothing out, so the two rects are given.
  const boxSlots: ThreadSlots = {
    ...slots,
    box: () => (
      <div data-reply-box>
        <textarea aria-label="Write to Greg Paulk" />
        <button type="button">Send email…</button>
      </div>
    ),
  }
  const rect = (bottom: number) => () => ({ top: 0, left: 0, right: 375, bottom, width: 375, height: bottom, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
  function withBox() {
    screenIs(true)
    const vv = viewport(553)
    const t = open(boxSlots)
    const column = t.column()
    const box = column.querySelector('[data-reply-box]') as HTMLElement
    // With the keys up the box's foot stands 96 px under the column's.
    column.getBoundingClientRect = rect(259)
    box.getBoundingClientRect = rect(355)
    return { vv, column, field: within(box).getByRole('textbox') as HTMLTextAreaElement }
  }

  it('when the keyboard takes room while the box holds the focus, the column scrolls the send press up', () => {
    const t = withBox()
    t.field.focus()
    expect(t.column.scrollTop).toBe(0)
    t.vv.set({ height: 259 })
    expect(t.column.scrollTop).toBe(96)
  })

  it('a room that grows moves nothing, and neither does a room that falls while the person reads the lines', () => {
    const t = withBox()
    // The focus is not in the box: the room falls and the column stays.
    t.vv.set({ height: 259 })
    expect(t.column.scrollTop).toBe(0)
    // The focus is in the box and the keyboard goes away: nothing to bring up.
    t.field.focus()
    t.vv.set({ height: 553 })
    expect(t.column.scrollTop).toBe(0)
  })

  it('at a desk the column does not scroll and nothing moves', () => {
    screenIs(false)
    const vv = viewport(700)
    const t = open(boxSlots)
    const column = t.column()
    const box = column.querySelector('[data-reply-box]') as HTMLElement
    column.getBoundingClientRect = rect(259)
    box.getBoundingClientRect = rect(355)
    ;(within(box).getByRole('textbox') as HTMLTextAreaElement).focus()
    vv.set({ height: 300 })
    expect(column.scrollTop).toBe(0)
  })
})
