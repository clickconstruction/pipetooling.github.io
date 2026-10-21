// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/renderSmokeMocks'
import { DEMO_NOW } from '../../../../lib/messages/messagesDemo'
import { spineMessagesView } from '../../../../lib/messages/spineRows'
import type { JobTile } from '../../../../lib/messages/jobTiles'
import type { ReplyIo } from '../../../../lib/messages/replyIo'
import type { QuickReply } from '../../../../lib/quickReplies/kernel'
import type { QuickRepliesIo } from '../../../../lib/quickReplies/quickRepliesIo'
import { SLASH_HINT, SLASH_NONE } from '../../../../lib/quickReplies/slash'
import { OpenThreadContext, type OpenThread } from '../openThread'
import { ReplyBox } from './ReplyBox'

// Send texts is on, so the Text tab draws its box; the step they are on reads as nothing, so no read waits.
vi.mock('./useTextsOn', () => ({ useTextsOn: () => true }))
vi.mock('../../../../hooks/useFlowNow', () => ({ useFlowNow: () => null, openFlowStep: vi.fn() }))

const line = (id: string, text: string, set: Partial<QuickReply> = {}): QuickReply => ({
  id,
  text,
  for: 'trade',
  stepId: null,
  scope: 'team',
  addedBy: 'u-rosa',
  addedAt: Date.parse('2026-09-12T14:00:00.000Z'),
  removed: false,
  uses: {},
  lastUsed: null,
  ...set,
})

const LINES: QuickReply[] = [
  line('q3', 'Checking on the number. Still good for today?', { uses: { 'u-rosa': 23 } }),
  line('q2', 'Did the invite come through?', { uses: { 'u-rosa': 14 } }),
  line('q14', 'Got it, thank you.', { for: 'any', uses: { 'u-rosa': 30 } }),
  line('q4', 'Understood. You will have it by 9 AM Thursday.', { for: 'customer' }),
  line('q8', 'The site is open from 7.', { removed: true }),
]

function fakeQuick(lines: QuickReply[] = LINES): QuickRepliesIo {
  return {
    loadLines: vi.fn(() => Promise.resolve(lines)),
    loadVersions: vi.fn(() => Promise.resolve({})),
    press: vi.fn(() => Promise.resolve()),
    add: vi.fn(() => Promise.resolve('q-new')),
    edit: vi.fn(() => Promise.resolve(1)),
    remove: vi.fn(() => Promise.resolve()),
    restore: vi.fn(() => Promise.resolve()),
    setPress: vi.fn(() => Promise.resolve(1)),
    setShortcut: vi.fn(() => Promise.resolve(1)),
  }
}

const fakeIo = (): ReplyIo => ({
  loadSender: vi.fn(() => Promise.resolve({ name: 'Robert' })),
  addNote: vi.fn(() => Promise.resolve('m-note')),
  sendEmail: vi.fn(() => Promise.resolve('m-email')),
  sendText: vi.fn(() => Promise.resolve('m-text')),
  logCall: vi.fn(() => Promise.resolve('m-call-new')),
})

function box(quick: QuickRepliesIo = fakeQuick()) {
  const view = spineMessagesView()
  const contact = view.contacts.find((c) => c.id === 'c-greg')!
  const open: OpenThread = {
    contact,
    lines: view.messages.filter((m) => m.contactId === 'c-greg'),
    jobFilter: null,
    rail: view.rails['c-greg'] ?? [],
    tiles: view.tiles,
    userNames: view.userNames,
    nowIso: DEMO_NOW,
    searchJobs: vi.fn(() => Promise.resolve([] as JobTile[])),
  }
  renderWithProviders(
    <OpenThreadContext.Provider value={open}>
      <ReplyBox contact={contact} io={fakeIo()} quickIo={quick} />
    </OpenThreadContext.Provider>,
  )
  const el = document.querySelector('[data-reply-box]') as HTMLElement
  const textbox = within(el).getByRole('textbox', { name: 'Write to Greg Paulk' }) as HTMLTextAreaElement
  return { quick, el, textbox }
}

const type = (textbox: HTMLTextAreaElement, value: string) => fireEvent.change(textbox, { target: { value } })
const rowIds = (el: HTMLElement) => [...el.querySelectorAll('[data-slash-line]')].map((r) => r.getAttribute('data-slash-line'))
const litId = (el: HTMLElement) => el.querySelector('[data-slash-line][aria-selected="true"]')?.getAttribute('data-slash-line')

const heardByWindow = vi.fn()
beforeEach(() => {
  localStorage.clear()
  heardByWindow.mockClear()
  window.addEventListener('keydown', heardByWindow)
})
afterEach(() => window.removeEventListener('keydown', heardByWindow))

describe('quick replies by keyboard: the / list in the reply box (punch list #126)', () => {
  it('says so in the box, and reads no line until a / is typed', () => {
    const { textbox, quick } = box()
    expect(textbox.placeholder).toContain(SLASH_HINT)
    type(textbox, 'Hello there')
    expect(quick.loadLines).not.toHaveBeenCalled()
  })

  it('opens on a / with their kind’s lines and anyone’s, in the strip’s order, the first lit', async () => {
    const { el, textbox, quick } = box()
    type(textbox, '/')
    await waitFor(() => expect(rowIds(el)).toEqual(['q3', 'q2', 'q14']))
    expect(quick.loadLines).toHaveBeenCalledTimes(1)
    expect(litId(el)).toBe('q3')
    const list = el.querySelector('[data-slash-list]') as HTMLElement
    expect(list.textContent).toContain('Quick replies for Greg')
    expect(list.querySelector('[data-slash-count]')?.textContent).toBe('3 of 3')
    // The list sits above the box, and the box names the lit row.
    expect(list.compareDocumentPosition(textbox) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(textbox.getAttribute('aria-activedescendant')).toBe(el.querySelector('[data-slash-line="q3"]')?.id)
  })

  it('narrows by the words after the /, and Enter puts the line in place of the / word, counted as a press', async () => {
    const { el, textbox, quick } = box()
    type(textbox, 'Hi Greg. /invite')
    await waitFor(() => expect(rowIds(el)).toEqual(['q2']))
    fireEvent.keyDown(textbox, { key: 'Enter' })
    expect(textbox.value).toBe('Hi Greg. Did the invite come through?')
    expect(el.querySelector('[data-slash-list]')).toBeNull()
    expect(quick.press).toHaveBeenCalledWith('q2', 'c-greg')
  })

  it('moves with ↓ and ↑ round the ends, and Tab picks the lit row', async () => {
    const { el, textbox } = box()
    type(textbox, '/')
    await waitFor(() => expect(rowIds(el)).toHaveLength(3))
    fireEvent.keyDown(textbox, { key: 'ArrowDown' })
    expect(litId(el)).toBe('q2')
    fireEvent.keyDown(textbox, { key: 'ArrowUp' })
    fireEvent.keyDown(textbox, { key: 'ArrowUp' })
    expect(litId(el)).toBe('q14')
    fireEvent.keyDown(textbox, { key: 'Tab' })
    expect(textbox.value).toBe('Got it, thank you.')
  })

  it('puts the line whose shortcut is typed first, with its / word (C)', async () => {
    const keyed = LINES.map((q) => (q.id === 'q14' ? { ...q, shortcut: 'thx' } : q))
    const { el, textbox } = box(fakeQuick(keyed))
    type(textbox, '/th')
    await waitFor(() => expect(rowIds(el)[0]).toBe('q14'))
    expect(el.querySelector('[data-slash-line="q14"] [data-slash-shortcut]')?.textContent).toBe('/thx')
    type(textbox, '/thx')
    await waitFor(() => expect(rowIds(el)).toEqual(['q14']))
    fireEvent.keyDown(textbox, { key: 'Enter' })
    expect(textbox.value).toBe('Got it, thank you.')
  })

  it('picks a row pressed with the mouse', async () => {
    const { el, textbox, quick } = box()
    type(textbox, '/')
    await waitFor(() => expect(rowIds(el)).toHaveLength(3))
    fireEvent.mouseDown(el.querySelector('[data-slash-line="q14"]')!)
    expect(textbox.value).toBe('Got it, thank you.')
    expect(quick.press).toHaveBeenCalledWith('q14', 'c-greg')
  })

  it('Escape closes the list and keeps the words, and the window around the box does not hear it', async () => {
    const { el, textbox } = box()
    type(textbox, '/che')
    await waitFor(() => expect(rowIds(el)).toEqual(['q3']))
    fireEvent.keyDown(textbox, { key: 'Escape' })
    expect(el.querySelector('[data-slash-list]')).toBeNull()
    expect(textbox.value).toBe('/che')
    expect(heardByWindow).not.toHaveBeenCalled()
    // Closed, Escape is the window's again; and a new / word opens the list once more.
    fireEvent.keyDown(textbox, { key: 'Escape' })
    expect(heardByWindow).toHaveBeenCalledTimes(1)
    type(textbox, '/che /')
    await waitFor(() => expect(rowIds(el)).toHaveLength(3))
  })

  it('says when no line has the words, and Enter is a plain line break then', async () => {
    const { el, textbox, quick } = box()
    type(textbox, '/zzz')
    await waitFor(() => expect(el.querySelector('[data-slash-none]')?.textContent).toBe(SLASH_NONE))
    fireEvent.keyDown(textbox, { key: 'Enter' })
    expect(textbox.value).toBe('/zzz')
    expect(quick.press).not.toHaveBeenCalled()
  })

  it('opens nothing for a / inside a word or with a space after it', () => {
    const { el, textbox, quick } = box()
    type(textbox, 'A 1/2 inch line and/or a 3/4')
    type(textbox, 'Back on 10/19 / maybe')
    expect(el.querySelector('[data-slash-list]')).toBeNull()
    expect(quick.loadLines).not.toHaveBeenCalled()
  })

  it('offers no list in a note for the team', () => {
    const { el, quick } = box()
    fireEvent.click(within(el).getByRole('radio', { name: 'Note' }))
    const note = within(el).getByRole('textbox', { name: 'A note for the team' }) as HTMLTextAreaElement
    expect(note.placeholder).not.toContain(SLASH_HINT)
    type(note, '/')
    expect(el.querySelector('[data-slash-list]')).toBeNull()
    expect(quick.loadLines).not.toHaveBeenCalled()
  })
})
