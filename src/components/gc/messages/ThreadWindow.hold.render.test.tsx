// @vitest-environment jsdom
/**
 * Press and hold a line to tie it (Messages cut 10, P3, `phone-mockups.html` screen 1b): on a phone a hold on a line,
 * or a press on its *no job*, opens *Tie this message to*. Their jobs come with the one their new messages land on first,
 * and the line's own job is marked. *Another job…* opens the picker, and a tied line can be untied. The line darkens once
 * the hold is long enough and the sheet opens as the finger lifts. A finger that travels is a scroll. At a desk a hold
 * does nothing and *no job* opens the picker, as before. Greg Paulk from the spine's demo rows: his star is #42.
 */
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { LONG_PRESS_MS } from '../../../hooks/useLongPress'
import type { JobTile } from '../../../lib/messages/jobTiles'
import { DEMO_NOW } from '../../../lib/messages/messagesDemo'
import { spineMessagesView } from '../../../lib/messages/spineRows'
import { resetModalStackForTests } from '../../../lib/modalStack'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import { PHONE_SHEET_QUERY } from '../../PhoneSheet'
import type { MessagesWrites } from './messagesWrites'
import { ThreadWindow } from './ThreadWindow'

const realMatchMedia = window.matchMedia

/**
 * jsdom has no PointerEvent, so a press arrives as a bare Event with no button and `useLongPress` ignores it. This is the
 * part of the real thing it reads (`HubPeopleDayCell.gestures.render.test.tsx` does the same).
 */
class TestPointerEvent extends MouseEvent {
  readonly pointerId: number
  readonly isPrimary: boolean
  readonly pointerType: string
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init)
    this.pointerId = init.pointerId ?? 1
    this.isPrimary = init.isPrimary ?? true
    this.pointerType = init.pointerType ?? 'touch'
  }
}
const realPointerEvent = (globalThis as { PointerEvent?: unknown }).PointerEvent
beforeAll(() => {
  vi.stubGlobal('PointerEvent', TestPointerEvent)
  ;(window as unknown as { PointerEvent: unknown }).PointerEvent = TestPointerEvent
})
afterAll(() => {
  vi.unstubAllGlobals()
  ;(window as unknown as { PointerEvent: unknown }).PointerEvent = realPointerEvent
})

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
  const w = writes()
  renderWithProviders(<ThreadWindow contactId="c-greg" onClose={vi.fn()} slots={{}} view={spineMessagesView()} nowIso={DEMO_NOW} writes={w} />)
  const win = screen.getByRole('dialog', { name: 'Greg Paulk: messages' })
  return { w, line: (id: string) => win.querySelector(`[data-thread-line="${id}"]`) as HTMLElement }
}
const pointer = (x: number, y: number) => ({ clientX: x, clientY: y, button: 0, isPrimary: true, pointerId: 1, bubbles: true })

/** A press and hold of `ms`, travelling `travel` px, then the lift and the click a lift brings. */
function hold(el: HTMLElement, ms = LONG_PRESS_MS, travel = 0) {
  fireEvent.pointerDown(el, pointer(40, 40))
  if (travel > 0) fireEvent.pointerMove(el, pointer(40, 40 + travel))
  act(() => {
    vi.advanceTimersByTime(ms)
  })
  const darkened = el.hasAttribute('data-holding')
  fireEvent.pointerUp(el, pointer(40, 40 + travel))
  fireEvent.click(el)
  return darkened
}
const sheet = () => screen.queryByRole('dialog', { name: 'Tie this message to' })

beforeEach(() => {
  resetModalStackForTests()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  window.matchMedia = realMatchMedia
})

describe('press and hold a line to tie it, on a phone (cut 10)', () => {
  beforeEach(() => screenIs(true))

  it('darkens the held line, opens the sheet as it lifts, and the lift’s click opens nothing else', () => {
    const { w, line } = open()
    expect(hold(line('m-greg-odd-optout'))).toBe(true)
    const tie = sheet()
    expect(tie).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: /^Text/ })).toBeNull()
    expect(line('m-greg-odd-optout').hasAttribute('data-holding')).toBe(false)
    const rows = within(tie as HTMLElement)
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-label') !== 'Close')
      .map((b) => b.textContent)
    expect(rows.slice(0, 2)).toEqual([expect.stringMatching(/^★#42 Stone Oak Pharmacy/), expect.stringMatching(/^B482 Boerne Retail Shell/)])
    expect(rows.slice(2)).toEqual(['Another job…', 'Cancel'])
    fireEvent.click(within(tie as HTMLElement).getByRole('button', { name: /^B482 Boerne Retail Shell/ }))
    expect(w.tieMessage).toHaveBeenCalledWith('m-greg-odd-optout', 'bid:bid-boerne')
    expect(sheet()).toBeNull()
  })

  it('marks the job a tied line is on and unties it, the line staying on Greg', () => {
    const { w, line } = open()
    hold(line('m-greg-text-in'))
    const tie = sheet() as HTMLElement
    const here = within(tie).getByRole('button', { name: /^B482 Boerne Retail Shell/ })
    expect([here.getAttribute('aria-pressed'), here.textContent]).toEqual(['true', 'B482 Boerne Retail Shelltied here now'])
    fireEvent.click(within(tie).getByRole('button', { name: /^Untie it/ }))
    expect(w.tieMessage).toHaveBeenCalledWith('m-greg-text-in', null)
  })

  it('opens the same sheet from no job, and Another job opens the picker', () => {
    const { line } = open()
    fireEvent.click(within(line('m-greg-odd-optout')).getByRole('button', { name: 'no job' }))
    fireEvent.click(within(sheet() as HTMLElement).getByRole('button', { name: 'Another job…' }))
    expect(sheet()).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Tie this line to a job' })).toBeTruthy()
  })

  it('takes a short press as opening the line, and a finger that travels as a scroll', () => {
    const { line } = open()
    expect(hold(line('m-greg-odd-optout'), LONG_PRESS_MS, 24)).toBe(false)
    expect(sheet()).toBeNull()
    expect(hold(line('m-greg-odd-optout'), 120)).toBe(false)
    expect(sheet()).toBeNull()
    expect(screen.getByRole('dialog', { name: /^Text/ })).toBeTruthy()
  })
})

describe('at a desk', () => {
  beforeEach(() => screenIs(false))

  it('a hold does nothing, and no job opens the picker as before', () => {
    const { line } = open()
    expect(hold(line('m-greg-odd-optout'))).toBe(false)
    expect(sheet()).toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(within(line('m-greg-odd-optout')).getByRole('button', { name: 'no job' }))
    expect(screen.getByRole('dialog', { name: 'Tie this line to a job' })).toBeTruthy()
  })
})
