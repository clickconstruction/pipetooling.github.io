// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/renderSmokeMocks'
import { BOERNE } from '../../../../test/fixtures/jobFilesDemo'
import { jobFiles } from '../../../../lib/documents/jobFiles'
import type { AttachIo } from '../../../../lib/messages/attachIo'
import { DEMO_NOW } from '../../../../lib/messages/messagesDemo'
import { spineMessagesView } from '../../../../lib/messages/spineRows'
import type { JobTile } from '../../../../lib/messages/jobTiles'
import type { ReplyIo } from '../../../../lib/messages/replyIo'
import type { PapersIo } from '../../../../lib/messages/papersIo'
import type { QuickReply } from '../../../../lib/quickReplies/kernel'
import type { QuickRepliesIo } from '../../../../lib/quickReplies/quickRepliesIo'
import { OpenThreadContext, type OpenThread } from '../openThread'
import { MessagesRereadContext } from '../useMessagesReread'
import { ReplyBox } from './ReplyBox'

// The box reads no papers here: its bills and estimates are ReplyBox.papers.render.test.tsx's, and without a stub the
// read goes through the real client (v2.6436).
const noPapers: PapersIo = { load: () => Promise.resolve([]) }

// Send texts is on here, so a text writes as it will once the owner turns it on (`ReplyBox.textsOn` holds the off box).
vi.mock('./useTextsOn', () => ({ useTextsOn: () => true }))
vi.mock('../../../../hooks/useFlowNow', () => ({ useFlowNow: () => null, openFlowStep: vi.fn() }))

/**
 * v2.6504: a press anywhere in the thread that is not the reply box folds it to one row, on every window height, with
 * the words typed kept; a press into the box or on a kind opens it whole again. A press on one of the box's own
 * controls, Attach and its sheet or a quick reply, never folds it (v2.6477's reason stays: a fold must never pull the
 * control out from under the press).
 */

const fakeIo = (): ReplyIo => ({
  loadSender: vi.fn(() => Promise.resolve({ name: 'Robert' })),
  addNote: vi.fn(() => Promise.resolve('m-note')),
  sendEmail: vi.fn(() => Promise.resolve('m-email')),
  sendText: vi.fn(() => Promise.resolve('m-text')),
  logCall: vi.fn(() => Promise.resolve('m-call-new')),
})

const LINES: QuickReply[] = [
  { id: 'q3', text: 'Checking on the number. Still good for today?', for: 'trade', stepId: 'ask', scope: 'team', addedBy: 'u-rosa', addedAt: Date.parse('2026-09-12T14:00:00.000Z'), removed: false, uses: { 'u-rosa': 23 }, lastUsed: null },
]

const fakeQuick = (): QuickRepliesIo => ({
  loadLines: vi.fn(() => Promise.resolve(LINES)),
  loadVersions: vi.fn(() => Promise.resolve({})),
  press: vi.fn(() => Promise.resolve()),
  add: vi.fn(() => Promise.resolve('q-new')),
  edit: vi.fn(() => Promise.resolve(1)),
  remove: vi.fn(() => Promise.resolve()),
  restore: vi.fn(() => Promise.resolve()),
  setPress: vi.fn(() => Promise.resolve(1)),
  setShortcut: vi.fn(() => Promise.resolve(1)),
})

const fakeAttach = (): AttachIo => ({
  loadJobFiles: vi.fn(() => Promise.resolve({ files: jobFiles(BOERNE), driveFailed: false })),
  hasPortal: vi.fn(() => Promise.resolve(true)),
  readDevice: vi.fn(() => Promise.resolve({ base64: 'JVBERi0=', mime: 'application/pdf' })),
})

/** The thread window around the box: a line of the person's above it, which a press lands on, and the box at the foot. */
function thread(more: { short?: boolean } = {}) {
  const io = fakeIo()
  const view = spineMessagesView()
  const contact = view.contacts.find((c) => c.id === 'c-greg')!
  const open: OpenThread = {
    contact,
    lines: view.messages.filter((m) => m.contactId === 'c-greg'),
    jobFilter: 'bid:bid-boerne',
    rail: view.rails['c-greg'] ?? [],
    tiles: view.tiles,
    userNames: view.userNames,
    nowIso: DEMO_NOW,
    searchJobs: vi.fn(() => Promise.resolve([] as JobTile[])),
    ...(more.short ? { foldBox: true } : null),
  }
  renderWithProviders(
    <MessagesRereadContext.Provider value={vi.fn()}>
      <OpenThreadContext.Provider value={open}>
        <div data-thread-line>Greg: the pad is ready.</div>
        <ReplyBox papersIo={noPapers} contact={contact} io={io} quickIo={fakeQuick()} attachIo={fakeAttach()} />
      </OpenThreadContext.Provider>
    </MessagesRereadContext.Provider>,
  )
  const el = document.querySelector('[data-reply-box]') as HTMLElement
  const line = document.querySelector('[data-thread-line]') as HTMLElement
  const field = () => within(el).getByRole('textbox', { name: 'Write to Greg Paulk' }) as HTMLTextAreaElement
  const folded = () => el.getAttribute('data-reply-fold') === 'folded'
  const type = (words: string) => {
    fireEvent.focus(field())
    fireEvent.change(field(), { target: { value: words } })
  }
  return { io, el, line, field, folded, type }
}

beforeEach(() => {
  localStorage.clear()
})

describe('a press outside the reply box folds it (v2.6504)', () => {
  it('on a tall window: whole until a press on the thread, then one row with the words kept', () => {
    const t = thread()
    expect(t.folded()).toBe(false)
    t.type('Rusty,')
    expect(t.folded()).toBe(false)
    fireEvent.click(t.line)
    expect(t.folded()).toBe(true)
    expect(t.field().rows).toBe(1)
    expect(t.field().value).toBe('Rusty,')
    expect(within(t.el).queryByRole('button', { name: 'Send text…' })).toBeNull()
  })

  it('a press into the one-line box opens it whole again, the words still there', () => {
    const t = thread()
    t.type('Rusty,')
    fireEvent.click(t.line)
    expect(t.folded()).toBe(true)
    fireEvent.click(t.field())
    expect(t.folded()).toBe(false)
    expect(t.field().rows).toBe(3)
    expect(t.field().value).toBe('Rusty,')
    expect(within(t.el).getByRole('button', { name: 'Send text…' })).toBeTruthy()
  })

  it('a press on a kind opens it too', () => {
    const t = thread()
    t.type('Rusty,')
    fireEvent.click(t.line)
    fireEvent.click(within(t.el).getByRole('radio', { name: 'Email' }))
    expect(t.folded()).toBe(false)
  })

  it('on a short window the press folds it with the words kept, where a blank box folded already', () => {
    const t = thread({ short: true })
    expect(t.folded()).toBe(true)
    t.type('Rusty,')
    expect(t.folded()).toBe(false)
    fireEvent.click(t.line)
    expect(t.folded()).toBe(true)
    expect(t.field().value).toBe('Rusty,')
  })

  it('a press on Attach, on a file in its sheet and on the chip’s × never folds it', async () => {
    const t = thread()
    t.type('Rusty,')
    fireEvent.click(within(t.el).getByRole('button', { name: 'Attach' }))
    const win = await screen.findByRole('dialog', { name: 'Attach a file' })
    expect(t.folded()).toBe(false)
    await waitFor(() => expect(win.querySelector('[data-attach-row]')).toBeTruthy())
    // The row closes the sheet under its own press: the pressed control has left the tree, and still counts as inside.
    fireEvent.click(within(win).getByRole('button', { name: /^Addendum 2\.pdf/ }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Attach a file' })).toBeNull())
    expect(t.folded()).toBe(false)
    expect(t.el.querySelectorAll('[data-reply-file]')).toHaveLength(1)
    // A file waiting keeps the box whole under a press outside, as the kernel says.
    fireEvent.click(t.line)
    expect(t.folded()).toBe(false)
    fireEvent.click(within(t.el).getByRole('button', { name: 'Take Addendum 2.pdf off the message' }))
    expect(t.el.querySelector('[data-reply-files]')).toBeNull()
    expect(t.folded()).toBe(false)
  })

  it('a press on Quick replies and on one of its lines never folds it', async () => {
    const t = thread()
    t.type('')
    fireEvent.click(within(t.el).getByRole('button', { name: /Quick replies/ }))
    await waitFor(() => expect(t.el.querySelector('[data-qr-line="q3"]')).toBeTruthy())
    expect(t.folded()).toBe(false)
    fireEvent.click(t.el.querySelector('[data-qr-line="q3"]') as HTMLElement)
    expect(t.field().value).toBe('Checking on the number. Still good for today?')
    expect(t.folded()).toBe(false)
  })

  it('after a send the box is back to how the window opened it: whole on a tall window, folded on a short one', async () => {
    const tall = thread()
    tall.type('Rusty,')
    fireEvent.click(tall.line)
    expect(tall.folded()).toBe(true)
    fireEvent.click(tall.field())
    fireEvent.click(within(tall.el).getByRole('radio', { name: 'Note' }))
    fireEvent.change(within(tall.el).getByRole('textbox', { name: 'A note for the team' }), { target: { value: 'Greg says the pad is ready.' } })
    fireEvent.click(within(tall.el).getByRole('button', { name: 'Add the note' }))
    await waitFor(() => expect(tall.io.addNote).toHaveBeenCalled())
    await waitFor(() => expect(within(tall.el).getByRole('button', { name: 'Add the note' })).toBeTruthy())
    expect(tall.folded()).toBe(false)
  })

  it('a note sent on a short window folds it, as before', async () => {
    const t = thread({ short: true })
    fireEvent.click(within(t.el).getByRole('radio', { name: 'Note' }))
    fireEvent.change(within(t.el).getByRole('textbox', { name: 'A note for the team' }), { target: { value: 'Greg says the pad is ready.' } })
    fireEvent.click(within(t.el).getByRole('button', { name: 'Add the note' }))
    await waitFor(() => expect(t.io.addNote).toHaveBeenCalled())
    await waitFor(() => expect(t.folded()).toBe(true))
  })
})
