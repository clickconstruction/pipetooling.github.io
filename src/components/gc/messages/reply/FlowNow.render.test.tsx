// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/renderSmokeMocks'
import { DEMO_NOW } from '../../../../lib/messages/messagesDemo'
import { spineMessagesView } from '../../../../lib/messages/spineRows'
import type { JobTile } from '../../../../lib/messages/jobTiles'
import type { ReplyIo } from '../../../../lib/messages/replyIo'
import type { QuickReply } from '../../../../lib/quickReplies/kernel'
import type { QuickRepliesIo } from '../../../../lib/quickReplies/quickRepliesIo'
import { todayYmdInAppTz, ymdDaysBetween } from '../../../../utils/dateUtils'
import { OpenThreadContext, type OpenThread } from '../openThread'
import { ReplyBox } from './ReplyBox'

// Send texts is on here, so a text writes as it will once the owner turns it on (`ReplyBox.textsOn` holds the off box).
vi.mock('./useTextsOn', () => ({ useTextsOn: () => true }))

// Cut 4's read of the step a person is on, held still here: the smoke checks what the box does with it.
const flow = vi.hoisted(() => ({ now: undefined as unknown, open: vi.fn() }))
vi.mock('../../../../hooks/useFlowNow', () => ({ useFlowNow: () => flow.now, openFlowStep: (...a: unknown[]) => flow.open(...a) }))

const SINCE = '2026-10-01'
const ASK = { stepId: 'ask', jobId: null, stepName: 'Asked to quote', who: 'us' as const, sinceYmd: SINCE, finishes: 'their quote is in the portal or they declined to quote' }

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
const LINES = [line('q3', 'Checking on the number. Still good for today?', { stepId: 'ask' }), line('q2', 'Did the invite come through?', { stepId: 'invited' })]

const quickIo = (): QuickRepliesIo => ({
  loadLines: vi.fn(() => Promise.resolve(LINES)),
  loadVersions: vi.fn(() => Promise.resolve({})),
  press: vi.fn(() => Promise.resolve()),
  add: vi.fn(() => Promise.resolve('q')),
  edit: vi.fn(() => Promise.resolve(1)),
  remove: vi.fn(() => Promise.resolve()),
  restore: vi.fn(() => Promise.resolve()),
  setPress: vi.fn(() => Promise.resolve(1)),
})
const io = (): ReplyIo => ({
  loadSender: vi.fn(() => Promise.resolve({ name: 'Robert' })),
  addNote: vi.fn(() => Promise.resolve('m')),
  sendEmail: vi.fn(() => Promise.resolve('m')),
  sendText: vi.fn(() => Promise.resolve('m')),
})

function box() {
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
      <ReplyBox contact={contact} io={io()} quickIo={quickIo()} />
    </OpenThreadContext.Provider>,
  )
  return document.querySelector('[data-reply-box]') as HTMLElement
}

async function findWindow(el: HTMLElement) {
  fireEvent.click(within(el).getByRole('button', { name: /Quick replies/ }))
  fireEvent.click(await within(el).findByRole('button', { name: '⤢ Find' }))
  return screen.findByRole('dialog', { name: 'Find a reply · Greg Paulk' })
}

beforeEach(() => {
  localStorage.clear()
  flow.now = undefined
  flow.open = vi.fn()
})

describe('the step a person is on, in the quick replies (Messages, cut 3 with cut 4)', () => {
  it('puts the lines for their step first in the strip, named by the live flow', async () => {
    flow.now = ASK
    const el = box()
    fireEvent.click(within(el).getByRole('button', { name: /Quick replies/ }))
    await waitFor(() => expect(el.querySelector('[data-qr-line="q3"]')).toBeTruthy())
    const first = el.querySelector('[data-qr-group="0"]') as HTMLElement
    expect(first.textContent).toContain('Asked to quote: the step they are on')
    expect(first.querySelector('[data-qr-line="q3"]')).toBeTruthy()
  })

  it('says where they are in Find a reply, how long on it, and what finishes it, with the step’s card', async () => {
    flow.now = ASK
    const win = await findWindow(box())
    const where = win.querySelector('[data-find-where]') as HTMLElement
    const days = ymdDaysBetween(SINCE, todayYmdInAppTz())
    expect(where.textContent).toContain(`Asked to quote · our move · on it ${days} day${days === 1 ? '' : 's'}.`)
    expect(where.textContent).toContain('Their quote is in the portal or they declined to quote finishes it.')
    fireEvent.click(within(where).getByRole('button', { name: 'the step’s card ›' }))
    expect(flow.open).toHaveBeenCalledWith('c-greg', 'ask', null)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Find a reply · Greg Paulk' })).toBeNull())
  })

  it('says nothing on now with no step, and offers no card', async () => {
    flow.now = null
    const win = await findWindow(box())
    const where = win.querySelector('[data-find-where]') as HTMLElement
    expect(where.textContent).toContain('Nothing on now.')
    expect(within(where).queryByRole('button', { name: 'the step’s card ›' })).toBeNull()
  })

  it('says nothing about where they are while the flow is still read', async () => {
    flow.now = undefined
    const win = await findWindow(box())
    expect(win.querySelector('[data-find-where]')).toBeNull()
  })
})
