// @vitest-environment jsdom
/**
 * Punch list #118, PR 1: the To chip on the send window. With one number it is a label. With two it opens a menu; a
 * pick sends there this once, and the tick *Make this their usual number* stars it through the reply io before the
 * text goes.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/renderSmokeMocks'
import { DEMO_NOW } from '../../../../lib/messages/messagesDemo'
import { spineMessagesView } from '../../../../lib/messages/spineRows'
import type { JobTile } from '../../../../lib/messages/jobTiles'
import type { ReplyIo } from '../../../../lib/messages/replyIo'
import type { Contact } from '../../../../lib/contacts/kernel'
import { OpenThreadContext, type OpenThread } from '../openThread'
import { MessagesRereadContext } from '../useMessagesReread'
import { ReplyBox } from './ReplyBox'
import type { PapersIo } from '../../../../lib/messages/papersIo'

const noPapers: PapersIo = { load: () => Promise.resolve([]) }

vi.mock('./useTextsOn', () => ({ useTextsOn: () => true }))
vi.mock('../../../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

function fakeIo(): ReplyIo {
  return {
    loadSender: vi.fn(() => Promise.resolve({ name: 'Rosa', title: 'Office', cell: null })),
    addNote: vi.fn(() => Promise.resolve('m-note-new')),
    sendEmail: vi.fn(() => Promise.resolve('m-email-new')),
    sendText: vi.fn(() => Promise.resolve('m-text-new')),
    logCall: vi.fn(() => Promise.resolve('m-call-new')),
    makeUsual: vi.fn(() => Promise.resolve()),
  }
}

const CELL = { id: 'ch-greg-cell', kind: 'phone' as const, value: '(210) 555-0199', optedOutAt: null }

function openTextWindow(second: boolean) {
  const view = spineMessagesView()
  const greg = view.contacts.find((c) => c.id === 'c-greg')
  if (!greg) throw new Error('no c-greg in the demo')
  const contact: Contact = second ? { ...greg, channels: [...greg.channels, CELL] } : greg
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
        <ReplyBox papersIo={noPapers} contact={contact} io={io} />
      </OpenThreadContext.Provider>
    </MessagesRereadContext.Provider>,
  )
  const el = document.querySelector('[data-reply-box]') as HTMLElement
  fireEvent.change(within(el).getByRole('textbox'), { target: { value: 'Checking on the number.' } })
  fireEvent.click(within(el).getByRole('button', { name: 'Send text…' }))
  return { io }
}

describe('the To chip on the send window (punch list #118)', () => {
  it('is a label with one number, and no menu', async () => {
    openTextWindow(false)
    const win = await screen.findByRole('dialog', { name: 'Before it goes, this is what they see' })
    expect(win.querySelector('[data-to-chip]')?.textContent).toBe('To (210) 555-0113')
    expect(within(win).queryByRole('button', { name: /^To \(/ })).toBeNull()
  })

  it('opens a menu with two, sends to the pick, and stars it first when the tick is on', async () => {
    const { io } = openTextWindow(true)
    const win = await screen.findByRole('dialog', { name: 'Before it goes, this is what they see' })
    // The spine's thread carried lines on the first number, so the rule keeps it first.
    const chip = within(win).getByRole('button', { name: /^To \(210\) 555-0113/ })
    fireEvent.click(chip)
    const menu = within(win).getByRole('menu', { name: 'Which number' })
    const rows = within(menu).getAllByRole('menuitemradio')
    expect(rows.map((r) => r.getAttribute('data-to-choice'))).toEqual(['ch-greg-phone', 'ch-greg-cell'])
    expect(rows[1]!.textContent).toContain('no line yet')
    expect((within(menu).getByRole('checkbox') as HTMLInputElement).checked).toBe(true)
    fireEvent.click(rows[1]!)
    expect(within(win).getByRole('button', { name: /^To \(210\) 555-0199/ })).toBeTruthy()
    fireEvent.click(within(win).getByRole('button', { name: 'Send as text' }))
    await waitFor(() => expect(io.sendText).toHaveBeenCalled())
    expect(io.makeUsual).toHaveBeenCalledWith('ch-greg-cell')
    expect(io.sendText).toHaveBeenCalledWith(expect.objectContaining({ channelId: 'ch-greg-cell' }))
    expect((io.makeUsual as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]!).toBeLessThan((io.sendText as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]!)
  })

  it('sends this once without starring when the tick is off, and never stars the rule’s own pick', async () => {
    const { io } = openTextWindow(true)
    const win = await screen.findByRole('dialog', { name: 'Before it goes, this is what they see' })
    fireEvent.click(within(win).getByRole('button', { name: /^To \(210\) 555-0113/ }))
    const menu = within(win).getByRole('menu', { name: 'Which number' })
    fireEvent.click(within(menu).getByRole('checkbox'))
    fireEvent.click(within(menu).getAllByRole('menuitemradio')[1]!)
    fireEvent.click(within(win).getByRole('button', { name: 'Send as text' }))
    await waitFor(() => expect(io.sendText).toHaveBeenCalledWith(expect.objectContaining({ channelId: 'ch-greg-cell' })))
    expect(io.makeUsual).not.toHaveBeenCalled()
  })
})
