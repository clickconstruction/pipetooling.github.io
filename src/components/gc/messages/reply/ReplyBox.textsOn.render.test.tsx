// @vitest-environment jsdom
/**
 * Messages, cut 5: the reply box over the texts switch (Settings → Phone and texts → Send texts). While the switch reads
 * off, the Text tab draws the wait line in place of the strip, the box and the send row, in the thread window's box and
 * the job window's alike; Email writes as before. Once it reads on, or while it is still being read, the box draws as it
 * always has.
 */
import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, within } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/renderSmokeMocks'
import type { Contact } from '../../../../lib/contacts/kernel'
import { DEMO_NOW } from '../../../../lib/messages/messagesDemo'
import { spineMessagesView } from '../../../../lib/messages/spineRows'
import type { JobTile } from '../../../../lib/messages/jobTiles'
import type { ReplyKind } from '../../../../lib/messages/compose'
import { TEXTS_WAIT, type ReplyIo } from '../../../../lib/messages/replyIo'
import { OpenThreadContext, type OpenThread } from '../openThread'
import { MessagesRereadContext } from '../useMessagesReread'
import { ReplyBox } from './ReplyBox'

const switchRead = vi.hoisted(() => ({ on: false as boolean | null }))
vi.mock('./useTextsOn', () => ({ useTextsOn: () => switchRead.on }))
vi.mock('../../../../hooks/useFlowNow', () => ({ useFlowNow: () => null, openFlowStep: vi.fn() }))
// The smoke's dev can flip the switch, so the wait line carries the link (`TextsWaitLine.render.test.tsx` has the other words).
vi.mock('../../../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

const WAIT = TEXTS_WAIT

function fakeIo(): ReplyIo {
  return {
    loadSender: vi.fn(() => Promise.resolve({ name: 'Robert', title: 'Project manager', cell: '(210) 555-0142' })),
    addNote: vi.fn(() => Promise.resolve('m-note-new')),
    sendEmail: vi.fn(() => Promise.resolve('m-email-new')),
    sendText: vi.fn(() => Promise.resolve('m-text-new')),
  }
}

/** The thread window's box, on Greg's thread, which starts on Text. */
function threadBox() {
  const view = spineMessagesView()
  const contact = view.contacts.find((c) => c.id === 'c-greg')
  if (!contact) throw new Error('no c-greg in the demo')
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
        <ReplyBox contact={open.contact} io={fakeIo()} loadBoxes={() => Promise.resolve(null)} />
      </OpenThreadContext.Provider>
    </MessagesRereadContext.Provider>,
  )
  return document.querySelector('[data-reply-box]') as HTMLElement
}

const DANA: Contact = {
  id: 'c-dana',
  kind: 'customer',
  name: 'Dana Whitfield',
  goesBy: null,
  company: '',
  record: { table: 'customers', id: 'cust-dana' },
  channels: [
    { id: 'ch-dana-cell', kind: 'phone', value: '(210) 555-0188', optedOutAt: null },
    { id: 'ch-dana-email', kind: 'email', value: 'dana@whitfield.example', optedOutAt: null },
  ],
  jobIds: ['pipeline:j-helotes'],
  defaultJobId: null,
  customerId: 'cust-dana',
  gcCompanyId: null,
}

/** The job window's box (`JobCustomerBox`): one kind, the one the panel's Note · Text · Email row chose. */
function jobBox(kind: ReplyKind) {
  renderWithProviders(
    <MessagesRereadContext.Provider value={vi.fn()}>
      <ReplyBox contact={DANA} io={fakeIo()} job={{ key: 'pipeline:j-helotes', name: 'Helotes' }} kinds={[kind]} loadBoxes={() => Promise.resolve(null)} />
    </MessagesRereadContext.Provider>,
  )
  return document.querySelector('[data-reply-box]') as HTMLElement
}

describe('ReplyBox over the texts switch (Messages, cut 5)', () => {
  it('draws the wait line on the Text tab while the switch reads off, and Email writes as before', () => {
    switchRead.on = false
    const el = threadBox()
    expect(within(el).getByRole('radio', { name: 'Text' }).getAttribute('aria-checked')).toBe('true')
    expect(el.querySelector('[data-reply-texts-wait]')?.textContent).toBe(WAIT)
    expect(within(el).queryByRole('textbox')).toBeNull()
    expect(within(el).queryByRole('button', { name: 'Send text…' })).toBeNull()
    expect(el.querySelector('[data-qr-strip]')).toBeNull()
    expect(el.querySelector('[data-reply-tie]')).toBeNull()

    fireEvent.click(within(el).getByRole('radio', { name: 'Email' }))
    expect(el.querySelector('[data-reply-texts-wait]')).toBeNull()
    expect(within(el).getByRole('textbox', { name: 'Write to Greg Paulk' })).toBeTruthy()
    expect(within(el).getByRole('button', { name: 'Send email…' })).toBeTruthy()
    expect(el.querySelector('[data-qr-strip]')).not.toBeNull()

    fireEvent.click(within(el).getByRole('radio', { name: 'Note' }))
    expect(el.querySelector('[data-reply-texts-wait]')).toBeNull()
    expect(within(el).getByRole('textbox', { name: 'A note for the team' })).toBeTruthy()
  })

  it('draws the box, the quick replies and Send text… once the switch reads on', () => {
    switchRead.on = true
    const el = threadBox()
    expect(el.querySelector('[data-reply-texts-wait]')).toBeNull()
    expect(within(el).getByRole('textbox', { name: 'Write to Greg Paulk' })).toBeTruthy()
    expect(within(el).getByRole('button', { name: 'Send text…' })).toBeTruthy()
    expect(el.querySelector('[data-qr-strip]')).not.toBeNull()
  })

  it('draws the box as before while the switch is still being read', () => {
    switchRead.on = null
    const el = threadBox()
    expect(el.querySelector('[data-reply-texts-wait]')).toBeNull()
    expect(within(el).getByRole('button', { name: 'Send text…' })).toBeTruthy()
  })

  it('draws the wait line in the job window’s Text box while the switch reads off, and its Email box as before', () => {
    switchRead.on = false
    const text = jobBox('text')
    expect(text.querySelector('[data-reply-texts-wait]')?.textContent).toBe(WAIT)
    expect(within(text).queryByRole('textbox')).toBeNull()
    expect(within(text).queryByRole('button', { name: 'Send text…' })).toBeNull()
    cleanup()

    const email = jobBox('email')
    expect(email.querySelector('[data-reply-texts-wait]')).toBeNull()
    expect(within(email).getByRole('textbox', { name: 'Write to Dana Whitfield' })).toBeTruthy()
    expect(within(email).getByRole('button', { name: 'Send email…' })).toBeTruthy()
  })

  it('draws the job window’s Text box in the customer’s orange once the switch reads on', () => {
    switchRead.on = true
    const el = jobBox('text')
    expect(el.querySelector('[data-reply-texts-wait]')).toBeNull()
    expect(within(el).getByRole('textbox', { name: 'Write to Dana Whitfield' }).getAttribute('data-reply-look')).toBe('customer')
    expect(within(el).getByRole('button', { name: 'Send text…' })).toBeTruthy()
  })
})
