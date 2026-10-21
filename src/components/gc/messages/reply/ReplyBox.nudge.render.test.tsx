// @vitest-environment jsdom
/**
 * Punch list #140 PR 4: a nudge opens the box with the step's reminder written and the send window open. Over a fake io
 * and a fake flow read: the words go in and the window opens once, as a text, showing the words; a number that sent STOP
 * falls to an email; no step gives the plain check-in; with no way to send, the words wait in the box and nothing opens.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/renderSmokeMocks'
import { DEMO_NOW } from '../../../../lib/messages/messagesDemo'
import { spineMessagesView } from '../../../../lib/messages/spineRows'
import type { JobTile } from '../../../../lib/messages/jobTiles'
import type { ReplyIo } from '../../../../lib/messages/replyIo'
import type { QuickRepliesIo } from '../../../../lib/quickReplies/quickRepliesIo'
import type { FlowNow } from '../../../../lib/flows/now'
import type { Contact } from '../../../../lib/contacts/kernel'
import { OpenThreadContext, type OpenThread } from '../openThread'
import { MessagesRereadContext } from '../useMessagesReread'
import { ReplyBox } from './ReplyBox'

vi.mock('./useTextsOn', () => ({ useTextsOn: () => true }))
// The step on now, as cut 4's read would give it: Greg asked to quote, or on no step.
const flow = vi.hoisted(() => ({ now: null as FlowNow | null | undefined }))
vi.mock('../../../../hooks/useFlowNow', () => ({ useFlowNow: () => flow.now, openFlowStep: vi.fn(), useOpenFlowStep: vi.fn() }))

const ASK: FlowNow = { stepId: 'ask', jobId: null, stepName: 'Asked to quote', who: 'them', sinceYmd: '2026-10-15', finishes: 'their quote is in', papers: [] }
const ASK_WORDS = 'Greg, checking on the number. Still good for the day you gave us?'

const fakeIo = (): ReplyIo => ({
  loadSender: vi.fn(() => Promise.resolve({ name: 'Robert' })),
  addNote: vi.fn(() => Promise.resolve('m-note-new')),
  sendEmail: vi.fn(() => Promise.resolve('m-email-new')),
  sendText: vi.fn(() => Promise.resolve('m-text-new')),
  logCall: vi.fn(() => Promise.resolve('m-call-new')),
})
const fakeQuick = (): QuickRepliesIo => ({
  loadLines: vi.fn(() => Promise.resolve([])),
  loadVersions: vi.fn(() => Promise.resolve({})),
  press: vi.fn(() => Promise.resolve()),
  add: vi.fn(() => Promise.resolve('q')),
  edit: vi.fn(() => Promise.resolve(1)),
  remove: vi.fn(() => Promise.resolve()),
  restore: vi.fn(() => Promise.resolve()),
  setPress: vi.fn(() => Promise.resolve(1)),
  setShortcut: vi.fn(() => Promise.resolve(1)),
})

function box(more: { nudge?: 'text' | 'email'; stop?: boolean; noWay?: boolean } = {}) {
  const view = spineMessagesView()
  const found = view.contacts.find((c) => c.id === 'c-greg')!
  const channels = more.noWay
    ? found.channels.filter((ch) => ch.kind !== 'email').map((ch) => (ch.kind === 'phone' ? { ...ch, optedOutAt: '2026-09-01T00:00:00.000Z' } : ch))
    : more.stop
      ? found.channels.map((ch) => (ch.kind === 'phone' ? { ...ch, optedOutAt: '2026-09-01T00:00:00.000Z' } : ch))
      : found.channels
  const contact: Contact = { ...found, channels }
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
    <MessagesRereadContext.Provider value={vi.fn()}>
      <OpenThreadContext.Provider value={open}>
        <ReplyBox contact={contact} io={fakeIo()} quickIo={fakeQuick()} nudge={more.nudge ?? null} />
      </OpenThreadContext.Provider>
    </MessagesRereadContext.Provider>,
  )
  return { el: document.querySelector('[data-reply-box]') as HTMLElement }
}

const typed = (el: HTMLElement) => (within(el).getByRole('textbox', { name: 'Write to Greg Paulk' }) as HTMLTextAreaElement).value

afterEach(() => {
  cleanup()
  flow.now = null
})

describe('ReplyBox: a nudge opens the send window with the step’s reminder (punch list #140 PR 4)', { timeout: 15_000 }, () => {
  it('writes the step’s reminder and opens the send window once, as a text', async () => {
    flow.now = ASK
    const { el } = box({ nudge: 'text' })
    const win = await screen.findByRole('dialog', { name: 'Before it goes, this is what they see' })
    expect(within(win).getByText(ASK_WORDS)).toBeTruthy()
    expect(within(win).getByRole('button', { name: 'Send as text' })).toBeTruthy()
    expect(typed(el)).toBe(ASK_WORDS)
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })

  it('falls to an email when the number sent STOP', async () => {
    flow.now = ASK
    const { el } = box({ nudge: 'text', stop: true })
    const win = await screen.findByRole('dialog', { name: 'Before it goes, this is what they see' })
    expect(within(win).getByRole('button', { name: 'Send as email' })).toBeTruthy()
    expect(win.getAttribute('data-send-window')).toBe('email')
    expect(typed(el)).toBe(ASK_WORDS)
  })

  it('opens as an email when asked, and checks in plainly on no step', async () => {
    flow.now = null
    const { el } = box({ nudge: 'email' })
    const win = await screen.findByRole('dialog', { name: 'Before it goes, this is what they see' })
    expect(within(win).getByRole('button', { name: 'Send as email' })).toBeTruthy()
    expect(typed(el)).toBe('Greg, checking in. Anything you need from us?')
  })

  it('with no way to send, the words wait in the box and nothing opens', async () => {
    flow.now = ASK
    const { el } = box({ nudge: 'text', noWay: true })
    await waitFor(() => expect(typed(el)).toBe(ASK_WORDS))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens nothing without a nudge', async () => {
    flow.now = ASK
    const { el } = box()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(typed(el)).toBe('')
  })
})
