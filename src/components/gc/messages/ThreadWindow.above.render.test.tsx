// @vitest-environment jsdom
/**
 * What a cut draws above the lines (the New lane's sort card, Who has it) can be taller than the window has room for.
 * Live on prod (2026-10-15) a Who has it card with nine teammates pushed the reply box under the window's edge, with
 * nothing to scroll: the slot sat outside the lines' scroller. Since v2.5570 the slot has its own scrolling wrapper
 * that shrinks before the lines and the box do, so the box at the foot stays in the window. Greg Paulk from the spine's
 * demo rows, with a stand-in card.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import type { JobTile } from '../../../lib/messages/jobTiles'
import { DEMO_NOW } from '../../../lib/messages/messagesDemo'
import { spineMessagesView } from '../../../lib/messages/spineRows'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import type { MessagesWrites } from './messagesWrites'
import type { ThreadSlots } from './threadSlots'
import { ThreadWindow } from './ThreadWindow'

const writes = (): MessagesWrites => ({
  nameContact: vi.fn(() => Promise.resolve(null)),
  tieMessage: vi.fn(() => Promise.resolve()),
  setDefaultJob: vi.fn(() => Promise.resolve()),
  addJob: vi.fn(() => Promise.resolve()),
  removeJob: vi.fn(() => Promise.resolve()),
  searchRecords: vi.fn(() => Promise.resolve([])),
  searchJobs: vi.fn(() => Promise.resolve([] as JobTile[])),
})

function open(slots: ThreadSlots) {
  renderWithProviders(<ThreadWindow contactId="c-greg" onClose={vi.fn()} slots={slots} view={spineMessagesView()} nowIso={DEMO_NOW} writes={writes()} />)
  return screen.getByRole('dialog', { name: 'Greg Paulk: messages' })
}

afterEach(cleanup)

describe('what sits above the lines (v2.5570)', () => {
  it('scrolls on its own, before the lines, and leaves the box at the foot', () => {
    const win = open({
      aboveLines: () => <section data-test-card>{Array.from({ length: 9 }, (_, i) => <p key={i}>teammate {i + 1}</p>)}</section>,
      box: () => <div data-test-box>the reply box</div>,
    })
    const above = win.querySelector('[data-thread-above]') as HTMLElement
    const lines = win.querySelector('[data-thread-lines]') as HTMLElement
    expect(above.querySelector('[data-test-card]')).toBeTruthy()
    expect(above.style.overflowY).toBe('auto')
    expect(above.style.minHeight).toBe('0')
    expect(above.style.flex).toBe('0 1 auto')
    expect(above.nextElementSibling).toBe(lines)
    expect(lines.style.minHeight).toBe('7rem')
    expect(win.querySelector('[data-test-box]')).toBeTruthy()
    expect(lines.compareDocumentPosition(win.querySelector('[data-test-box]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('draws no wrapper when no cut draws above the lines', () => {
    const win = open({ box: () => <div data-test-box>the reply box</div> })
    expect(win.querySelector('[data-thread-above]')).toBeNull()
    expect(win.querySelector('[data-test-box]')).toBeTruthy()
  })
})
