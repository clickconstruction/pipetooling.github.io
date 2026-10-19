// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/renderSmokeMocks'
import { DEMO_NOW } from '../../../../lib/messages/messagesDemo'
import { spineMessagesView } from '../../../../lib/messages/spineRows'
import type { JobTile } from '../../../../lib/messages/jobTiles'
import type { ReplyIo } from '../../../../lib/messages/replyIo'
import type { QuickReply } from '../../../../lib/quickReplies/kernel'
import type { QuickRepliesIo } from '../../../../lib/quickReplies/quickRepliesIo'
import { OpenThreadContext, type OpenThread } from '../openThread'
import { ReplyBox } from './ReplyBox'

// Send texts is on, so the Text tab draws its strip; the step they are on reads as nothing, so no read waits.
vi.mock('./useTextsOn', () => ({ useTextsOn: () => true }))
vi.mock('../../../../hooks/useFlowNow', () => ({ useFlowNow: () => null, openFlowStep: vi.fn() }))

const line = (id: string, text: string, set: Partial<QuickReply> = {}): QuickReply => ({
  id,
  text,
  for: 'customer',
  stepId: null,
  scope: 'team',
  addedBy: 'u-rosa',
  addedAt: Date.parse('2026-10-01T14:00:00.000Z'),
  removed: false,
  uses: {},
  lastUsed: null,
  ...set,
})

const LINES: QuickReply[] = [line('q-see', 'See you then, {first}.'), line('q-any', 'Got it, thank you.', { for: 'any' })]

// Cast, so the fake reads the same before and after the shortcut's io (#126 C) lands beside this file.
function fakeQuick(): QuickRepliesIo {
  return ({
    loadLines: vi.fn(() => Promise.resolve(LINES)),
    loadVersions: vi.fn(() => Promise.resolve({})),
    press: vi.fn(() => Promise.resolve()),
    add: vi.fn(() => Promise.resolve('q-new')),
    edit: vi.fn(() => Promise.resolve(1)),
    remove: vi.fn(() => Promise.resolve()),
    restore: vi.fn(() => Promise.resolve()),
    setPress: vi.fn(() => Promise.resolve(1)),
    setShortcut: vi.fn(() => Promise.resolve(1)),
  }) as QuickRepliesIo
}

const fakeIo = (): ReplyIo => ({
  loadSender: vi.fn(() => Promise.resolve({ name: 'Robert' })),
  addNote: vi.fn(() => Promise.resolve('m-note')),
  sendEmail: vi.fn(() => Promise.resolve('m-email')),
  sendText: vi.fn(() => Promise.resolve('m-text')),
})

/** A job's box as the Pipeline's sheet and the job window draw it: tied to the job, Text alone, the strip opened on the stage. */
function jobBox() {
  const quick = fakeQuick()
  const view = spineMessagesView()
  const contact = view.contacts.find((c) => c.kind === 'customer')!
  const open: OpenThread = {
    contact,
    lines: view.messages.filter((m) => m.contactId === contact.id),
    jobFilter: null,
    rail: view.rails[contact.id] ?? [],
    tiles: view.tiles,
    userNames: view.userNames,
    nowIso: DEMO_NOW,
    searchJobs: vi.fn(() => Promise.resolve([] as JobTile[])),
  }
  renderWithProviders(
    <OpenThreadContext.Provider value={open}>
      <ReplyBox contact={contact} io={fakeIo()} quickIo={quick} job={{ key: 'j-helotes', name: 'Helotes' }} kinds={['text']} stageStepIds={['done']} openStrip />
    </OpenThreadContext.Provider>,
  )
  const el = document.querySelector('[data-reply-box]') as HTMLElement
  return { quick, el }
}

const stripIds = (el: HTMLElement) => [...el.querySelectorAll('[data-qr-line]')].map((b) => b.getAttribute('data-qr-line'))

beforeEach(() => localStorage.clear())

describe('a job’s box opens its strip with every line, not the stage’s alone', () => {
  it('reads the team’s lines as soon as the strip opens on its own, so they show beside the stage’s line', async () => {
    const { quick, el } = jobBox()
    await waitFor(() => expect(stripIds(el)).toEqual(expect.arrayContaining(['q-see', 'q-any'])))
    expect(quick.loadLines).toHaveBeenCalledTimes(1)
    expect(stripIds(el)[0]).toBe('app:done')
  })

  it('reads nothing when the person folded the strip by hand', () => {
    localStorage.setItem('msgQrOpen', '0')
    const { quick, el } = jobBox()
    expect(el.querySelector('[data-qr-strip="folded"]')).toBeTruthy()
    expect(quick.loadLines).not.toHaveBeenCalled()
  })
})
