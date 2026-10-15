// @vitest-environment jsdom
/**
 * Messages, cut 5: the send window over the texts switch (Settings → Phone and texts → Send texts). While the switch
 * reads off the box offers no text (`ReplyBox.textsOn`), so an email's window moved to Text says the text waits and its
 * Send stays off; once it reads on the text goes through the reply io.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/renderSmokeMocks'
import { DEMO_NOW } from '../../../../lib/messages/messagesDemo'
import { spineMessagesView } from '../../../../lib/messages/spineRows'
import type { JobTile } from '../../../../lib/messages/jobTiles'
import { TEXTS_WAIT, type ReplyIo } from '../../../../lib/messages/replyIo'
import { OpenThreadContext, type OpenThread } from '../openThread'
import { MessagesRereadContext } from '../useMessagesReread'
import { ReplyBox } from './ReplyBox'

const switchRead = vi.hoisted(() => ({ on: false }))
vi.mock('./useTextsOn', () => ({ useTextsOn: () => switchRead.on }))
vi.mock('../../../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

function fakeIo(): ReplyIo {
  return {
    loadSender: vi.fn(() => Promise.resolve({ name: 'Robert', title: 'Project manager', cell: '(210) 555-0142' })),
    addNote: vi.fn(() => Promise.resolve('m-note-new')),
    sendEmail: vi.fn(() => Promise.resolve('m-email-new')),
    sendText: vi.fn(() => Promise.resolve('m-text-new')),
  }
}

function openTextWindow(from: 'text' | 'email' = 'text') {
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
  const io = fakeIo()
  renderWithProviders(
    <MessagesRereadContext.Provider value={vi.fn()}>
      <OpenThreadContext.Provider value={open}>
        <ReplyBox contact={open.contact} io={io} />
      </OpenThreadContext.Provider>
    </MessagesRereadContext.Provider>,
  )
  const el = document.querySelector('[data-reply-box]') as HTMLElement
  if (from === 'email') fireEvent.click(within(el).getByRole('radio', { name: 'Email' }))
  fireEvent.change(within(el).getByRole('textbox'), { target: { value: 'Checking on the number.' } })
  fireEvent.click(within(el).getByRole('button', { name: from === 'email' ? 'Send email…' : 'Send text…' }))
  return { io }
}

describe('SendWindow over the texts switch (Messages, cut 5)', () => {
  it('holds a text while the switch reads off', async () => {
    switchRead.on = false
    const { io } = openTextWindow('email')
    const win = await screen.findByRole('dialog', { name: 'Before it goes, this is what they see' })
    fireEvent.click(within(win).getByRole('tab', { name: 'Text' }))
    expect(win.querySelector('[data-send-waits]')?.textContent).toBe(TEXTS_WAIT)
    expect(win.querySelector('[data-send-waits] a')?.getAttribute('href')).toBe('/settings?tab=settings-phone-texts')
    expect((within(win).getByRole('button', { name: 'Send as text' }) as HTMLButtonElement).disabled).toBe(true)
    expect(io.sendText).not.toHaveBeenCalled()
  })

  it('sends the text once the switch reads on', async () => {
    switchRead.on = true
    const { io } = openTextWindow()
    const win = await screen.findByRole('dialog', { name: 'Before it goes, this is what they see' })
    expect(win.querySelector('[data-send-waits]')).toBeNull()
    const send = within(win).getByRole('button', { name: 'Send as text' }) as HTMLButtonElement
    expect(send.disabled).toBe(false)
    fireEvent.click(send)
    await waitFor(() => expect(io.sendText).toHaveBeenCalledTimes(1))
    expect(io.sendText).toHaveBeenCalledWith(expect.objectContaining({ contactId: 'c-greg', body: 'Checking on the number.', held: false }))
  })
})
